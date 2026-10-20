import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { hasCapability, CAPABILITIES } from './entitlements.js';
import { resolveCommercialConfig } from './config.js';
import { readLicenseState, validateLicense } from './license.js';
import { validatePolicyPack } from '../policyPacks.js';

const MAX_RESPONSE_BYTES = 128 * 1024;
const POLICY_ID = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

function serviceUrl(env) {
  const config = resolveCommercialConfig(env);
  const configured = config.environment === 'sandbox'
    ? env.MERGE_GUARD_PRO_SANDBOX_SERVICE_URL
    : (env.MERGE_GUARD_PRO_SERVICE_URL || config.proServiceUrl);
  if (!configured) throw new Error('Pro fulfillment service is not configured for this environment.');
  let url;
  try { url = new URL(configured); }
  catch { throw new Error('Invalid Pro fulfillment service URL.'); }
  const sandboxLoopback = config.environment === 'sandbox'
    && url.protocol === 'http:'
    && url.hostname === '127.0.0.1';
  if ((url.protocol !== 'https:' && !sandboxLoopback) || url.username || url.password
      || url.search || url.hash || url.pathname !== '/' || !url.hostname) {
    throw new Error('Pro fulfillment requires an HTTPS origin (sandbox loopback excepted).');
  }
  return url.origin;
}

async function obtainGrant(env, licenseFetch, capability) {
  const grant = await validateLicense({ env, fetchImpl: licenseFetch, force: true });
  if (grant.validation !== 'live' || !hasCapability(grant.plan, capability)) {
    throw new Error('A currently granted Pro or Team license is required.');
  }
  const state = readLicenseState({ env });
  const key = env.MERGE_GUARD_LICENSE_KEY || state?.licenseKey;
  if (!key || state?.licenseKey !== key || !state?.activationId) {
    throw new Error('Activate this Pro or Team license on the device before requesting paid fulfillment.');
  }
  return { key, organization_id: resolveCommercialConfig(env).organizationId, activation_id: state.activationId };
}

async function sendRequest(endpoint, payload, { url, fetchImpl }) {
  let response;
  try {
    response = await fetchImpl(url + endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(10000) : undefined
    });
  } catch {
    throw new Error('Pro fulfillment service is unavailable.');
  }
  if (!response?.ok) {
    if (response?.status === 401 || response?.status === 403) {
      throw new Error('Pro fulfillment rejected the license.');
    }
    throw new Error('Pro fulfillment request failed (' + (response?.status || 'unknown') + ').');
  }
  let raw;
  try { raw = await response.text(); }
  catch { throw new Error('Invalid Pro fulfillment response.'); }
  if (Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new Error('Pro fulfillment response exceeds the maximum size.');
  }
  try { return JSON.parse(raw); }
  catch { throw new Error('Invalid Pro fulfillment response.'); }
}

export async function listPremiumPolicyPacks({
  env = process.env, fetchImpl = globalThis.fetch, licenseFetch = globalThis.fetch
} = {}) {
  const url = serviceUrl(env);
  const grant = await obtainGrant(env, licenseFetch, CAPABILITIES.PREMIUM_POLICY_DELIVERY);
  const result = await sendRequest('/v1/pro/catalog', grant, { url, fetchImpl });
  if (!result || !Array.isArray(result.policies) || result.policies.length > 50) {
    throw new Error('Invalid Pro policy catalog.');
  }
  const ids = new Set();
  return result.policies.map(item => {
    if (!item || typeof item.id !== 'string' || !POLICY_ID.test(item.id)
        || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 160
        || typeof item.version !== 'string' || !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(item.version)
        || ids.has(item.id)) {
      throw new Error('Invalid Pro policy catalog.');
    }
    ids.add(item.id);
    return { id: item.id, name: item.name, version: item.version };
  });
}

export async function fetchPremiumPolicyPack(id, {
  env = process.env, fetchImpl = globalThis.fetch, licenseFetch = globalThis.fetch
} = {}) {
  if (typeof id !== 'string' || !POLICY_ID.test(id)) throw new Error('Invalid Pro policy ID.');
  const url = serviceUrl(env);
  const grant = await obtainGrant(env, licenseFetch, CAPABILITIES.PREMIUM_POLICY_DELIVERY);
  const result = await sendRequest('/v1/pro/policy', { ...grant, id }, { url, fetchImpl });
  if (!result || !result.policy || typeof result.sha256 !== 'string') {
    throw new Error('Invalid Pro policy response.');
  }
  const actual = createHash('sha256').update(JSON.stringify(result.policy)).digest('hex');
  if (actual !== result.sha256) throw new Error('Pro policy integrity check failed.');
  const parsed = validatePolicyPack(result.policy);
  if (!parsed.valid || parsed.policy?.identity?.id !== 'merge-guard.pro.' + id) {
    throw new Error('Delivered Pro policy is incompatible or invalid.');
  }
  return {
    policy: parsed.policy,
    source: { kind: 'pro-fulfillment', id: parsed.policy.identity.id,
      version: parsed.policy.identity.version, sha256: actual }
  };
}

export async function submitPrioritySupport(filePath, {
  env = process.env, fetchImpl = globalThis.fetch, licenseFetch = globalThis.fetch
} = {}) {
  if (typeof filePath !== 'string' || !filePath) throw new Error('Support request file is required.');
  const url = serviceUrl(env);
  const contact = env.MERGE_GUARD_SUPPORT_CONTACT || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) || contact.length > 254) {
    throw new Error('Set MERGE_GUARD_SUPPORT_CONTACT to a valid reply email address.');
  }
  let contents;
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 4096) {
      throw new Error('Invalid support request file.');
    }
    contents = fs.readFileSync(filePath, 'utf8').trim();
  } catch { throw new Error('Support request must be a regular file of at most 4 KB.'); }
  if (!contents || contents.length > 4000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(contents)) {
    throw new Error('Support request text must be 1–4000 characters without terminal control characters.');
  }
  const grant = await obtainGrant(env, licenseFetch, CAPABILITIES.PRIORITY_SUPPORT);
  const result = await sendRequest('/v1/pro/support', {
    ...grant, contact, message: contents
  }, { url, fetchImpl });
  if (!result || result.status !== 'queued' || !/^[0-9a-f-]{36}$/.test(result.ticket_id || '')) {
    throw new Error('Invalid support intake confirmation.');
  }
  return { ticketId: result.ticket_id, status: result.status };
}
