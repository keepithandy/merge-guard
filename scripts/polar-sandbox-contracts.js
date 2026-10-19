#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { POLAR_BUILD_CONFIG, resolveCommercialConfig } from '../src/commercial/config.js';
import { PLAN_FREE, PLAN_PRO, PLAN_TEAM, planForBenefitId } from '../src/commercial/entitlements.js';
import { activateLicense, deactivateLicense, validateLicense, readLicenseState, writeLicenseState, licenseFilePath, clearLicenseState } from '../src/commercial/license.js';
import { runCommercialCommand } from '../src/commercial/cli.js';

const temp = path.resolve('.cache', `polar-sandbox-${randomUUID()}`);
fs.mkdirSync(temp, { recursive: true });
const production = {
  MERGE_GUARD_LICENSE_FILE: path.join(temp, 'license.json'),
  MERGE_GUARD_POLAR_ORGANIZATION_ID: '11111111-1111-4111-8111-111111111111',
  MERGE_GUARD_POLAR_PRO_BENEFIT_ID: '22222222-2222-4222-8222-222222222222',
  MERGE_GUARD_POLAR_TEAM_BENEFIT_ID: '33333333-3333-4333-8333-333333333333'
};
const sandbox = {
  ...production,
  MERGE_GUARD_POLAR_ENVIRONMENT: 'sandbox',
  MERGE_GUARD_POLAR_ORGANIZATION_ID: '84897a3c-12b6-40b4-a96b-9e7b1681a352',
  MERGE_GUARD_POLAR_PRO_BENEFIT_ID: 'bf34f3a6-a63a-4ccc-9d0e-882f5426dfa9',
  MERGE_GUARD_POLAR_TEAM_BENEFIT_ID: '55555555-5555-4555-8555-555555555555'
};
const at = Date.parse('2026-10-19T12:00:00Z');
const now = () => at;
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, async json() { return body; } });
const offline = async () => { throw new Error('transport reflected MG-FAKE-SECRET'); };
const neverFetch = async () => { assert.fail('unexpected licensing request'); };
const stateFor = (env, extra = {}) => ({
  provider: 'polar', environment: resolveCommercialConfig(env).environment,
  organizationId: env.MERGE_GUARD_POLAR_ORGANIZATION_ID,
  licenseKey: 'MG-FAKE-SECRET', activationId: '44444444-4444-4444-8444-444444444444',
  benefitId: env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID,
  plan: PLAN_PRO, status: 'granted', lastValidatedAt: new Date(at - 3600000).toISOString(),
  ...extra
});
const liveBody = (env, extra = {}) => ({
  status: 'granted', organization_id: env.MERGE_GUARD_POLAR_ORGANIZATION_ID,
  benefit_id: env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID, expires_at: null, ...extra
});

try {
  assert.equal(resolveCommercialConfig({}).environment, 'production');
  assert.equal(resolveCommercialConfig({}).apiBaseUrl, 'https://api.polar.sh');
  assert.equal(resolveCommercialConfig({}).organizationId, POLAR_BUILD_CONFIG.organizationId);
  assert.equal(resolveCommercialConfig({ MERGE_GUARD_POLAR_ENVIRONMENT: 'production' }).proBenefitId, POLAR_BUILD_CONFIG.proBenefitId);
  const sandboxDefaults = resolveCommercialConfig({ MERGE_GUARD_POLAR_ENVIRONMENT: 'sandbox' });
  for (const field of ['organizationId', 'proBenefitId', 'teamBenefitId', 'proCheckoutUrl', 'teamCheckoutUrl', 'customerPortalUrl']) {
    assert.equal(sandboxDefaults[field], '', `Sandbox must not inherit ${field}`);
  }
  assert.equal(sandboxDefaults.apiBaseUrl, 'https://sandbox-api.polar.sh');
  assert.equal(licenseFilePath(production), production.MERGE_GUARD_LICENSE_FILE);
  assert.equal(licenseFilePath(sandbox), `${production.MERGE_GUARD_LICENSE_FILE}.sandbox`);
  assert.notEqual(licenseFilePath({}), licenseFilePath({ MERGE_GUARD_POLAR_ENVIRONMENT: 'sandbox' }));

  for (const invalid of ['Sandbox', 'test', ' production', 'sandbox ', 'toString', '__proto__', 'https://sandbox-api.polar.sh', 'https://attacker.example', 'http://api.polar.sh']) {
    const env = { ...sandbox, MERGE_GUARD_POLAR_ENVIRONMENT: invalid };
    assert.throws(() => resolveCommercialConfig(env), /must be production or sandbox/);
    assert.throws(() => licenseFilePath(env), /must be production or sandbox/);
    await assert.rejects(activateLicense('MG-FAKE-SECRET', { env, fetchImpl: neverFetch }), /must be production or sandbox/);
    await assert.rejects(validateLicense({ env, fetchImpl: neverFetch }), /must be production or sandbox/);
    await assert.rejects(deactivateLicense({ env, fetchImpl: neverFetch }), /must be production or sandbox/);
  }

  assert.equal(planForBenefitId(sandbox.MERGE_GUARD_POLAR_PRO_BENEFIT_ID, production), PLAN_FREE);
  assert.equal(planForBenefitId(production.MERGE_GUARD_POLAR_PRO_BENEFIT_ID, sandbox), PLAN_FREE);

  for (const env of [production, sandbox]) {
    const config = resolveCommercialConfig(env);
    clearLicenseState({ env });
    assert.equal((await validateLicense({ env, fetchImpl: neverFetch })).plan, PLAN_FREE);
    assert.equal((await validateLicense({ env: { ...env, MERGE_GUARD_LICENSE_KEY: 'MG-FAKE-SECRET', MERGE_GUARD_POLAR_ORGANIZATION_ID: '' }, fetchImpl: neverFetch })).status, 'not-configured');

    const requests = [];
    const fetchImpl = async (url, options) => {
      assert.equal(options.redirect, 'error', 'license POSTs must not follow redirects');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.authorization, undefined, 'no organization access token');
      const body = JSON.parse(options.body);
      assert.equal(body.organization_id, env.MERGE_GUARD_POLAR_ORGANIZATION_ID);
      requests.push({ url, body });
      if (url.endsWith('/activate')) return response(200, { id: stateFor(env).activationId, license_key: liveBody(env) });
      if (url.endsWith('/deactivate')) return response(204);
      return response(200, liveBody(env));
    };
    // Unsupported URL variables cannot redirect license keys to a custom host.
    const overridden = { ...env, MERGE_GUARD_POLAR_API_URL: 'http://attacker.example', MERGE_GUARD_POLAR_BASE_URL: 'https://attacker.example' };
    const activated = await activateLicense('MG-FAKE-SECRET', { env: overridden, fetchImpl, label: 'fixture-device' });
    assert.equal(activated.plan, PLAN_PRO);
    assert(!JSON.stringify(activated).includes('MG-FAKE-SECRET'));
    assert.equal(requests[0].url, `${config.apiBaseUrl}/v1/customer-portal/license-keys/activate`);
    assert.equal(requests[0].body.label, 'fixture-device');
    assert.equal(readLicenseState({ env }).environment, config.environment);
    assert.equal(readLicenseState({ env }).organizationId, config.organizationId);
    assert.equal((await validateLicense({ env, fetchImpl: neverFetch })).validation, 'cached');
    await validateLicense({ env, fetchImpl, force: true });
    assert.equal(requests[1].url, `${config.apiBaseUrl}/v1/customer-portal/license-keys/validate`);
    assert.equal(requests[1].body.activation_id, stateFor(env).activationId);
    await deactivateLicense({ env, fetchImpl });
    assert.equal(requests[2].url, `${config.apiBaseUrl}/v1/customer-portal/license-keys/deactivate`);
    assert.equal(requests[2].body.key, 'MG-FAKE-SECRET');
    assert.equal(readLicenseState({ env }), null);

    // Team, unknown benefits, denied statuses, expiration and bounded grace.
    for (const [body, plan] of [
      [liveBody(env, { benefit_id: env.MERGE_GUARD_POLAR_TEAM_BENEFIT_ID }), PLAN_TEAM],
      [liveBody(env, { benefit_id: 'unmapped-benefit' }), PLAN_FREE],
      [liveBody(env, { organization_id: 'other-organization' }), PLAN_FREE],
      ...['revoked', 'disabled', 'canceled', 'unknown'].map(status => [liveBody(env, { status }), PLAN_FREE]),
      [liveBody(env, { expires_at: new Date(at - 1).toISOString() }), PLAN_FREE],
      [liveBody(env, { expires_at: 'invalid' }), PLAN_FREE]
    ]) {
      writeLicenseState(stateFor(env), { env });
      const result = await validateLicense({ env, now, force: true, fetchImpl: async () => response(200, body) });
      assert.equal(result.plan, plan);
      assert.equal((await validateLicense({ env, now, fetchImpl: offline })).plan, plan);
    }
    for (const status of [400, 401, 403, 404, 422, 429, 500, 503]) {
      writeLicenseState(stateFor(env), { env });
      const result = await validateLicense({ env, now, force: true, fetchImpl: async () => response(status, { detail: 'MG-FAKE-SECRET' }) });
      assert.equal(result.plan, status === 429 || status >= 500 ? PLAN_PRO : PLAN_FREE);
      assert(!JSON.stringify(result).includes('MG-FAKE-SECRET'), 'provider errors must not expose keys');
      assert(!readLicenseState({ env }).warning?.includes('MG-FAKE-SECRET'));
    }
    for (const extra of [
      { lastValidatedAt: new Date(at - 2 * 86400000).toISOString() },
      { lastValidatedAt: new Date(at - 8 * 86400000).toISOString() },
      { lastValidatedAt: new Date(at + 1).toISOString() },
      { expiresAt: new Date(at - 1).toISOString() }
    ]) {
      writeLicenseState(stateFor(env, extra), { env });
      const result = await validateLicense({ env, now, fetchImpl: offline });
      assert.equal(result.plan, extra.lastValidatedAt === new Date(at - 2 * 86400000).toISOString() ? PLAN_PRO : PLAN_FREE);
      assert(!JSON.stringify(result).includes('MG-FAKE-SECRET'));
    }

    // A new key must never borrow an old activation or paid cache.
    writeLicenseState(stateFor(env), { env });
    const changedKey = { ...env, MERGE_GUARD_LICENSE_KEY: 'MG-OTHER-FAKE' };
    assert.equal((await validateLicense({ env: changedKey, now, fetchImpl: offline })).plan, PLAN_FREE);
    await validateLicense({ env: changedKey, now, force: true, fetchImpl: async (_url, options) => {
      assert.equal(JSON.parse(options.body).activation_id, undefined);
      return response(200, liveBody(env));
    } });
    writeLicenseState(stateFor(env), { env });
    await deactivateLicense({ env: changedKey, fetchImpl: neverFetch });
    assert.equal(readLicenseState({ env }), null);

    for (const fetchFailure of [offline, async () => response(403, { detail: 'MG-FAKE-SECRET' }), async () => { throw new DOMException('MG-FAKE-SECRET', 'AbortError'); }]) {
      clearLicenseState({ env });
      await assert.rejects(activateLicense('MG-FAKE-SECRET', { env, fetchImpl: fetchFailure }), error => !error.message.includes('MG-FAKE-SECRET'));
      assert.equal(readLicenseState({ env }), null);
      writeLicenseState(stateFor(env), { env });
      await assert.rejects(deactivateLicense({ env, fetchImpl: fetchFailure }), error => !error.message.includes('MG-FAKE-SECRET'));
      assert.equal(readLicenseState({ env }), null, 'failed deactivation still clears local state');
    }
    await assert.rejects(activateLicense('MG-FAKE-SECRET', { env, fetchImpl: async () => response(200, { license_key: liveBody(env, { benefit_id: 'unknown' }) }) }), /not mapped/);
    assert.equal(readLicenseState({ env }), null);
  }

  // Copying either paid cache into the other file cannot carry a key, activation,
  // or entitlement across environments, even when benefit mappings are identical.
  for (const [source, target] of [[production, sandbox], [sandbox, production]]) {
    const targetWithSameBenefit = { ...target, MERGE_GUARD_POLAR_PRO_BENEFIT_ID: source.MERGE_GUARD_POLAR_PRO_BENEFIT_ID };
    writeLicenseState(stateFor(source), { env: source });
    fs.copyFileSync(licenseFilePath(source), licenseFilePath(target));
    assert.equal(readLicenseState({ env: targetWithSameBenefit }), null);
    for (const force of [false, true]) assert.equal((await validateLicense({ env: targetWithSameBenefit, now, force, fetchImpl: neverFetch })).plan, PLAN_FREE);
    assert.equal((await validateLicense({ env: { ...targetWithSameBenefit, MERGE_GUARD_LICENSE_KEY: 'MG-FAKE-SECRET' }, now, fetchImpl: offline })).plan, PLAN_FREE);
    await deactivateLicense({ env: targetWithSameBenefit, fetchImpl: neverFetch });
    assert(fs.existsSync(licenseFilePath(source)), 'clearing one environment preserves the other file');
  }
  writeLicenseState(stateFor(sandbox), { env: sandbox });
  const otherOrg = { ...sandbox, MERGE_GUARD_POLAR_ORGANIZATION_ID: production.MERGE_GUARD_POLAR_ORGANIZATION_ID };
  assert.equal(readLicenseState({ env: otherOrg }), null);
  assert.equal((await validateLicense({ env: otherOrg, now, fetchImpl: neverFetch })).plan, PLAN_FREE);

  const legacy = stateFor(production);
  delete legacy.environment;
  delete legacy.organizationId;
  writeLicenseState(legacy, { env: production });
  writeLicenseState(legacy, { env: sandbox });
  assert.equal(readLicenseState({ env: sandbox }), null, 'legacy untagged state is production only');
  assert.equal((await validateLicense({ env: sandbox, now, fetchImpl: neverFetch })).plan, PLAN_FREE);
  assert.equal((await validateLicense({ env: production, now, fetchImpl: offline })).plan, PLAN_FREE, 'legacy cache needs live revalidation');
  assert.equal((await validateLicense({ env: production, now, fetchImpl: async () => response(200, liveBody(production)) })).plan, PLAN_PRO);
  assert.equal(readLicenseState({ env: production }).environment, 'production');

  for (const contents of ['not json', '[]', 'null']) {
    fs.writeFileSync(licenseFilePath(sandbox), contents);
    assert.equal(readLicenseState({ env: sandbox }), null);
    assert.equal((await validateLicense({ env: sandbox, fetchImpl: neverFetch })).plan, PLAN_FREE);
  }

  // Exercise real command dispatch without any live provider requests.
  const previousFetch = globalThis.fetch;
  const previousLog = console.log;
  const messages = [];
  try {
    globalThis.fetch = async (...args) => { assert.equal(args[0].startsWith('https://sandbox-api.polar.sh/'), true); return response(200, { id: stateFor(sandbox).activationId, license_key: liveBody(sandbox) }); };
    console.log = message => messages.push(String(message));
    await runCommercialCommand(['activate', 'MG-FAKE-SECRET'], { env: sandbox });
    globalThis.fetch = async () => response(200, liveBody(sandbox, { status: 'revoked' }));
    await runCommercialCommand(['license'], { env: sandbox });
    await runCommercialCommand(['license', 'clear'], { env: sandbox });
    await runCommercialCommand(['plan'], { env: sandbox });
    assert(messages.some(message => message.includes('Sandbox')));
    assert(messages.some(message => message.includes('Plan: Pro')));
    assert(messages.some(message => message.includes('Plan: Free')));
    assert(!messages.join('\n').includes('MG-FAKE-SECRET'));
  } finally {
    globalThis.fetch = previousFetch;
    console.log = previousLog;
  }
  for (const selection of ['production', 'sandbox', 'invalid-environment']) {
    const script = `globalThis.fetch = () => { console.error('UNEXPECTED_NETWORK'); throw Error('offline'); }; process.argv = [process.execPath, 'src/cli.js', '--json', 'examples/sample.diff']; await import('./src/cli.js');`;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8', env: { ...process.env, ...sandbox, MERGE_GUARD_POLAR_ENVIRONMENT: selection, MERGE_GUARD_LICENSE_KEY: 'MG-FAKE-SECRET' }
    });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotThrow(() => JSON.parse(result.stdout));
    assert(!`${result.stdout}${result.stderr}`.includes('UNEXPECTED_NETWORK'));
    assert(!result.stdout.includes('MG-FAKE-SECRET'));
  }
  console.log('Polar production/Sandbox isolation and lifecycle contracts passed (mocked provider; no live activation)');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
