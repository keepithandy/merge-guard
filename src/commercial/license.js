import { randomUUID } from 'node:crypto';
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
  const directory = path.dirname(file);
  // Serialize before touching disk: a serialization failure must preserve the
  // previously validated state.
  const contents = JSON.stringify(state, null, 2) + '\n';
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporaryFile = path.join(directory, `.${path.basename(file)}.${randomUUID()}.tmp`);
  let descriptor;
  try {
    // The temporary file lives beside the destination so rename is atomic on
    // supported local filesystems. 'wx' prevents overwriting an existing file.
    descriptor = fs.openSync(temporaryFile, 'wx', 0o600);
    fs.writeFileSync(descriptor, contents, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryFile, file);
    return file;
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch { /* preserve original failure */ }
    }
    try { fs.rmSync(temporaryFile, { force: true }); } catch { /* preserve original failure */ }
    throw error;
  }
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
  if (!state?.licenseKey || state.licenseKey !== key || !state?.benefitId || !state?.lastValidatedAt) return PLAN_FREE;
  if (hasExpired(state.expiresAt, atMs)) return PLAN_FREE;
  if (!['granted', 'offline-grace'].includes(state.status)) return PLAN_FREE;
  return planForBenefitId(state.benefitId, env);
}

function parseValidatedLicense(data, env, atMs = Date.now()) {
  const status = data?.status || 'unknown';
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
    const error = new Error(detail ? `Polar request failed (${response.status}): ${detail}` : `Polar request failed (${response.status})`);
    error.status = response.status;
    throw error;
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
  const existing = readLicenseState({ env });
  if (existing?.activationId && existing.licenseKey !== key) {
    throw new Error('A different license is already activated. Run "merge-guard license clear" to deactivate it before switching keys.');
  }
  if (existing?.activationId && existing.licenseKey === key) {
    // Reuse the existing device activation instead of consuming another slot.
    const refreshed = await validateLicense({ env, fetchImpl, force: true });
    if (refreshed.plan === PLAN_FREE) throw new Error('The existing license could not be validated as Pro or Team.');
    return refreshed;
  }
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
  // An environment override may be used for an isolated validation, but must
  // not replace another license's durable local device activation.
  const externalKey = Boolean(env.MERGE_GUARD_LICENSE_KEY && env.MERGE_GUARD_LICENSE_KEY !== state?.licenseKey);
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
      activation_id: state?.licenseKey === key ? state?.activationId || undefined : undefined
    }, { fetchImpl, signal: timeoutSignal() });
    const parsed = parseValidatedLicense(data, env, currentTime);
    const next = {
      provider: 'polar',
      plan: parsed.plan,
      status: parsed.status,
      licenseKey: key,
      activationId: state?.licenseKey === key ? state?.activationId || parsed.activationId || null : parsed.activationId || null,
      benefitId: parsed.benefitId,
      expiresAt: parsed.expiresAt,
      lastValidatedAt: new Date(currentTime).toISOString(),
      validation: 'live'
    };
    if (!externalKey) writeLicenseState(next, { env });
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
        plan: PLAN_FREE,
        status: 'rejected',
        licenseKey: key,
        lastValidatedAt: new Date(currentTime).toISOString(),
        validation: 'failed',
        warning: error.message
      };
      if (!externalKey) writeLicenseState(denied, { env });
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
  // Deactivate only the key that actually owns the stored device activation.
  // An environment key override must not be used with a different activation.
  const key = state?.licenseKey || null;
  if (state?.activationId && organizationId && key) {
    // Preserve local activation on remote failure so the user can retry. The
    // explicit CLI --local-only option handles intentional forced cleanup.
    await polarPost('/v1/customer-portal/license-keys/deactivate', {
      key,
      organization_id: organizationId,
      activation_id: state.activationId
    }, { fetchImpl, signal: timeoutSignal() });
  }
  clearLicenseState({ env });
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
