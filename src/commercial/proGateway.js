import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { resolveCommercialConfig } from './config.js';
import { planForBenefitId, PLAN_FREE } from './entitlements.js';
import { validatePolicyPack } from '../policyPacks.js';

const MAX_BODY_BYTES = 12 * 1024;
const DEFAULT_MAX_IN_FLIGHT = 16;
const DEFAULT_IP_REQUESTS_PER_MINUTE = 120;
const DEFAULT_KEY_REQUESTS_PER_MINUTE = 240;
const RATE_WINDOW_MS = 60 * 1000;
const MAX_RATE_BUCKETS = 1024;
const LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\]):[1-9][0-9]{0,4}$/;
const UNSAFE_TERMINAL_CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const POLICY_ID = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

// A local gateway must not accept hostile Host/Origin or untrusted reverse-proxy
// identity headers. Public TLS ingress needs a separately reviewed proxy contract.
function trustedLocalRequest(req) {
  const host = req.headers.host;
  if (typeof host !== 'string' || !LOOPBACK_HOST.test(host)
      || Number(host.slice(host.lastIndexOf(':') + 1)) !== req.socket.localPort
      || req.headers.origin !== undefined || req.headers.forwarded !== undefined
      || req.headers['x-forwarded-for'] !== undefined
      || req.headers['x-forwarded-host'] !== undefined
      || req.headers['x-forwarded-proto'] !== undefined) return false;
  const remote = req.socket.remoteAddress;
  return remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
}

function allowWithinWindow(buckets, id, limit) {
  const now = Date.now();
  const value = buckets.get(id);
  if (value && value.until > now) {
    if (value.count >= limit) return false;
    value.count++;
    return true;
  }
  if (buckets.size >= MAX_RATE_BUCKETS) {
    for (const [key, entry] of buckets) {
      if (entry.until <= now) buckets.delete(key);
    }
    // Refuse unexpected identity cardinality instead of unbounded accumulation.
    if (buckets.size >= MAX_RATE_BUCKETS && !buckets.has(id)) return false;
  }
  buckets.set(id, { until: now + RATE_WINDOW_MS, count: 1 });
  return true;
}

function reply(res, status, value) {
  const bytes = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': bytes.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(bytes);
}

async function readBody(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new Error('JSON content-type required');
  }
  const advertisedLength = Number(req.headers['content-length']);
  if (Number.isFinite(advertisedLength) && advertisedLength > MAX_BODY_BYTES) {
    throw new Error('Request too large');
  }
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) throw new Error('Request too large');
    chunks.push(chunk);
  }
  let data;
  try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('Invalid JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid JSON object');
  return data;
}

async function verifyLicense(body, env, fetchImpl) {
  const config = resolveCommercialConfig(env);
  if (typeof body.key !== 'string' || body.key.length < 8 || body.key.length > 512
      || body.organization_id !== config.organizationId
      || typeof body.activation_id !== 'string'
      || !/^[0-9a-f-]{36}$/.test(body.activation_id)) return false;
  let response;
  try {
    response = await fetchImpl(config.apiBaseUrl + '/v1/customer-portal/license-keys/validate', {
      method: 'POST', redirect: 'error',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: body.key, organization_id: config.organizationId, activation_id: body.activation_id }),
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(5000) : undefined
    });
  } catch { return false; }
  if (!response?.ok) return false;
  let license;
  try { license = await response.json(); } catch { return false; }
  if (license?.status !== 'granted' || license?.organization_id !== config.organizationId) return false;
  if (planForBenefitId(license.benefit_id, env) === PLAN_FREE) return false;
  if (license.expires_at) {
    const expiry = Date.parse(license.expires_at);
    if (!Number.isFinite(expiry) || expiry <= Date.now()) return false;
  }
  return true;
}

function servePolicy(id, directory) {
  const root = fs.lstatSync(directory);
  if (!root.isDirectory() || root.isSymbolicLink()) return null;
  if (typeof id !== 'string' || !POLICY_ID.test(id)) return null;
  const file = path.join(directory, id + '.json');
  let policy;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) return null;
    // Open the verified inode (not the path a second time), refusing symlink
    // substitution between lstat and read on platforms with O_NOFOLLOW.
    const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
    const fd = fs.openSync(file, flags);
    try {
      const opened = fs.fstatSync(fd);
      if (!opened.isFile() || opened.size > 64 * 1024) return null;
      policy = JSON.parse(fs.readFileSync(fd, 'utf8'));
    } finally {
      fs.closeSync(fd);
    }
  } catch { return null; }
  const parsed = validatePolicyPack(policy);
  if (!parsed.valid || parsed.policy?.identity?.id !== 'merge-guard.pro.' + id) return null;
  const sha256 = createHash('sha256').update(JSON.stringify(policy)).digest('hex');
  return { policy, sha256 };
}

function catalogPolicies(directory) {
  const root = fs.lstatSync(directory);
  if (!root.isDirectory() || root.isSymbolicLink()) {
    throw new Error('Invalid Pro policy directory.');
  }
  const entries = fs.readdirSync(directory).filter(name =>
    name.endsWith('.json') && POLICY_ID.test(name.slice(0, -5)));
  if (entries.length > 50) throw new Error('Pro policy catalog exceeds 50 entries.');
  const policies = [];
  for (const file of entries.sort()) {
    const id = file.slice(0, -5);
    const item = servePolicy(id, directory);
    if (item) {
      policies.push({
        id,
        name: item.policy.identity.name,
        version: item.policy.identity.version
      });
    }
  }
  return { policies };
}

function queueTicket(body, directory, env) {
  if (typeof body.contact !== 'string' || body.contact.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contact)
      || typeof body.message !== 'string'
      || body.message.trim().length < 1 || body.message.length > 4000
      || UNSAFE_TERMINAL_CONTROL.test(body.contact) || UNSAFE_TERMINAL_CONTROL.test(body.message)) {
    return null;
  }
  const config = resolveCommercialConfig(env);
  const ticketId = randomUUID();
  const ticket = {
    id: ticketId,
    status: 'queued',
    receivedAt: new Date().toISOString(),
    environment: config.environment,
    organizationId: config.organizationId,
    tier: 'pro-or-team',
    contact: body.contact,
    message: body.message
  };
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const root = fs.lstatSync(directory);
  if (!root.isDirectory() || root.isSymbolicLink()
      || (process.platform !== 'win32' && (root.mode & 0o077) !== 0)) {
    throw new Error('Support directory must be a private, real directory.');
  }
  const file = path.join(directory, ticketId + '.json');
  let fd;
  try {
    fd = fs.openSync(file, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify(ticket, null, 2) + '\n');
    fs.fsyncSync(fd);
  } catch (error) {
    try { fs.rmSync(file, { force: true }); } catch { /* filesystem failure */ }
    throw error;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  return { ticket_id: ticketId, status: 'queued' };
}

export function createProGateway({
  env = process.env,
  policyDirectory,
  supportDirectory,
  fetchImpl = globalThis.fetch,
  maxInFlight = DEFAULT_MAX_IN_FLIGHT,
  maxIpRequestsPerMinute = DEFAULT_IP_REQUESTS_PER_MINUTE,
  maxKeyRequestsPerMinute = DEFAULT_KEY_REQUESTS_PER_MINUTE
} = {}) {
  const config = resolveCommercialConfig(env);
  if (!config.organizationId || !config.proBenefitId || !policyDirectory || !supportDirectory) {
    throw new Error('Pro gateway requires organization, Pro benefit, policy directory, and support directory.');
  }
  if (path.resolve(policyDirectory) === path.resolve(supportDirectory)) {
    throw new Error('Policy and support directories must differ.');
  }
  if (!Number.isInteger(maxInFlight) || maxInFlight < 1 || maxInFlight > 1024) {
    throw new Error('Pro gateway maxInFlight must be an integer from 1 to 1024.');
  }

  for (const [label, limit] of [
    ['maxIpRequestsPerMinute', maxIpRequestsPerMinute],
    ['maxKeyRequestsPerMinute', maxKeyRequestsPerMinute]
  ]) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100000) {
      throw new Error(label + ' must be an integer from 1 to 100000.');
    }
  }

  let inFlight = 0;
  const ipBuckets = new Map();
  const keyBuckets = new Map();
  const keyRateSalt = randomUUID();
  const server = http.createServer(async (req, res) => {
    if (!trustedLocalRequest(req)) {
      reply(res, 400, { error: 'invalid-request' });
      return;
    }
    if (!allowWithinWindow(ipBuckets, req.socket.remoteAddress, maxIpRequestsPerMinute)) {
      reply(res, 429, { error: 'rate-limited' });
      return;
    }
    if (req.method === 'GET' && req.url === '/healthz') {
      reply(res, 200, { status: 'ok', environment: config.environment });
      return;
    }
    if (req.method !== 'POST' || !['/v1/pro/policy', '/v1/pro/catalog', '/v1/pro/support'].includes(req.url)) {
      reply(res, 404, { error: 'not-found' });
      return;
    }
    if (inFlight >= maxInFlight) {
      reply(res, 503, { error: 'gateway-busy' });
      return;
    }
    inFlight++;
    try {
      let body;
      try { body = await readBody(req); }
      catch { reply(res, 400, { error: 'invalid-request' }); return; }

      // Store only a salted-in-process fingerprint, never the raw license key.
      // A caller can rotate keys, but it cannot bypass the source-address gate.
      if (typeof body.key === 'string' && body.organization_id === config.organizationId) {
        const fingerprint = createHash('sha256')
          .update(keyRateSalt).update(body.key).digest('hex');
        if (!allowWithinWindow(keyBuckets, fingerprint, maxKeyRequestsPerMinute)) {
          reply(res, 429, { error: 'rate-limited' });
          return;
        }
      }

      const granted = await verifyLicense(body, env, fetchImpl);
      if (!granted) { reply(res, 403, { error: 'not-entitled' }); return; }

      if (req.url === '/v1/pro/catalog') {
        try { reply(res, 200, catalogPolicies(policyDirectory)); }
        catch { reply(res, 503, { error: 'policy-catalog-unavailable' }); }
        return;
      }
      if (req.url === '/v1/pro/policy') {
        let result;
        try { result = servePolicy(body.id, policyDirectory); }
        catch { reply(res, 503, { error: 'policy-store-unavailable' }); return; }
        if (!result) { reply(res, 404, { error: 'policy-not-found' }); return; }
        reply(res, 200, result);
        return;
      }

      try {
        const ticket = queueTicket(body, supportDirectory, env);
        if (!ticket) { reply(res, 400, { error: 'invalid-support-request' }); return; }
        reply(res, 201, ticket);
      } catch {
        reply(res, 503, { error: 'support-queue-unavailable' });
      }
    } catch {
      if (!res.headersSent) reply(res, 503, { error: 'gateway-unavailable' });
    } finally {
      inFlight--;
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}
