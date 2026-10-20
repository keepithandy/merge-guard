#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { activateLicense, clearLicenseState } from '../src/commercial/license.js';
import { createProGateway } from '../src/commercial/proGateway.js';
import { fetchPremiumPolicyPack, submitPrioritySupport } from '../src/commercial/proClient.js';
import { analyzeDiff } from '../src/analyzeDiff.js';
import { applyPolicyPack } from '../src/starterPolicies.js';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-pro-fulfillment-'));
const supportDirectory = path.join(temp, 'support');
const sourceFile = path.join(temp, 'request.md');
const key = 'MG-PRO-CONTRACT-LICENSE-ONLY';
const env = {
  ...process.env,
  MERGE_GUARD_POLAR_ENVIRONMENT: 'sandbox',
  MERGE_GUARD_POLAR_ORGANIZATION_ID: '84897a3c-12b6-40b4-a96b-9e7b1681a352',
  MERGE_GUARD_POLAR_PRO_BENEFIT_ID: 'bf34f3a6-a63a-4ccc-9d0e-882f5426dfa9',
  MERGE_GUARD_POLAR_TEAM_BENEFIT_ID: '',
  MERGE_GUARD_LICENSE_FILE: path.join(temp, 'license.json'),
  MERGE_GUARD_LICENSE_KEY: '',
  MERGE_GUARD_SUPPORT_CONTACT: 'test@example.invalid'
};
let granted = true;
const provider = async (url, opts) => {
  assert.equal(new URL(url).host, 'sandbox-api.polar.sh');
  const request = JSON.parse(opts.body);
  assert.equal(request.key, key);
  assert.equal(request.organization_id, env.MERGE_GUARD_POLAR_ORGANIZATION_ID);
  const body = {
    status: granted ? 'granted' : 'revoked',
    benefit_id: env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID,
    organization_id: env.MERGE_GUARD_POLAR_ORGANIZATION_ID,
    expires_at: null
  };
  return new Response(JSON.stringify(url.endsWith('/activate')
    ? { id: '77777777-7777-4777-8777-777777777777', license_key: body }
    : body), { status: 200, headers: { 'content-type': 'application/json' } });
};

const gateway = createProGateway({
  env, policyDirectory: path.resolve('policies/pro-reference'),
  supportDirectory, fetchImpl: provider
});
try {
  gateway.listen(0, '127.0.0.1');
  await once(gateway, 'listening');
  const service = 'http://127.0.0.1:' + gateway.address().port;
  const clientEnv = { ...env, MERGE_GUARD_PRO_SANDBOX_SERVICE_URL: service };
  await activateLicense(key, { env, fetchImpl: provider });
  const delivery = await fetchPremiumPolicyPack('release-integrity', { env: clientEnv, licenseFetch: provider });
  assert.equal(delivery.policy.identity.id, 'merge-guard.pro.release-integrity');
  assert.equal(delivery.policy.identity.version, '1.0.0');
  assert(delivery.policy.rules.length >= 4);
  assert(/^[0-9a-f]{64}$/.test(delivery.source.sha256));

  const diff = [
    'diff --git a/package.json b/package.json',
    '--- a/package.json',
    '+++ b/package.json',
    '@@ -1,1 +1,2 @@',
    ' {"name":"test"}',
    '+ "postinstall": "node something.js"'
  ].join('\n');
  const report = applyPolicyPack(analyzeDiff(diff, {}), diff, delivery.policy);
  assert(report.policyPacks.some(p => p.id === 'merge-guard.pro.release-integrity'));
  assert(report.policyRequiredChecks.some(c => c.id === 'release-package'));

  fs.writeFileSync(sourceFile, 'Need review of a changed publish workflow.', 'utf8');
  const ticket = await submitPrioritySupport(sourceFile, { env: clientEnv, licenseFetch: provider });
  assert.equal(ticket.status, 'queued');
  const tickets = fs.readdirSync(supportDirectory);
  assert.equal(tickets.length, 1);
  const saved = fs.readFileSync(path.join(supportDirectory, tickets[0]), 'utf8');
  const record = JSON.parse(saved);
  assert.equal(record.contact, 'test@example.invalid');
  assert.equal(record.environment, 'sandbox');
  assert.equal(record.status, 'queued');
  assert(!saved.includes(key), 'support ticket must never store a license key');
  assert(!JSON.stringify(ticket).includes(key), 'API confirmation must never include a key');
  const queueEnv = { ...process.env, MERGE_GUARD_PRO_SUPPORT_DIRECTORY: supportDirectory };
  const list = spawnSync(process.execPath, ['scripts/pro-support-queue.js', 'list'], {
    cwd: process.cwd(), env: queueEnv, encoding: 'utf8'
  });
  assert.equal(list.status, 0, list.stderr);
  assert(list.stdout.includes(ticket.ticketId));
  assert(!list.stdout.includes('test@example.invalid'), 'list output must not expose contact');
  const opened = spawnSync(process.execPath,
    ['scripts/pro-support-queue.js', 'status', ticket.ticketId, 'open'],
    { cwd: process.cwd(), env: queueEnv, encoding: 'utf8' });
  assert.equal(opened.status, 0, opened.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(supportDirectory, tickets[0]), 'utf8')).status, 'open');
  const shown = spawnSync(process.execPath, ['scripts/pro-support-queue.js', 'show', ticket.ticketId],
    { cwd: process.cwd(), env: queueEnv, encoding: 'utf8' });
  assert.equal(shown.status, 0, shown.stderr);
  assert(shown.stdout.includes('test@example.invalid'));
  assert(!shown.stdout.includes(key));


  // Gateway validates independently; a forged caller cannot claim paid access.
  const forged = await fetch(service + '/v1/pro/support', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'not-entitled', organization_id: env.MERGE_GUARD_POLAR_ORGANIZATION_ID,
      contact: 'attacker@example.invalid', message: 'forge' })
  });
  assert.equal(forged.status, 403);
  assert.equal(fs.readdirSync(supportDirectory).length, 1);

  const traversal = await fetch(service + '/v1/pro/policy', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key, organization_id: env.MERGE_GUARD_POLAR_ORGANIZATION_ID, id: '../private' })
  });
  assert.equal(traversal.status, 404);

  const oversized = await fetch(service + '/v1/pro/support', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key, organization_id: env.MERGE_GUARD_POLAR_ORGANIZATION_ID,
      contact: 'test@example.invalid', message: 'x'.repeat(13000) })
  });
  assert.equal(oversized.status, 400);

  // A definitive revocation denies both policy delivery and ticket intake.
  granted = false;
  await assert.rejects(
    fetchPremiumPolicyPack('release-integrity', { env: clientEnv, licenseFetch: provider }),
    /currently granted/
  );
  await assert.rejects(
    submitPrioritySupport(sourceFile, { env: clientEnv, licenseFetch: provider }),
    /currently granted/
  );
  assert.equal(fs.readdirSync(supportDirectory).length, 1);

  // The server refuses a revoked license even if the client is tampered with.
  const denied = await fetch(service + '/v1/pro/policy', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key, organization_id: env.MERGE_GUARD_POLAR_ORGANIZATION_ID, id: 'release-integrity' })
  });
  assert.equal(denied.status, 403);

  // Production endpoints cannot borrow the Sandbox loopback URL.
  const prod = { ...clientEnv, MERGE_GUARD_POLAR_ENVIRONMENT: 'production',
    MERGE_GUARD_PRO_SERVICE_URL: service, MERGE_GUARD_PRO_SANDBOX_SERVICE_URL: '' };
  await assert.rejects(fetchPremiumPolicyPack('release-integrity', { env: prod, licenseFetch: provider }), /HTTPS origin/);
  await assert.rejects(fetchPremiumPolicyPack('../secret', { env: clientEnv, licenseFetch: provider }), /Invalid Pro policy ID/);

  assert.equal(fs.readdirSync(supportDirectory).length, 1);
  console.log('Pro fulfillment contracts passed: policy delivery, scan integration, support queue, revocation, isolation');
} finally {
  gateway.close();
  clearLicenseState({ env });
  fs.rmSync(temp, { recursive: true, force: true });
}
