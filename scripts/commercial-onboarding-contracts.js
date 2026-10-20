#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { inspectCommercialSetup, formatCommercialSetup, safeCustomerPortalUrl }
  from '../src/commercial/onboarding.js';

const env = {
  MERGE_GUARD_POLAR_ENVIRONMENT: 'sandbox',
  MERGE_GUARD_POLAR_ORGANIZATION_ID: 'organization-private',
  MERGE_GUARD_POLAR_PRO_BENEFIT_ID: 'pro-private',
  MERGE_GUARD_POLAR_TEAM_BENEFIT_ID: '',
  MERGE_GUARD_LICENSE_KEY: 'SECRET-LICENSE-NEVER-PRINT',
  MERGE_GUARD_POLAR_CUSTOMER_PORTAL_URL: 'https://sandbox.polar.sh/customer/portal'
};
const stored = { licenseKey: 'SECRET-LICENSE-NEVER-PRINT', activationId: 'activation-private' };
const inspected = inspectCommercialSetup({ env, readState: () => stored });
assert.equal(inspected.environment, 'sandbox');
assert.equal(inspected.organizationConfigured, true);
assert.equal(inspected.proBenefitConfigured, true);
assert.equal(inspected.teamBenefitConfigured, false);
assert.equal(inspected.localActivation, 'stored-unverified');
assert.equal(inspected.productionCheckoutEnabled, false);
assert.equal(inspected.customerPortal, 'configured');
const formatted = formatCommercialSetup(inspected);
assert.match(formatted, /stored-unverified \(not a grant\)/);
assert(!formatted.includes('SECRET-LICENSE-NEVER-PRINT'));
assert(!formatted.includes('organization-private'));
assert(!formatted.includes('pro-private'));

assert.equal(safeCustomerPortalUrl(''), null);
assert.equal(safeCustomerPortalUrl('https://example.com/account'), 'https://example.com/account');
for (const url of [
  'http://example.com',
  'https://user:pass@example.com/account',
  'https://example.com/account?token=secret',
  'https://example.com/account#secret',
  'javascript:alert(1)',
  'https://example.com/path\nwith-control'
]) assert.throws(() => safeCustomerPortalUrl(url), /portal URL/);

const noPortal = inspectCommercialSetup({
  env: { ...env, MERGE_GUARD_POLAR_CUSTOMER_PORTAL_URL: '' },
  readState: () => null
});
assert.equal(noPortal.customerPortal, 'not-configured');
assert.equal(noPortal.localActivation, 'not-activated');
assert.equal(inspectCommercialSetup({
  env: { ...env, MERGE_GUARD_POLAR_CUSTOMER_PORTAL_URL: 'http://insecure.local' },
  readState: () => null
}).customerPortal, 'invalid');

const cliEnv = {
  ...process.env, ...env,
  MERGE_GUARD_LICENSE_FILE: '/unlikely-merge-guard-onboarding-file',
  MERGE_GUARD_POLAR_CUSTOMER_PORTAL_URL: 'https://example.com/customer/'
};
function run(...args) {
  return spawnSync(process.execPath, ['src/cli.js', ...args], {
    env: cliEnv, cwd: process.cwd(), encoding: 'utf8', timeout: 20000
  });
}
const json = run('onboard', '--json');
assert.equal(json.status, 0, json.stderr);
const out = JSON.parse(json.stdout);
assert.equal(out.environment, 'sandbox');
assert.equal(out.customerPortal, 'configured');
assert.equal(out.localActivation, 'not-activated');
assert(!json.stdout.includes('SECRET-LICENSE-NEVER-PRINT'));
assert(!json.stdout.includes('organization-private'));
assert(!json.stdout.includes('/unlikely-merge-guard-onboarding-file'));
assert.equal(run('onboard', 'unknown').status, 1);
const account = run('account');
assert.equal(account.status, 0, account.stderr);
assert.match(account.stdout, /https:\/\/example.com\/customer\//);
const invalid = spawnSync(process.execPath, ['src/cli.js', 'account'], {
  env: { ...cliEnv, MERGE_GUARD_POLAR_CUSTOMER_PORTAL_URL: 'https://user:secret@example.com' },
  cwd: process.cwd(), encoding: 'utf8', timeout: 20000
});
assert.equal(invalid.status, 1);
assert(!invalid.stderr.includes('secret@example.com'));
console.log('commercial onboarding contracts passed');
