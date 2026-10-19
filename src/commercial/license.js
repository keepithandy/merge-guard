import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { capabilitiesForPlan, PLAN_FREE, planForBenefitId } from './entitlements.js';
import { resolveCommercialConfig } from './config.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function nowMs(now = Date.now) {
  return typeof now === 'function' ? now() : Date.now();
}

export function licenseFilePath(env = process.env) {
  const { environment } = resolveCommercialConfig(env);
  const file = env.MERGE_GUARD_LICENSE_FILE
    ? path.resolve(env.MERGE_GUARD_LICENSE_FILE)
    : path.join(os.homedir(), '.merge-guard', 'license.json');
  return environment === 'sandbox' ? `${file}.sandbox` : file;
}

export function readLicenseState({ env = process.env } = {}) {
  const file = licenseFilePath(env);
  if (!fs.existsSync(file)) return null;
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
    const config = resolveCommercialConfig(env);
    // Keep legacy production keys available for live revalidation only. Untagged
    // files and files copied from another environment cannot authorize Sandbox.
    if (state.environment === undefined && config.environment === 'production') return state;
    return state.environment === config.environment && state.organizationId === config.organizationId ? state : null;
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

function hasExpired(expiresAt, atMs) {
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  // An invalid expiration timestamp cannot safely authorize a paid plan.
  return !Number.isFinite(expiry) || expiry <= atMs;
}

function cachedPlanFromState(state, env, key, atMs) {
  const config = resolveCommercialConfig(env);
  if (state?.environment !== config.environment || state?.organizationId !== config.organizationId) return PLAN_FREE;
  if (!state?.licenseKey || state.licenseKey !== key || !state?.benefitId || !state?.lastValidatedAt) return PLAN_FREE;
  if (hasExpired(state.expiresAt, atMs)) return PLAN_FREE;
  if (!['granted', 'offline-grace'].includes(state.status)) return PLAN_FREE;
  return planForBenefitId(state.benefitId, env);
}

function parseValidatedLicense(data, env, atMs = Date.now()) {
  const organizationId = configuredOrganizationId(env);
  const status = data?.organization_id && data.organization_id !== organizationId
    ? 'wrong-organization' : data?.status || 'unknown';
  const expiresAt = data?.expires_at || null;
  const expired = hasExpired(expiresAt, atMs);
  const plan = status === 'granted' && !expired ? planForBenefitId(data?.benefit_id, env) : PLAN_FREE;
  return {
    plan,
    status: status === 'granted' && expired ? 'expired' : status,
    benefitId: data?.benefit_id || null,
    expiresAt,
    activationId: data?.activation?.id || null
  };
}

async function polarPost(endpoint, payload, { env = process.env, fetchImpl = globalThis.fetch, signal } = {}) {
  const { apiBaseUrl } = resolveCommercialConfig(env);
  if (typeof fetchImpl !== 'function') throw new Error('Fetch API is unavailable in this Node.js runtime.');
  let response;
  try {
    response = await fetchImpl(`${apiBaseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'error',
      signal
    });
  } catch {
    throw new Error('Polar request could not be completed.');
  }
  if (!response.ok) {
    // Provider errors may reflect a submitted license key. Never print or store them.
    const error = new Error(`Polar request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    throw new Error('Polar returned an invalid response.');
  }
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
  }, { env, fetchImpl, signal: timeoutSignal() });
  const parsed = parseValidatedLicense(data?.license_key, env);
  if (parsed.plan === PLAN_FREE) throw new Error('License is valid but is not mapped to a Merge Guard Pro or Team benefit.');
  const state = {
    provider: 'polar',
    environment: resolveCommercialConfig(env).environment,
    organizationId,
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
  const savedState = readLicenseState({ env });
  const key = keyFromState(savedState, env);
  const state = savedState?.licenseKey === key ? savedState : null;
  const organizationId = configuredOrganizationId(env);
  if (!key || !organizationId) {
    return commercialView({ provider: key ? 'polar' : null, plan: PLAN_FREE, status: key ? 'not-configured' : 'not-activated' });
  }

  const currentTime = nowMs(now);
  const validatedAt = state?.lastValidatedAt ? Date.parse(state.lastValidatedAt) : NaN;
  const age = Number.isFinite(validatedAt) ? currentTime - validatedAt : Number.POSITIVE_INFINITY;
  const withinCache = age >= 0 && age <= CACHE_TTL_MS;
  const withinGrace = age >= 0 && age <= OFFLINE_GRACE_MS;
  const cachedPlan = cachedPlanFromState(state, env, key, currentTime);
  if (!force && cachedPlan !== PLAN_FREE && withinCache) {
    return commercialView({ ...state, plan: cachedPlan, validation: 'cached' });
  }

  try {
    const data = await polarPost('/v1/customer-portal/license-keys/validate', {
      key,
      organization_id: organizationId,
      activation_id: state?.activationId || undefined
    }, { env, fetchImpl, signal: timeoutSignal() });
    const parsed = parseValidatedLicense(data, env, currentTime);
    const next = {
      provider: 'polar',
      environment: resolveCommercialConfig(env).environment,
      organizationId,
      plan: parsed.plan,
      status: parsed.status,
      licenseKey: key,
      activationId: state?.activationId || parsed.activationId || null,
      benefitId: parsed.benefitId,
      expiresAt: parsed.expiresAt,
      lastValidatedAt: new Date(currentTime).toISOString(),
      validation: 'live'
    };
    writeLicenseState(next, { env });
    return commercialView(next);
  } catch (error) {
    // A definite client-side rejection (invalid/revoked key, bad activation,
    // or unauthorized organization) must never turn into a paid offline grant.
    // Rate limiting, server errors, and transport outages may use bounded grace.
    const rejected = Number.isInteger(error.status) && error.status >= 400
      && error.status < 500 && error.status !== 429;
    if (rejected) {
      const denied = {
        provider: 'polar',
        environment: resolveCommercialConfig(env).environment,
        organizationId,
        plan: PLAN_FREE,
        status: 'rejected',
        licenseKey: key,
        lastValidatedAt: new Date(currentTime).toISOString(),
        validation: 'failed',
        warning: error.message
      };
      writeLicenseState(denied, { env });
      return commercialView(denied);
    }
    if (cachedPlan !== PLAN_FREE && withinGrace) {
      return commercialView({ ...state, plan: cachedPlan, status: 'offline-grace', validation: 'cached', warning: error.message });
    }
    return commercialView({ provider: 'polar', plan: PLAN_FREE, status: 'unavailable', validation: 'failed', warning: error.message });
  }
}

export async function deactivateLicense({ env = process.env, fetchImpl } = {}) {
  const state = readLicenseState({ env });
  const organizationId = configuredOrganizationId(env);
  const key = keyFromState(state, env);
  if (state?.activationId && state.licenseKey === key && organizationId && key) {
    try {
      await polarPost('/v1/customer-portal/license-keys/deactivate', {
        key,
        organization_id: organizationId,
        activation_id: state.activationId
      }, { env, fetchImpl, signal: timeoutSignal() });
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
