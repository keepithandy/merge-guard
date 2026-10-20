#!/usr/bin/env node
// P6B: an isolated loopback gateway is NOT proof of safe public ingress.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { createProGateway } from '../src/commercial/proGateway.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-p6-gateway-'));
const policyDir = path.join(tmp, 'policy');
const supportDir = path.join(tmp, 'support');
fs.mkdirSync(policyDir, { mode: 0o700 });
fs.copyFileSync(path.join('policies', 'pro-reference', 'release-integrity.json'),
  path.join(policyDir, 'release-integrity.json'));
const org = '84897a3c-12b6-40b4-a96b-9e7b1681a352';
const benefit = 'bf34f3a6-a63a-4ccc-9d0e-882f5426dfa9';
const key = 'MG-P6-SYNTHETIC-NEVER-REAL';
const activation = '77777777-7777-4777-8777-777777777777';
const env = {
  ...process.env, MERGE_GUARD_POLAR_ENVIRONMENT: 'sandbox',
  MERGE_GUARD_POLAR_ORGANIZATION_ID: org, MERGE_GUARD_POLAR_PRO_BENEFIT_ID: benefit
};
let upstreamCalls = 0;
const provider = async (url, options) => {
  upstreamCalls++;
  assert(url.endsWith('/v1/customer-portal/license-keys/validate'));
  assert.deepEqual(JSON.parse(options.body), {
    key, organization_id: org, activation_id: activation
  }, 'only bounded license attributes go to the provider');
  return new Response(JSON.stringify({
    status: 'granted', benefit_id: benefit, organization_id: org, expires_at: null
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const server = createProGateway({
  env, policyDirectory: policyDir, supportDirectory: supportDir, fetchImpl: provider,
  maxIpRequestsPerMinute: 14, maxKeyRequestsPerMinute: 2
});
const request = { key, organization_id: org, activation_id: activation };
let base;
async function catalog(data = request, headers = {}) {
  return fetch(base + '/v1/pro/catalog', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(data)
  });
}
async function hostileHeaders(headers) {
  return new Promise((resolve, reject) => {
    const req = http.request(base + '/v1/pro/catalog',
      { method: 'POST', headers: { 'content-type': 'application/json', ...headers } }, res => {
        res.resume(); res.on('end', () => resolve(res.statusCode));
      });
    req.on('error', reject);
    req.end(JSON.stringify(request));
  });
}
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port;

  assert.equal(await hostileHeaders({ Host: 'attacker.example' }), 400,
    'host-header injection must fail before provider access');
  assert.equal(await hostileHeaders({ Origin: 'https://attacker.example' }), 400,
    'cross-site browser-origin requests are not a supported API');
  assert.equal(await hostileHeaders({ 'X-Forwarded-For': '127.0.0.1' }), 400,
    'client-supplied proxy identities must never be trusted');
  assert.equal(await hostileHeaders({ Forwarded: 'for=127.0.0.1' }), 400);
  assert.equal(upstreamCalls, 0, 'invalid ingress must not call Polar');

  const good = await catalog();
  assert.equal(good.status, 200);
  const body = await good.json();
  assert.deepEqual(body.policies.map(p => p.id), ['release-integrity']);

  const invalid = await catalog({
    ...request, organization_id: '00000000-0000-4000-8000-000000000000'
  });
  assert.equal(invalid.status, 403, 'cross-organization request rejected');

  const second = await catalog();
  assert.equal(second.status, 200);
  assert.equal(upstreamCalls, 2, 'wrong-organization request never reached provider');
  const exhaustedKey = await catalog();
  assert.equal(exhaustedKey.status, 429, 'identity limit must reject excess calls');
  assert.equal(upstreamCalls, 2, 'rate-limited request must not contact Polar');
  assert(!JSON.stringify(await exhaustedKey.json()).includes(key));

  // Fail closed on an unexpected filesystem link even if it resolves to a
  // valid policy. Windows symlink creation may require elevated privilege.
  const symlinkFile = path.join(policyDir, 'hidden.json');
  let linkCreated = false;
  try {
    fs.symlinkSync(path.join(policyDir, 'release-integrity.json'), symlinkFile, 'file');
    linkCreated = true;
  } catch (error) {
    if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error;
  }
  if (linkCreated) {
    // A new, independent server avoids the per-key limit from the first
    // instance and proves catalog enumeration ignores link entries.
    const secondary = createProGateway({ env, policyDirectory: policyDir, supportDirectory: supportDir,
      fetchImpl: provider });
    try {
      secondary.listen(0, '127.0.0.1');
      await once(secondary, 'listening');
      const response = await fetch('http://127.0.0.1:' + secondary.address().port + '/v1/pro/catalog', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request)
      });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).policies.map(x => x.id), ['release-integrity']);
    } finally {
      await new Promise(resolve => secondary.close(resolve));
    }
  }
  // IP limiter covers unauthenticated traffic, using the TCP peer rather than
  // spoofable forwarding headers. No raw IP or key is emitted in responses.
  let limited = false;
  for (let i = 0; i < 20; i++) {
    const response = await fetch(base + '/healthz');
    const status = response.status;
    await response.arrayBuffer(); // Release pooled sockets on Node 18/Windows.
    if (status === 429) { limited = true; break; }
    assert.equal(status, 200);
  }
  assert(limited, 'gateway must bound unauthenticated request frequency');
  assert.equal(upstreamCalls >= 2, true);
  console.log('P6 gateway security contracts passed: strict local ingress, rate limits, entitlement, symlink and no secrets');
} finally {
  if (server.listening) await new Promise(resolve => server.close(resolve));
  fs.rmSync(tmp, { recursive: true, force: true });
}
