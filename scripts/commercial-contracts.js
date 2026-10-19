#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { readActivationKey } from '../src/commercial/cli.js';
import {
  CAPABILITIES,
  hasCapability,
  PLAN_FREE,
  PLAN_PRO,
  PLAN_TEAM,
  planForBenefitId
} from '../src/commercial/entitlements.js';
import {
  activateLicense,
  clearLicenseState,
  deactivateLicense,
  licenseFilePath,
  readLicenseState,
  writeLicenseState,
  validateLicense
} from '../src/commercial/license.js';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-commercial-'));
const env = {
  ...process.env,
  MERGE_GUARD_LICENSE_FILE: path.join(temp, 'license.json'),
  MERGE_GUARD_POLAR_ORGANIZATION_ID: '11111111-1111-4111-8111-111111111111',
  MERGE_GUARD_POLAR_PRO_BENEFIT_ID: '22222222-2222-4222-8222-222222222222',
  MERGE_GUARD_POLAR_TEAM_BENEFIT_ID: '33333333-3333-4333-8333-333333333333'
};

assert.equal(planForBenefitId(env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID, env), PLAN_PRO);
assert.equal(planForBenefitId(env.MERGE_GUARD_POLAR_TEAM_BENEFIT_ID, env), PLAN_TEAM);
assert.equal(planForBenefitId('other', env), PLAN_FREE);
assert.equal(hasCapability(PLAN_FREE, CAPABILITIES.CORE_SCAN), true);
assert.equal(hasCapability(PLAN_FREE, CAPABILITIES.PREMIUM_POLICY_DELIVERY), false);
assert.equal(hasCapability(PLAN_PRO, CAPABILITIES.PREMIUM_POLICY_DELIVERY), true);
assert.equal(hasCapability(PLAN_TEAM, CAPABILITIES.SHARED_POLICY_DELIVERY), true);

assert.equal(await readActivationKey(Readable.from(['MG-TEST-', 'PRO\\n'.replace('\\n', '\n')])), 'MG-TEST-PRO');
await assert.rejects(readActivationKey(Readable.from([''])), /exactly one nonempty/);
await assert.rejects(readActivationKey(Readable.from(['first\nsecond\n'])), /exactly one nonempty/);
await assert.rejects(readActivationKey(Readable.from(['x'.repeat(4097)])), /4096-byte maximum/);
const terminalInput = Readable.from(['MG-TEST-PRO']);
terminalInput.isTTY = true;
await assert.rejects(readActivationKey(terminalInput), /interactive input is not supported/);

const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() { return body; }
});

const proFetch = async (url) => {
  assert(url.includes('/customer-portal/license-keys/activate') || url.includes('/customer-portal/license-keys/validate'));
  return response(200, url.endsWith('/activate')
    ? {
        id: '44444444-4444-4444-8444-444444444444',
        license_key: {
          status: 'granted',
          benefit_id: env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID,
          expires_at: null
        }
      }
    : {
        status: 'granted',
        benefit_id: env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID,
        expires_at: null
      });
};

const activated = await activateLicense('MG-TEST-PRO', { env, fetchImpl: proFetch, label: 'test-device' });
assert.equal(activated.plan, PLAN_PRO);
assert.equal('licenseKey' in activated, false, 'public commercial state must not expose the full license key');
assert.equal(fs.existsSync(licenseFilePath(env)), true);
assert.equal(readLicenseState({ env }).licenseKey, 'MG-TEST-PRO');
const licenseFile = licenseFilePath(env);
const originalStateBytes = fs.readFileSync(licenseFile, 'utf8');
assert.throws(() => writeLicenseState({ invalid: 1n }, { env }), /BigInt/);
assert.equal(fs.readFileSync(licenseFile, 'utf8'), originalStateBytes);
assert.equal(fs.readdirSync(temp).filter(name => name.endsWith('.tmp')).length, 0);
if (process.platform !== 'win32') {
  assert.equal(fs.statSync(licenseFile).mode & 0o777, 0o600, 'license file should be owner-readable only');
}

const cached = await validateLicense({ env, fetchImpl: async () => { throw new Error('should not call network'); } });
assert.equal(cached.plan, PLAN_PRO);
assert.equal(cached.validation, 'cached');

// Reusing a license on the same device must revalidate, not consume a new activation.
const reused = await activateLicense('MG-TEST-PRO', {
  env,
  fetchImpl: async (url) => {
    assert(url.endsWith('/validate'), 'existing device must not activate again');
    return response(200, {
      status: 'granted',
      benefit_id: env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID,
      expires_at: null
    });
  }
});
assert.equal(reused.plan, PLAN_PRO);
await assert.rejects(
  activateLicense('ANOTHER-LICENSE', {
    env,
    fetchImpl: async () => { throw new Error('must reject switching before network request'); }
  }),
  /deactivate it before switching keys/
);
assert.equal(readLicenseState({ env }).licenseKey, 'MG-TEST-PRO');

const teamFetch = async () => response(200, {
  status: 'granted',
  benefit_id: env.MERGE_GUARD_POLAR_TEAM_BENEFIT_ID,
  expires_at: null
});
const team = await validateLicense({ env, fetchImpl: teamFetch, force: true });
assert.equal(team.plan, PLAN_TEAM);

const revokedFetch = async () => response(200, {
  status: 'revoked',
  benefit_id: env.MERGE_GUARD_POLAR_TEAM_BENEFIT_ID,
  expires_at: null
});
const revoked = await validateLicense({ env, fetchImpl: revokedFetch, force: true });
assert.equal(revoked.plan, PLAN_FREE);
assert.equal(revoked.status, 'revoked');

writeOldState();
const offline = await validateLicense({
  env,
  fetchImpl: async () => { throw new Error('network unavailable'); },
  force: true,
  now: () => Date.parse('2026-10-16T12:00:00.000Z')
});
assert.equal(offline.plan, PLAN_PRO);
assert.equal(offline.status, 'offline-grace');


const testNow = () => Date.parse('2026-10-16T12:00:00.000Z');
const cachedProState = (overrides = {}) => ({
  provider: 'polar',
  plan: PLAN_PRO,
  status: 'granted',
  licenseKey: 'MG-TEST-PRO',
  benefitId: env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID,
  lastValidatedAt: '2026-10-16T11:00:00.000Z',
  ...overrides
});
const offlineFetch = async () => { throw new Error('network unavailable'); };

// A cached entitlement is never valid past its actual expiration, even during
// the 24-hour cache or 7-day offline window.
writeLicenseState(cachedProState({ expiresAt: '2026-10-16T11:30:00.000Z' }), { env });
const expiredCached = await validateLicense({ env, fetchImpl: offlineFetch, now: testNow });
assert.equal(expiredCached.plan, PLAN_FREE);
const expiredOffline = await validateLicense({ env, fetchImpl: offlineFetch, force: true, now: testNow });
assert.equal(expiredOffline.plan, PLAN_FREE);

// A future validation timestamp must not extend the cache/grace periods.
writeLicenseState(cachedProState({ lastValidatedAt: '2026-10-17T11:00:00.000Z' }), { env });
const futureCache = await validateLicense({ env, fetchImpl: offlineFetch, now: testNow });
assert.equal(futureCache.plan, PLAN_FREE);
assert.notEqual(futureCache.validation, 'cached');

// An override license key must never borrow a different key's paid cache.
writeLicenseState(cachedProState(), { env });
const override = await validateLicense({
  env: { ...env, MERGE_GUARD_LICENSE_KEY: 'UNRELATED-KEY' },
  fetchImpl: offlineFetch,
  now: testNow
});
assert.equal(override.plan, PLAN_FREE);

// The same injected time governs live expiration validation.
const expiredLive = await validateLicense({
  env, force: true, now: testNow,
  fetchImpl: async () => response(200, {
    status: 'granted',
    benefit_id: env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID,
    expires_at: '2026-10-16T11:59:59.000Z'
  })
});
assert.equal(expiredLive.plan, PLAN_FREE);
assert.equal(expiredLive.status, 'expired');

// Definitive 4xx license rejection revokes cached access immediately.
// Transient 5xx errors may still use bounded offline grace.
writeLicenseState(cachedProState(), { env });
const rejected = await validateLicense({
  env, force: true, now: testNow,
  fetchImpl: async () => response(403, { detail: 'invalid license' })
});
assert.equal(rejected.plan, PLAN_FREE);
assert.equal(rejected.status, 'rejected');
assert.equal(readLicenseState({ env }).plan, PLAN_FREE);
const stillRejected = await validateLicense({ env, fetchImpl: offlineFetch, now: testNow });
assert.equal(stillRejected.plan, PLAN_FREE);
writeLicenseState(cachedProState(), { env });
const serverOutage = await validateLicense({
  env, force: true, now: testNow,
  fetchImpl: async () => response(503, { detail: 'temporary server error' })
});
assert.equal(serverOutage.plan, PLAN_PRO);
assert.equal(serverOutage.status, 'offline-grace');

// Malformed expiration timestamps must fail closed rather than grant access.
writeLicenseState(cachedProState({ expiresAt: 'not-a-date' }), { env });
const invalidExpiry = await validateLicense({ env, fetchImpl: offlineFetch, now: testNow });
assert.equal(invalidExpiry.plan, PLAN_FREE);

// An environment override must never deactivate an unrelated stored activation.
writeLicenseState(cachedProState({ activationId: 'stored-device-activation' }), { env });
let deactivationCalls = 0;
await deactivateLicense({
  env: { ...env, MERGE_GUARD_LICENSE_KEY: 'UNRELATED-ENV-KEY' },
  fetchImpl: async (url, options) => {
    deactivationCalls += 1;
    assert(url.endsWith('/deactivate'));
    const body = JSON.parse(options.body);
    assert.equal(body.key, 'MG-TEST-PRO');
    assert.equal(body.activation_id, 'stored-device-activation');
    return response(204, null);
  }
});
assert.equal(deactivationCalls, 1);
assert.equal(readLicenseState({ env }), null);

clearLicenseState({ env });
assert.equal(readLicenseState({ env }), null);

const planRun = spawnSync(process.execPath, ['src/cli.js', 'plan'], {
  cwd: process.cwd(),
  env,
  encoding: 'utf8'
});
assert.equal(planRun.status, 0, planRun.stderr);
assert.match(planRun.stdout, /Merge Guard Free/);
assert.match(planRun.stdout, /Plan: Free/);

const badPlanRun = spawnSync(process.execPath, ['src/cli.js', 'plan', 'unexpected'], {
  cwd: process.cwd(),
  env,
  encoding: 'utf8'
});
assert.equal(badPlanRun.status, 1);
assert.match(badPlanRun.stderr, /plan does not accept an argument/);

const invalidStdinRun = spawnSync(process.execPath, ['src/cli.js', 'activate', '--stdin'], {
  cwd: process.cwd(),
  env,
  input: 'first\nsecond\n',
  encoding: 'utf8'
});
assert.equal(invalidStdinRun.status, 1);
assert.match(invalidStdinRun.stderr, /exactly one nonempty license key/);
assert.doesNotMatch(invalidStdinRun.stderr, /first|second/);

const missingConfigRun = spawnSync(process.execPath, ['src/cli.js', 'activate', '--stdin'], {
  cwd: process.cwd(),
  env: { ...env, MERGE_GUARD_POLAR_ORGANIZATION_ID: '' },
  input: 'MG-TEST-PRO\n',
  encoding: 'utf8'
});
assert.equal(missingConfigRun.status, 1);
assert.match(missingConfigRun.stderr, /ORGANIZATION_ID is not configured/);
assert.doesNotMatch(missingConfigRun.stderr, /MG-TEST-PRO/);
fs.rmSync(temp, { recursive: true, force: true });
console.log('commercial entitlement contracts passed');

function writeOldState() {
  fs.writeFileSync(licenseFilePath(env), JSON.stringify({
    provider: 'polar',
    plan: PLAN_PRO,
    status: 'granted',
    licenseKey: 'MG-TEST-PRO',
    benefitId: env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID,
    lastValidatedAt: '2026-10-14T12:00:00.000Z'
  }));
}
