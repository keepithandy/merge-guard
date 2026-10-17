#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
  licenseFilePath,
  readLicenseState,
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

const cached = await validateLicense({ env, fetchImpl: async () => { throw new Error('should not call network'); } });
assert.equal(cached.plan, PLAN_PRO);
assert.equal(cached.validation, 'cached');

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

clearLicenseState({ env });
assert.equal(readLicenseState({ env }), null);
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
