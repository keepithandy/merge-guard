#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { activateLicense, deactivateLicense, validateLicense, writeLicenseState, readLicenseState, clearLicenseState, licenseFilePath } from '../src/commercial/license.js';
import { currentLicenseSummary } from '../src/commercial/cli.js';

// All credentials and provider results in this suite are synthetic.
const root = path.resolve('.cache', `license-persistence-${randomUUID()}`);
fs.mkdirSync(root, { recursive: true });
const at = Date.parse('2026-10-20T12:00:00Z');
const now = () => at;
const secret = 'FAKE-LICENSE-NEVER-PRINT';
const activation = 'FAKE-ACTIVATION-NEVER-PRINT';
let cases = 0;
let childProcesses = 0;
let serial = 0;
const environment = (selection = 'production', file = `case-${serial++}.json`) => ({
  MERGE_GUARD_LICENSE_FILE: path.join(root, file), MERGE_GUARD_LICENSE_KEY: '',
  MERGE_GUARD_POLAR_ENVIRONMENT: selection,
  MERGE_GUARD_POLAR_ORGANIZATION_ID: `${selection}-fixture-org`,
  MERGE_GUARD_POLAR_PRO_BENEFIT_ID: `${selection}-fixture-pro`,
  MERGE_GUARD_POLAR_TEAM_BENEFIT_ID: `${selection}-fixture-team`
});
const stateFor = (env, extra = {}) => ({
  provider: 'polar', environment: env.MERGE_GUARD_POLAR_ENVIRONMENT,
  organizationId: env.MERGE_GUARD_POLAR_ORGANIZATION_ID,
  licenseKey: secret, activationId: activation, plan: 'pro', status: 'granted',
  benefitId: env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID,
  lastValidatedAt: new Date(at).toISOString(), ...extra
});
const bodyFor = (env, extra = {}) => ({
  status: 'granted', organization_id: env.MERGE_GUARD_POLAR_ORGANIZATION_ID,
  benefit_id: env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID, expires_at: null, ...extra
});
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const offline = async () => { throw new Error(secret + activation); };
const grant = (env, options = {}) => validateLicense({ env, now, force: true, fetchImpl: async () => response(200, bodyFor(env)), ...options });
const safe = (value) => {
  assert(!JSON.stringify(value).includes(secret));
  assert(!JSON.stringify(value).includes(activation));
};
const deniedResponses = [
  ...[400, 401, 403, 404, 422].map(status => [String(status), () => response(status, { detail: secret })]),
  ...['revoked', 'disabled', 'canceled', 'expired'].map(status => [status, env => response(200, bodyFor(env, { status }))]),
  ['wrong-organization', env => response(200, bodyFor(env, { organization_id: 'other-org' }))],
  ['unmapped-benefit', env => response(200, bodyFor(env, { benefit_id: 'other-benefit' }))],
  ['expired-time', env => response(200, bodyFor(env, { expires_at: new Date(at - 1).toISOString() }))],
  ['invalid-expiry', env => response(200, bodyFor(env, { expires_at: 'invalid' }))],
  ['numeric-expiry', env => response(200, bodyFor(env, { expires_at: 0 }))],
  ['unknown-status', env => response(200, bodyFor(env, { status: secret }))]
];

async function faults(mode, env, callback) {
  const original = { openSync: fs.openSync, writeFileSync: fs.writeFileSync, renameSync: fs.renameSync, rmSync: fs.rmSync, fsyncSync: fs.fsyncSync };
  const file = licenseFilePath(env);
  const failed = () => { throw Object.assign(new Error(secret + activation), { code: 'EPERM', status: 503 }); };
  const calls = { writes: 0, deletes: 0 };
  if (mode === 'read-only') fs.chmodSync(file, 0o444);
  fs.openSync = (...args) => {
    calls.writes += 1;
    if (mode === 'open') throw Object.assign(new Error(secret), { code: 'EACCES' });
    if (mode === 'both') failed();
    return original.openSync(...args);
  };
  fs.writeFileSync = (...args) => mode === 'write' ? failed() : original.writeFileSync(...args);
  fs.fsyncSync = (...args) => mode === 'sync' ? failed() : original.fsyncSync(...args);
  fs.renameSync = (...args) => mode === 'replace' ? failed() : original.renameSync(...args);
  fs.rmSync = (...args) => {
    if (args[0] === file) {
      calls.deletes += 1;
      if (['delete', 'both'].includes(mode)) failed();
    }
    return original.rmSync(...args);
  };
  try { return await callback(calls); }
  finally {
    Object.assign(fs, original);
    if (fs.existsSync(file)) fs.chmodSync(file, 0o600);
  }
}

try {
  for (const selection of ['production', 'sandbox']) {
    for (const [name, deniedResponse] of deniedResponses) {
      for (const mode of ['normal', 'open', 'write', 'sync', 'replace', 'delete', 'both', 'read-only']) {
        const env = environment(selection);
        writeLicenseState(stateFor(env), { env });
        await grant(env);
        await faults(mode, env, async calls => {
          const denied = await validateLicense({ env, now, force: true, fetchImpl: async () => deniedResponse(env) });
          assert.equal(denied.plan, 'free', `${selection}/${name}/${mode}`);
          safe(denied);
          assert.equal((await validateLicense({ env, now, fetchImpl: offline })).plan, 'free', 'denial cannot resume cache or grace');
          if (mode === 'both') {
            assert.equal(readLicenseState({ env }).plan, 'pro', 'original paid bytes survive both filesystem failures');
            assert(calls.writes >= 1 && calls.deletes >= 1, 'attempt both replacement and removal');
            assert.match(denied.warning, /could not be saved or removed/);
          }
          if (['open', 'write', 'sync', 'replace'].includes(mode)) assert.equal(readLicenseState({ env }), null, 'remove stale cache when saving fails');
          if (mode === 'delete') assert.equal(readLicenseState({ env }).plan, 'free', 'saved denial is sufficient when deletion is unavailable');
        });
        cases += 1;
      }
    }

    const env = environment(selection);
    writeLicenseState(stateFor(env), { env });
    assert.equal(currentLicenseSummary({ env }).plan, 'free', 'disk summary is unverified');
    assert.equal((await validateLicense({ env, now, fetchImpl: offline })).plan, 'free', 'cold process cannot authorize a disk grant');
    assert.equal((await grant(env)).plan, 'pro');
    assert.equal((await validateLicense({ env, now, fetchImpl: () => assert.fail('warm session used network') })).validation, 'cached');
    for (const status of [429, 500, 503]) {
      const result = await validateLicense({ env, now, force: true, fetchImpl: async () => response(status, { detail: secret }) });
      assert.equal(result.plan, 'pro');
      assert.equal(result.status, 'offline-grace');
      safe(result);
    }
    for (const [days, expected] of [[2, 'pro'], [7, 'pro'], [8, 'free']]) {
      assert.equal((await validateLicense({ env, now: () => at + days * 86400000, fetchImpl: offline })).plan, expected);
    }
    assert.equal((await validateLicense({ env, now: () => at - 1, fetchImpl: offline })).plan, 'free', 'clock rollback cannot extend a grant');
    await validateLicense({ env, now, force: true, fetchImpl: async () => response(200, bodyFor(env, { expires_at: new Date(at + 1000).toISOString() })) });
    assert.equal((await validateLicense({ env, now: () => at + 1001, fetchImpl: offline })).plan, 'free', 'receipt expiration bounds grace');

    // A successful live decision remains paid even if its save fails. It is
    // never classified as an outage; a different process still needs Polar.
    writeLicenseState(stateFor(env), { env });
    await faults('both', env, async () => {
      const result = await grant(env);
      assert.equal(result.plan, 'pro');
      assert.equal(result.validation, 'live');
      assert.match(result.warning, /could not be saved/);
      safe(result);
    });
    const before = fs.readFileSync(licenseFilePath(env), 'utf8');
    const cyclic = {}; cyclic.self = cyclic;
    assert.throws(() => writeLicenseState(cyclic, { env }), /could not be saved/);
    assert.equal(fs.readFileSync(licenseFilePath(env), 'utf8'), before, 'serialization failure preserves old bytes');
    if (process.platform !== 'win32') assert.equal(fs.statSync(licenseFilePath(env)).mode & 0o777, 0o600);

    // Pending older requests cannot restore a grant after a definitive denial.
    await grant(env);
    let release;
    const pending = validateLicense({ env, now, force: true, fetchImpl: () => new Promise(resolve => { release = resolve; }) });
    await validateLicense({ env, now, force: true, fetchImpl: async () => response(403) });
    release(response(200, bodyFor(env)));
    assert.equal((await pending).plan, 'free');
    assert.equal((await validateLicense({ env, now, fetchImpl: offline })).plan, 'free');

    // A malformed provider response cannot restore a warm receipt next time.
    await grant(env);
    const invalid = await validateLicense({ env, now, force: true, fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw Error(secret); } }) });
    assert.equal(invalid.plan, 'free');
    safe(invalid);
    assert.equal((await validateLicense({ env, now, fetchImpl: offline })).plan, 'free');

    await validateLicense({ env, now, force: true, fetchImpl: async () => response(200, bodyFor(env, { benefit_id: env.MERGE_GUARD_POLAR_TEAM_BENEFIT_ID })) });
    assert.equal((await validateLicense({ env, now, fetchImpl: offline })).plan, 'team');
    await faults('both', env, async () => {
      assert.equal((await validateLicense({ env, now, force: true, fetchImpl: async () => response(403) })).plan, 'free');
      assert.equal(readLicenseState({ env }).plan, 'team');
      assert.equal((await validateLicense({ env, now, fetchImpl: offline })).plan, 'free');
    });

    // Cold concurrent activations also honor a denial that arrives first.
    const fresh = environment(selection);
    let finishActivation;
    const oldActivation = activateLicense(secret, { env: fresh, fetchImpl: () => new Promise(resolve => { finishActivation = resolve; }) });
    await assert.rejects(activateLicense(secret, { env: fresh, fetchImpl: async () => response(403) }), /403/);
    finishActivation(response(200, { id: activation, license_key: bodyFor(fresh) }));
    assert.equal((await oldActivation).plan, 'free');
    assert.equal(readLicenseState({ env: fresh }), null);

    // Failed activation and deactivation cannot leave a trusted session.
    writeLicenseState(stateFor(env), { env });
    await grant(env);
    await faults('both', env, async () => {
      await assert.rejects(activateLicense(secret, { env, fetchImpl: async () => response(401) }), /401/);
      assert.equal((await validateLicense({ env, now, fetchImpl: offline })).plan, 'free');
      await assert.rejects(deactivateLicense({ env, fetchImpl: async () => response(204) }), /could not be removed/);
      assert.equal((await validateLicense({ env, now, fetchImpl: offline })).plan, 'free');
    });
  }

  // Denying one environment preserves the other's file AND live session.
  for (const deniedSelection of ['production', 'sandbox']) {
    const deniedEnv = environment(deniedSelection, 'isolation.json');
    const otherEnv = environment(deniedSelection === 'production' ? 'sandbox' : 'production', 'isolation.json');
    for (const env of [deniedEnv, otherEnv]) { writeLicenseState(stateFor(env), { env }); await grant(env); }
    const bytes = fs.readFileSync(licenseFilePath(otherEnv), 'utf8');
    await faults('both', deniedEnv, async () => {
      assert.equal((await validateLicense({ env: deniedEnv, now, force: true, fetchImpl: async () => response(403) })).plan, 'free');
      assert.equal((await validateLicense({ env: otherEnv, now, fetchImpl: () => assert.fail('other session was invalidated') })).plan, 'pro');
    });
    assert.equal(fs.readFileSync(licenseFilePath(otherEnv), 'utf8'), bytes);
    const wrongMapping = { ...otherEnv, MERGE_GUARD_POLAR_PRO_BENEFIT_ID: 'new-unmapped-benefit' };
    assert.equal((await validateLicense({ env: wrongMapping, now, fetchImpl: offline })).plan, 'free');
    const override = { ...otherEnv, MERGE_GUARD_LICENSE_KEY: 'OTHER-FAKE-KEY' };
    assert.equal((await validateLicense({ env: override, now, force: true, fetchImpl: async (_url, options) => {
      assert.equal(JSON.parse(options.body).activation_id, undefined);
      return response(403);
    } })).plan, 'free');
    assert.equal(fs.readFileSync(licenseFilePath(otherEnv), 'utf8'), bytes, 'override denial must not erase unrelated credentials');
  }

  // Actual independent CLI processes, injected provider/storage failures only.
  const hook = path.join(root, 'mock-provider.mjs');
  fs.writeFileSync(hook, `import fs from 'node:fs';
const fail = () => { throw Object.assign(Error('FAKE-LICENSE-NEVER-PRINT'), { code: 'EPERM' }); };
if (process.env.FIXTURE_LOCKED === 'yes') {
  const open = fs.openSync;
  fs.openSync = (file, flags, ...args) => flags === 'r' || flags === 0 ? open(file, flags, ...args) : fail();
  fs.writeFileSync = fail; fs.renameSync = fail; fs.rmSync = fail;
}
let calls = 0;
globalThis.fetch = async () => {
  calls += 1;
  const scenario = process.env.FIXTURE_SCENARIO;
  if (scenario === 'offline') throw Error('FAKE-LICENSE-NEVER-PRINT');
  if (scenario === 'deny') return { ok: false, status: 403 };
  return { ok: true, status: 200, json: async () => ({ status: 'granted', organization_id: scenario === 'wrong-org' ? 'other-org' : process.env.MERGE_GUARD_POLAR_ORGANIZATION_ID, benefit_id: process.env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID }) };
};
process.on('exit', () => console.error('MOCK_REQUESTS=' + calls));
`);
  const cli = (env, scenario, command = 'plan', locked = 'yes') => {
    childProcesses += 1;
    const expectedCalls = readLicenseState({ env })?.licenseKey || env.MERGE_GUARD_LICENSE_KEY ? 1 : 0;
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(hook).href, 'src/cli.js', command], {
      encoding: 'utf8', timeout: 15000,
      env: { ...process.env, ...env, FIXTURE_SCENARIO: scenario, FIXTURE_LOCKED: locked }
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, new RegExp(`MOCK_REQUESTS=${expectedCalls}`));
    safe(result.stdout + result.stderr);
    return result.stdout;
  };
  for (const selection of ['production', 'sandbox']) {
    for (const denial of ['deny', 'wrong-org']) {
      const env = environment(selection);
      writeLicenseState(stateFor(env, { lastValidatedAt: new Date().toISOString() }), { env });
      const bytes = fs.readFileSync(licenseFilePath(env), 'utf8');
      assert.match(cli(env, denial, 'license'), /Plan: Free/);
      assert.equal(fs.readFileSync(licenseFilePath(env), 'utf8'), bytes, 'first process could not change any stale paid bytes');
      assert.match(cli(env, 'offline'), /Plan: Free/, 'second independent process must not trust the surviving Pro file');
      assert.match(cli(env, 'deny'), /Plan: Free/, 'fresh process always consults provider before paid access');
      assert.match(cli(env, 'grant'), /Plan: Pro/, 'fresh live grant works despite unwritable storage');
      assert.match(cli(env, 'offline'), /Plan: Free/, 'live decision in another process is not an offline receipt');
    }
    const env = environment(selection);
    writeLicenseState(stateFor(env), { env });
    fs.chmodSync(licenseFilePath(env), 0o444);
    try {
      const result = cli(env, 'deny', 'license', 'no');
      assert.match(result, /Plan: Free/);
      if (process.platform === 'win32') {
        // Windows may allow removal even when replacing a read-only file is
        // forbidden. Both outcomes must fail closed; injected tests above
        // require surviving Pro bytes when both operations really fail.
        assert.match(result, /could not be saved/);
        if (readLicenseState({ env })?.plan === 'pro') assert.match(result, /could not be saved or removed/);
      }
    }
    finally { if (fs.existsSync(licenseFilePath(env))) fs.chmodSync(licenseFilePath(env), 0o600); }
    assert.match(cli(env, 'offline'), /Plan: Free/);
  }
  console.log(`license persistence contracts passed (${cases} denial/storage combinations; ${childProcesses} independent CLI processes; mocked provider only)`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
