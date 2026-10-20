#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { activateLicense, validateLicense, readLicenseState, clearLicenseState }
  from '../src/commercial/license.js';
import { CAPABILITIES, hasCapability } from '../src/commercial/entitlements.js';
import { createProGateway } from '../src/commercial/proGateway.js';
import { listPremiumPolicyPacks, fetchPremiumPolicyPack, submitPrioritySupport }
  from '../src/commercial/proClient.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-subscription-lifecycle-'));
const supportDirectory = path.join(root, 'support');
const requestFile = path.join(root, 'request.txt');
fs.writeFileSync(requestFile, 'Synthetic lifecycle support request', { mode: 0o600 });
const key = 'MG-LIFECYCLE-SYNTHETIC-ONLY';
const activationId = '11111111-1111-4111-8111-111111111111';
const altActivation = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const env = {
  ...process.env,
  MERGE_GUARD_POLAR_ENVIRONMENT: 'sandbox',
  MERGE_GUARD_POLAR_ORGANIZATION_ID: '22222222-2222-4222-8222-222222222222',
  MERGE_GUARD_POLAR_PRO_BENEFIT_ID: '33333333-3333-4333-8333-333333333333',
  MERGE_GUARD_POLAR_TEAM_BENEFIT_ID: '44444444-4444-4444-8444-444444444444',
  MERGE_GUARD_LICENSE_FILE: path.join(root, 'license.json'),
  MERGE_GUARD_LICENSE_KEY: '',
  MERGE_GUARD_SUPPORT_CONTACT: 'synthetic@example.invalid'
};
let state = 'granted';
let benefit = env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID;
let expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
let providerError = false;
let wrongOrg = false;
let requests = 0;
const mockPolar = async (url, options) => {
  requests++;
  assert.equal(new URL(url).host, 'sandbox-api.polar.sh');
  const payload = JSON.parse(options.body);
  assert.equal(payload.key, key);
  assert.equal(payload.organization_id, env.MERGE_GUARD_POLAR_ORGANIZATION_ID);
  if (url.endsWith('/validate') && payload.activation_id !== activationId) {
    return new Response('{}', { status: 403 });
  }
  if (providerError) return new Response('{}', { status: 503 });
  const record = {
    status: state, organization_id: wrongOrg ? 'wrong-organization' : env.MERGE_GUARD_POLAR_ORGANIZATION_ID,
    benefit_id: benefit, expires_at: expiresAt
  };
  return new Response(JSON.stringify(url.endsWith('/activate')
    ? { id: activationId, license_key: record } : record), {
    status: 200, headers: { 'content-type': 'application/json' }
  });
};
let server;
try {
  const initial = await validateLicense({ env, fetchImpl: mockPolar, force: true });
  assert.equal(initial.plan, 'free');
  assert.equal(initial.status, 'not-activated');

  server = createProGateway({
    env, policyDirectory: path.resolve('policies/pro-reference'), supportDirectory,
    fetchImpl: mockPolar
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const client = { ...env, MERGE_GUARD_PRO_SANDBOX_SERVICE_URL: base };
  const initialRequests = requests;
  await assert.rejects(listPremiumPolicyPacks({ env: client, licenseFetch: mockPolar }),
    /currently granted/);
  assert.equal(requests, initialRequests, 'not activated must avoid Polar request');

  const activated = await activateLicense(key, { env, fetchImpl: mockPolar });
  assert.equal(activated.plan, 'pro');
  assert.equal(activated.validation, 'live');
  assert(!JSON.stringify(activated).includes(key));
  assert.equal(readLicenseState({ env }).activationId, activationId);

  const pro = await validateLicense({ env, fetchImpl: mockPolar, force: true });
  assert.equal(pro.plan, 'pro');
  assert.equal(hasCapability(pro.plan, CAPABILITIES.PRIORITY_SUPPORT), true);
  assert.equal(hasCapability(pro.plan, CAPABILITIES.SHARED_POLICY_DELIVERY), false);
  const catalog = await listPremiumPolicyPacks({ env: client, licenseFetch: mockPolar });
  assert(catalog.some(item => item.id === 'ci-trust-boundaries'));
  const selected = await fetchPremiumPolicyPack('dependency-provenance',
    { env: client, licenseFetch: mockPolar });
  assert.equal(selected.policy.identity.id, 'merge-guard.pro.dependency-provenance');
  const receipt = await submitPrioritySupport(requestFile, { env: client, licenseFetch: mockPolar });
  assert.equal(receipt.status, 'queued');
  assert.equal(fs.readdirSync(supportDirectory).length, 1);

  // Upgrade to Team and downgrade to Pro without reusing an old capability grant.
  benefit = env.MERGE_GUARD_POLAR_TEAM_BENEFIT_ID;
  const team = await validateLicense({ env, fetchImpl: mockPolar, force: true });
  assert.equal(team.plan, 'team');
  assert.equal(hasCapability(team.plan, CAPABILITIES.SHARED_POLICY_DELIVERY), true);
  assert((await listPremiumPolicyPacks({ env: client, licenseFetch: mockPolar })).length >= 3);
  benefit = env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID;
  const downgraded = await validateLicense({ env, fetchImpl: mockPolar, force: true });
  assert.equal(downgraded.plan, 'pro');
  assert.equal(hasCapability(downgraded.plan, CAPABILITIES.SHARED_POLICY_DELIVERY), false);

  // A later renewal remains eligible until its actual expiration.
  expiresAt = new Date(Date.now() + 120 * 86400000).toISOString();
  assert.equal((await validateLicense({ env, fetchImpl: mockPolar, force: true })).plan, 'pro');

  // Each definitive denial must prevent both client and independently verified gateway fulfillment.
  for (const status of ['canceled', 'revoked', 'disabled', 'expired', 'unknown']) {
    state = status;
    const denied = await validateLicense({ env, fetchImpl: mockPolar, force: true });
    assert.equal(denied.plan, 'free', status);
    await assert.rejects(
      listPremiumPolicyPacks({ env: client, licenseFetch: mockPolar }), /currently granted/,
      status + ' client should not fetch paid catalog'
    );
    const direct = await fetch(base + '/v1/pro/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key, organization_id: env.MERGE_GUARD_POLAR_ORGANIZATION_ID,
        activation_id: activationId
      })
    });
    assert.equal(direct.status, 403, status + ' gateway must deny');
    assert.equal(fs.readdirSync(supportDirectory).length, 1);
  }

  state = 'granted';
  expiresAt = new Date(Date.now() - 86400000).toISOString();
  assert.equal((await validateLicense({ env, fetchImpl: mockPolar, force: true })).status, 'expired');
  await assert.rejects(
    submitPrioritySupport(requestFile, { env: client, licenseFetch: mockPolar }),
    /currently granted/
  );

  expiresAt = null;
  benefit = '55555555-5555-4555-8555-555555555555';
  assert.equal((await validateLicense({ env, fetchImpl: mockPolar, force: true })).status, 'unmapped-benefit');
  await assert.rejects(listPremiumPolicyPacks({ env: client, licenseFetch: mockPolar }),
    /currently granted/);

  benefit = env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID;
  wrongOrg = true;
  assert.equal((await validateLicense({ env, fetchImpl: mockPolar, force: true })).status, 'wrong-organization');
  wrongOrg = false;

  // Reactivation restores a grant from the previously denied state.
  const restored = await activateLicense(key, { env, fetchImpl: mockPolar });
  assert.equal(restored.plan, 'pro');
  assert((await listPremiumPolicyPacks({ env: client, licenseFetch: mockPolar })).length >= 3);

  providerError = true;
  const outage = await validateLicense({ env, fetchImpl: mockPolar, force: true });
  // Offline grace may keep a local cached receipt, but never authorize remote paid fulfillment.
  assert(['offline-grace', 'unavailable'].includes(outage.status));
  await assert.rejects(listPremiumPolicyPacks({ env: client, licenseFetch: mockPolar }),
    /currently granted/);
  const deniedOutage = await fetch(base + '/v1/pro/catalog', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      key, organization_id: env.MERGE_GUARD_POLAR_ORGANIZATION_ID,
      activation_id: activationId
    })
  });
  assert.equal(deniedOutage.status, 403);
  providerError = false;
  assert((await listPremiumPolicyPacks({ env: client, licenseFetch: mockPolar })).length >= 3);

  const otherDevice = await fetch(base + '/v1/pro/catalog', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      key, organization_id: env.MERGE_GUARD_POLAR_ORGANIZATION_ID,
      activation_id: altActivation
    })
  });
  assert.equal(otherDevice.status, 403);
  const prod = {
    ...client,
    MERGE_GUARD_POLAR_ENVIRONMENT: 'production',
    MERGE_GUARD_PRO_SERVICE_URL: base,
    MERGE_GUARD_PRO_SANDBOX_SERVICE_URL: ''
  };
  await assert.rejects(listPremiumPolicyPacks({ env: prod, licenseFetch: mockPolar }), /HTTPS origin/);

  // Free scanning must remain independent of a Polar outage or key validity.
  const freeScan = spawnSync(process.execPath, ['src/cli.js', 'examples/sample.diff', '--json'], {
    cwd: process.cwd(), env: { ...env, MERGE_GUARD_POLAR_ORGANIZATION_ID: '',
      MERGE_GUARD_PRO_SANDBOX_SERVICE_URL: '' }, encoding: 'utf8', timeout: 20000
  });
  assert.equal(freeScan.status, 0, freeScan.stderr);
  assert.equal(typeof JSON.parse(freeScan.stdout).riskScore, 'number');

  assert.equal(fs.readdirSync(supportDirectory).length, 1, 'denied states must not create tickets');
  console.log('subscription lifecycle contracts passed');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  clearLicenseState({ env });
  fs.rmSync(root, { recursive: true, force: true });
}
