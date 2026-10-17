import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { capabilitiesForPlan, PLAN_FREE, planForBenefitId } from './entitlements.js';
import { resolveCommercialConfig } from './config.js';

const POLAR_BASE_URL = 'https://api.polar.sh';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function nowMs(now = Date.now) {
  return typeof now === 'function' ? now() : Date.now();
}

export function licenseFilePath(env = process.env) {
  if (env.MERGE_GUARD_LICENSE_FILE) return path.resolve(env.MERGE_GUARD_LICENSE_FILE);
  return path.join(os.homedir(), '.merge-guard', 'license.json');
}

export function readLicenseState({ env = process.env } = {}) {
  const file = licenseFilePath(env);
  if (!fs.existsSync(file)) return null;
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    return state && typeof state === 'object' ? state : null;
  } catch {
    return null;
  }
}

export function writeLicenseState(state, { env = process.env } = {}) {
  const file = licenseFilePath(env);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  return file;
}

export function clearLicenseState({ env = process.env } = {}) {
  const file = licenseFilePath(env);
  if (fs.existsSync(file)) fs.rmSync(file, { force: true });
}

function configuredOrganizationId(env) {
  return resolveCommercialConfig(env).organizationId || null;
}

function keyFromState(state, env) {
  return env.MERGE_GUARD_LICENSE_KEY || state?.licenseKey || null;
}

function cachedPlanFromState(state, env) {
  if (!state?.licenseKey || !state?.benefitId || !state?.lastValidatedAt) return PLAN_FREE;
  if (!['granted', 'offline-grace'].includes(state.status)) return PLAN_FREE;
  return planForBenefitId(state.benefitId, env);
}

function parseValidatedLicense(data, env) {
  const status = data?.status || 'unknown';
  const expiresAt = data?.expires_at || null;
  const expired = expiresAt ? Date.parse(expiresAt) <= Date.now() : false;
  const plan = status === 'granted' && !expired ? planForBenefitId(data?.benefit_id, env) : PLAN_FREE;
  return {
    plan,
    status: status === 'granted' && expired ? 'expired' : status,
    benefitId: data?.benefit_id || null,
    expiresAt,
    activationId: data?.activation?.id || null
  };
}

async function polarPost(endpoint, payload, { fetchImpl = globalThis.fetch, signal } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch API is unavailable in this Node.js runtime.');
  const response = await fetchImpl(`${POLAR_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  });
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.detail || body?.error || '';
    } catch {
      detail = '';
    }
    throw new Error(detail ? `Polar request failed (${response.status}): ${detail}` : `Polar request failed (${response.status})`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function timeoutSignal(ms = 5000) {
  if (typeof AbortSignal?.timeout === 'function') return AbortSignal.timeout(ms);
  return undefined;
}

export async function activateLicense(key, { label = `${os.hostname()} / Merge Guard`, env = process.env, fetchImpl } = {}) {
  const organizationId = configuredOrganizationId(env);
  if (!organizationId) throw new Error('MERGE_GUARD_POLAR_ORGANIZATION_ID is not configured.');
  const data = await polarPost('/v1/customer-portal/license-keys/activate', {
    key,
    organization_id: organizationId,
    label
  }, { fetchImpl, signal: timeoutSignal() });
  const parsed = parseValidatedLicense(data?.license_key, env);
  if (parsed.plan === PLAN_FREE) throw new Error('License is valid but is not mapped to a Merge Guard Pro or Team benefit.');
  const state = {
    provider: 'polar',
    plan: parsed.plan,
    status: parsed.status,
    licenseKey: key,
    activationId: data?.id || parsed.activationId || null,
    benefitId: parsed.benefitId,
    expiresAt: parsed.expiresAt,
    lastValidatedAt: new Date().toISOString()
  };
  writeLicenseState(state, { env });
  return commercialView(state);
}

export async function validateLicense({ env = process.env, fetchImpl, force = false, now = Date.now } = {}) {
  const state = readLicenseState({ env });
  const key = keyFromState(state, env);
  const organizationId = configuredOrganizationId(env);
  if (!key || !organizationId) {
    return commercialView({ provider: key ? 'polar' : null, plan: PLAN_FREE, status: key ? 'not-configured' : 'not-activated' });
  }

  const validatedAt = state?.lastValidatedAt ? Date.parse(state.lastValidatedAt) : 0;
  const age = validatedAt ? nowMs(now) - validatedAt : Number.POSITIVE_INFINITY;
  const cachedPlan = cachedPlanFromState(state, env);
  if (!force && cachedPlan !== PLAN_FREE && age <= CACHE_TTL_MS) {
    return commercialView({ ...state, plan: cachedPlan, validation: 'cached' });
  }

  try {
    const data = await polarPost('/v1/customer-portal/license-keys/validate', {
      key,
      organization_id: organizationId,
      activation_id: state?.activationId || undefined
    }, { fetchImpl, signal: timeoutSignal() });
    const parsed = parseValidatedLicense(data, env);
    const next = {
      provider: 'polar',
      plan: parsed.plan,
      status: parsed.status,
      licenseKey: key,
      activationId: state?.activationId || parsed.activationId || null,
      benefitId: parsed.benefitId,
      expiresAt: parsed.expiresAt,
      lastValidatedAt: new Date(nowMs(now)).toISOString(),
      validation: 'live'
    };
    writeLicenseState(next, { env });
    return commercialView(next);
  } catch (error) {
    if (cachedPlan !== PLAN_FREE && age <= OFFLINE_GRACE_MS) {
      return commercialView({ ...state, plan: cachedPlan, status: 'offline-grace', validation: 'cached', warning: error.message });
    }
    return commercialView({ provider: 'polar', plan: PLAN_FREE, status: 'unavailable', validation: 'failed', warning: error.message });
  }
}

export async function deactivateLicense({ env = process.env, fetchImpl } = {}) {
  const state = readLicenseState({ env });
  const organizationId = configuredOrganizationId(env);
  const key = keyFromState(state, env);
  if (state?.activationId && organizationId && key) {
    try {
      await polarPost('/v1/customer-portal/license-keys/deactivate', {
        key,
        organization_id: organizationId,
        activation_id: state.activationId
      }, { fetchImpl, signal: timeoutSignal() });
    } finally {
      clearLicenseState({ env });
    }
  } else {
    clearLicenseState({ env });
  }
}

export function commercialView(state = {}) {
  const plan = state.plan || PLAN_FREE;
  return {
    provider: state.provider || null,
    plan,
    status: state.status || (plan === PLAN_FREE ? 'not-activated' : 'active'),
    validation: state.validation || null,
    benefitId: state.benefitId || null,
    expiresAt: state.expiresAt || null,
    lastValidatedAt: state.lastValidatedAt || null,
    warning: state.warning || null,
    capabilities: capabilitiesForPlan(plan)
  };
}
