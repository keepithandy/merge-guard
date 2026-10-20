import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { capabilitiesForPlan, PLAN_FREE, planForBenefitId } from './entitlements.js';
import { resolveCommercialConfig } from './config.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
// Disk stores credentials, never authority. A new process must contact Polar
// before paid cache/grace is possible: an unwritable store cannot retain denial.
const sessions = new Map();
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function licenseFilePath(env = process.env) {
  const { environment } = resolveCommercialConfig(env);
  const file = env.MERGE_GUARD_LICENSE_FILE
    ? path.resolve(env.MERGE_GUARD_LICENSE_FILE)
    : path.join(os.homedir(), '.merge-guard', 'license.json');
  return environment === 'sandbox' ? `${file}.sandbox` : file;
}

function sessionFor(env, key) {
  const config = resolveCommercialConfig(env);
  const file = licenseFilePath(env);
  const id = digest([file, config.environment, config.organizationId, config.proBenefitId, config.teamBenefitId, key]);
  if (!sessions.has(id)) sessions.set(id, { file, epoch: 0, receipt: null });
  return sessions.get(id);
}

function forgetFile(file) {
  for (const session of sessions.values()) {
    if (session.file === file) { session.epoch += 1; session.receipt = null; }
  }
}

export function readLicenseState({ env = process.env } = {}) {
  const file = licenseFilePath(env);
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) return null;
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
    const config = resolveCommercialConfig(env);
    // Legacy production credentials remain available for live validation only.
    if (state.environment === undefined && config.environment === 'production') return state;
    return state.environment === config.environment && state.organizationId === config.organizationId ? state : null;
  } catch { return null; }
}

function saveLicenseState(state, env) {
  const file = licenseFilePath(env);
  const temporary = `${file}.${randomUUID()}.tmp`;
  let descriptor;
  try {
    const contents = JSON.stringify(state, null, 2) + '\n';
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, contents, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, file);
    return file;
  } catch {
    // Filesystem exceptions can contain paths or injected secrets.
    throw new Error('Local license state could not be saved.');
  } finally {
    if (descriptor !== undefined) { try { fs.closeSync(descriptor); } catch { /* best effort */ } }
    try { fs.rmSync(temporary, { force: true }); } catch { /* authorization never relies on cleanup */ }
  }
}

export function writeLicenseState(state, { env = process.env } = {}) {
  forgetFile(licenseFilePath(env));
  return saveLicenseState(state, env);
}

export function clearLicenseState({ env = process.env } = {}) {
  const file = licenseFilePath(env);
  forgetFile(file);
  try { fs.rmSync(file, { force: true }); }
  catch { throw new Error('Local license state could not be removed.'); }
}

function keyFromState(state, env) {
  return env.MERGE_GUARD_LICENSE_KEY || state?.licenseKey || null;
}

function hasExpired(expiresAt, atMs) {
  if (expiresAt === null || expiresAt === undefined) return false;
  if (typeof expiresAt !== 'string' || !expiresAt) return true;
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry <= atMs;
}

function cachedPlanFromState(state, env, key, atMs) {
  const config = resolveCommercialConfig(env);
  if (state?.environment !== config.environment || state?.organizationId !== config.organizationId) return PLAN_FREE;
  if (!state?.licenseKey || state.licenseKey !== key || !state?.benefitId || !state?.lastValidatedAt) return PLAN_FREE;
  if (hasExpired(state.expiresAt, atMs) || state.status !== 'granted') return PLAN_FREE;
  return planForBenefitId(state.benefitId, env);
}

function parseValidatedLicense(data, env, atMs) {
  const config = resolveCommercialConfig(env);
  const knownStatus = ['granted', 'revoked', 'disabled', 'canceled', 'expired'].includes(data?.status) ? data.status : 'unknown';
  let status = data?.organization_id && data.organization_id !== config.organizationId ? 'wrong-organization' : knownStatus;
  const expired = hasExpired(data?.expires_at, atMs);
  const mappedPlan = planForBenefitId(data?.benefit_id, env);
  if (status === 'granted' && expired) status = 'expired';
  if (status === 'granted' && mappedPlan === PLAN_FREE) status = 'unmapped-benefit';
  return {
    plan: status === 'granted' ? mappedPlan : PLAN_FREE, status,
    benefitId: mappedPlan === PLAN_FREE ? null : data.benefit_id,
    expiresAt: typeof data?.expires_at === 'string' && !Number.isNaN(Date.parse(data.expires_at)) ? new Date(data.expires_at).toISOString() : null,
    activationId: typeof data?.activation?.id === 'string' ? data.activation.id : null
  };
}

class PolarRequestError extends Error {
  constructor(message, { denied = false, transient = false } = {}) {
    super(message);
    this.denied = denied;
    this.transient = transient;
  }
}

async function polarPost(endpoint, payload, { env = process.env, fetchImpl = globalThis.fetch, signal } = {}) {
  const { apiBaseUrl } = resolveCommercialConfig(env);
  if (typeof fetchImpl !== 'function') throw new PolarRequestError('Fetch API is unavailable in this Node.js runtime.');
  let response;
  try {
    response = await fetchImpl(`${apiBaseUrl}${endpoint}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload), redirect: 'error', signal
    });
  } catch { throw new PolarRequestError('Polar request could not be completed.', { transient: true }); }
  if (!response?.ok) {
    const status = Number.isInteger(response?.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
    throw new PolarRequestError(status ? `Polar request failed (${status})` : 'Polar returned an invalid response.', {
      denied: status >= 400 && status < 500 && status !== 429,
      transient: status === 429 || status >= 500
    });
  }
  if (response.status === 204) return null;
  try { return await response.json(); }
  catch { throw new PolarRequestError('Polar returned an invalid response.'); }
}

function timeoutSignal(ms = 5000) {
  if (typeof AbortSignal?.timeout === 'function') return AbortSignal.timeout(ms);
  return undefined;
}

function decisionState(parsed, key, organizationId, env, atMs, activationId = null) {
  return {
    provider: 'polar', environment: resolveCommercialConfig(env).environment, organizationId,
    ...parsed, licenseKey: key, activationId: activationId || parsed.activationId || null,
    lastValidatedAt: new Date(atMs).toISOString(), validation: 'live'
  };
}

function persistDecision(next, savedState, env) {
  if (savedState?.licenseKey && savedState.licenseKey !== next.licenseKey) {
    return 'License result was not stored because another key is saved.';
  }
  try { saveLicenseState(next, env); return null; }
  catch {
    if (next.plan !== PLAN_FREE) return 'Live validation succeeded, but local license state could not be saved.';
    try {
      clearLicenseState({ env });
      return 'Denied license state could not be saved; stale local state was removed.';
    } catch {
      return 'Denied license state could not be saved or removed. Paid access remains disabled; repair local storage before retrying.';
    }
  }
}

function acceptDecision(next, savedState, env, session, epoch) {
  if (next.plan === PLAN_FREE) {
    // Apply denial before filesystem access; invalidate older in-flight grants.
    session.epoch += 1;
    session.receipt = null;
  } else if (session.epoch !== epoch) {
    return commercialView({ provider: 'polar', plan: PLAN_FREE, status: 'superseded', validation: 'failed' });
  }
  const warning = persistDecision(next, savedState, env);
  if (next.plan !== PLAN_FREE) session.receipt = { state: { ...next, warning }, sourceHash: digest(readLicenseState({ env })) };
  return commercialView({ ...next, warning });
}

export async function activateLicense(key, { label = `${os.hostname()} / Merge Guard`, env = process.env, fetchImpl } = {}) {
  const organizationId = resolveCommercialConfig(env).organizationId;
  if (!organizationId) throw new Error('MERGE_GUARD_POLAR_ORGANIZATION_ID is not configured.');
  const savedState = readLicenseState({ env });
  const session = sessionFor(env, key);
  const epoch = session.epoch;
  let data;
  try {
    data = await polarPost('/v1/customer-portal/license-keys/activate', { key, organization_id: organizationId, label }, { env, fetchImpl, signal: timeoutSignal() });
  } catch (error) {
    if (error.denied && (savedState?.licenseKey === key || session.receipt)) {
      const denied = acceptDecision(decisionState({ plan: PLAN_FREE, status: 'rejected' }, key, organizationId, env, Date.now()), savedState, env, session, epoch);
      if (denied.warning) throw new Error(`${error.message}. ${denied.warning}`);
    } else if (error.denied) {
      // Even a first activation can race an older in-flight grant.
      session.epoch += 1;
      session.receipt = null;
    }
    throw error;
  }
  const atMs = Date.now();
  const parsed = parseValidatedLicense(data?.license_key, env, atMs);
  if (parsed.plan === PLAN_FREE && savedState?.licenseKey !== key && !session.receipt) {
    session.epoch += 1;
    throw new Error('License is valid but is not mapped to a Merge Guard Pro or Team benefit.');
  }
  const view = acceptDecision(decisionState(parsed, key, organizationId, env, atMs, data?.id), savedState, env, session, epoch);
  if (parsed.plan === PLAN_FREE) throw new Error(`License is valid but is not mapped to a Merge Guard Pro or Team benefit.${view.warning ? ` ${view.warning}` : ''}`);
  return view;
}

export async function validateLicense({ env = process.env, fetchImpl, force = false, now = Date.now } = {}) {
  const savedState = readLicenseState({ env });
  const key = keyFromState(savedState, env);
  const state = savedState?.licenseKey === key ? savedState : null;
  const organizationId = resolveCommercialConfig(env).organizationId;
  if (!key || !organizationId) return commercialView({ provider: key ? 'polar' : null, plan: PLAN_FREE, status: key ? 'not-configured' : 'not-activated' });

  const session = sessionFor(env, key);
  if (session.receipt && session.receipt.sourceHash !== digest(savedState)) {
    session.epoch += 1;
    session.receipt = null;
  }
  const currentTime = typeof now === 'function' ? now() : Date.now();
  const receipt = session.receipt?.state;
  const validatedAt = receipt?.lastValidatedAt ? Date.parse(receipt.lastValidatedAt) : NaN;
  const age = Number.isFinite(validatedAt) ? currentTime - validatedAt : Number.POSITIVE_INFINITY;
  const cachedPlan = cachedPlanFromState(receipt, env, key, currentTime);
  if (!force && cachedPlan !== PLAN_FREE && age >= 0 && age <= CACHE_TTL_MS) {
    return commercialView({ ...receipt, plan: cachedPlan, validation: 'cached' });
  }
  const epoch = session.epoch;
  let data;
  try {
    // Only provider failures enter this catch. Storage cannot trigger grace.
    data = await polarPost('/v1/customer-portal/license-keys/validate', {
      key, organization_id: organizationId, activation_id: state?.activationId || undefined
    }, { env, fetchImpl, signal: timeoutSignal() });
  } catch (error) {
    if (error.denied) {
      const denied = decisionState({ plan: PLAN_FREE, status: 'rejected' }, key, organizationId, env, currentTime);
      return acceptDecision({ ...denied, validation: 'failed' }, savedState, env, session, epoch);
    }
    if (error.transient && session.epoch === epoch && cachedPlan !== PLAN_FREE && age >= 0 && age <= OFFLINE_GRACE_MS) {
      return commercialView({ ...receipt, plan: cachedPlan, status: 'offline-grace', validation: 'cached', warning: error.message });
    }
    if (!error.transient) { session.epoch += 1; session.receipt = null; }
    return commercialView({ provider: 'polar', plan: PLAN_FREE, status: 'unavailable', validation: 'failed', warning: error.message });
  }
  const parsed = parseValidatedLicense(data, env, currentTime);
  return acceptDecision(decisionState(parsed, key, organizationId, env, currentTime, state?.activationId), savedState, env, session, epoch);
}

export async function deactivateLicense({ env = process.env, fetchImpl } = {}) {
  const state = readLicenseState({ env });
  const organizationId = resolveCommercialConfig(env).organizationId;
  const key = keyFromState(state, env);
  forgetFile(licenseFilePath(env));
  const errors = [];
  if (state?.activationId && state.licenseKey === key && organizationId && key) {
    try {
      await polarPost('/v1/customer-portal/license-keys/deactivate', { key, organization_id: organizationId, activation_id: state.activationId }, { env, fetchImpl, signal: timeoutSignal() });
    } catch { errors.push('Polar deactivation could not be confirmed.'); }
  }
  try { clearLicenseState({ env }); } catch { errors.push('Local license state could not be removed.'); }
  if (errors.length) throw new Error(errors.join(' '));
}

export function commercialView(state = {}) {
  const plan = state.plan || PLAN_FREE;
  return {
    provider: state.provider || null, plan,
    status: state.status || (plan === PLAN_FREE ? 'not-activated' : 'active'),
    validation: state.validation || null, benefitId: state.benefitId || null,
    expiresAt: state.expiresAt || null, lastValidatedAt: state.lastValidatedAt || null,
    warning: state.warning || null, capabilities: capabilitiesForPlan(plan)
  };
}
