#!/usr/bin/env node
// P6D: synthetic local operational receipts; no provider mail or customer data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-p6-support-'));
const queue = path.join(root, 'queue');
const backup = path.join(root, 'backup');
fs.mkdirSync(queue, { mode: 0o700 });
const deliveryReference = path.join(root, 'delivery-ref.txt');
fs.writeFileSync(deliveryReference, 'synthetic-provider-message-123', { mode: 0o600 });
const openId = '11111111-1111-4111-8111-111111111111';
const heldId = '22222222-2222-4222-8222-222222222222';
const purgeId = '33333333-3333-4333-8333-333333333333';
const corruptId = '44444444-4444-4444-8444-444444444444';
const linkedId = '55555555-5555-4555-8555-555555555555';
const old = new Date(Date.now() - 100 * 86400000).toISOString();
const env = { ...process.env, MERGE_GUARD_PRO_SUPPORT_DIRECTORY: queue };
function ticket(id, status, updatedAt = old) {
  fs.writeFileSync(path.join(queue, id + '.json'), JSON.stringify({
    id, status, receivedAt: old, updatedAt,
    contact: 'synthetic@example.invalid', message: 'Non-personal synthetic ticket'
  }), { mode: 0o600 });
}
function ops(...args) {
  return spawnSync(process.execPath, ['scripts/pro-support-operations.js', ...args], {
    env, cwd: process.cwd(), encoding: 'utf8', timeout: 25000
  });
}
function status(id, value) {
  return spawnSync(process.execPath, ['scripts/pro-support-queue.js', 'status', id, value], {
    env, cwd: process.cwd(), encoding: 'utf8', timeout: 25000
  });
}
try {
  ticket(openId, 'open');
  ticket(heldId, 'closed');
  ticket(purgeId, 'closed');
  assert.notEqual(status(openId, 'responded').status, 0,
    'unsent ticket must never transition to responded');
  const attested = ops('attest-delivery', openId, deliveryReference);
  assert.equal(attested.status, 0, attested.stderr);
  assert(attested.stdout.includes('No email was sent'));
  const recorded = JSON.parse(fs.readFileSync(path.join(queue, openId + '.delivery.json'), 'utf8'));
  assert.equal(recorded.status, 'operator-attested-external-delivery');
  assert.equal(recorded.providerReference, 'synthetic-provider-message-123');
  assert(!JSON.stringify(recorded).includes('synthetic@example.invalid'));
  assert.notEqual(ops('attest-delivery', openId, deliveryReference).status, 0,
    'immutable receipt cannot be silently replaced');
  assert.equal(status(openId, 'responded').status, 0,
    'operator attestation is required and sufficient for local status update');

  // Cross-ticket receipt aliases must never turn an unsent ticket into a
  // responded one. Symlink creation may require privileges on Windows.
  ticket(linkedId, 'open');
  let linkCreated = false;
  try {
    fs.symlinkSync(path.join(queue, openId + '.delivery.json'),
      path.join(queue, linkedId + '.delivery.json'), 'file');
    linkCreated = true;
  } catch (error) {
    if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error;
  }
  if (linkCreated) {
    assert.notEqual(status(linkedId, 'responded').status, 0,
      'a symlinked receipt from a different ticket must be refused');
  }
  // Invalid email controls must never reach an owner terminal or draft.
  ticket(corruptId, 'open');
  const corrupted = JSON.parse(fs.readFileSync(path.join(queue, corruptId + '.json'), 'utf8'));
  corrupted.contact = 'bad\u001b[31m@example.invalid';
  fs.writeFileSync(path.join(queue, corruptId + '.json'), JSON.stringify(corrupted), { mode: 0o600 });
  const list = ops('pending', '--json');
  assert.equal(list.status, 0, list.stderr);
  assert(!list.stdout.includes(corruptId));
  const show = spawnSync(process.execPath, ['scripts/pro-support-queue.js', 'show', corruptId], {
    env, cwd: process.cwd(), encoding: 'utf8'
  });
  assert.notEqual(show.status, 0);
  assert(!show.stdout.includes('\u001b'), 'corrupted contact must not print escape codes');

  const hold = ops('hold', heldId, 'legal');
  assert.equal(hold.status, 0, hold.stderr);
  const activeHold = JSON.parse(fs.readFileSync(path.join(queue, heldId + '.hold.json'), 'utf8'));
  assert.equal(activeHold.status, 'hold-active');
  assert.equal(activeHold.category, 'legal');
  assert.notEqual(ops('hold', heldId, 'legal').status, 0, 'hold cannot be silently replaced');
  const preview = ops('purge-closed', '30');
  assert.equal(preview.status, 0, preview.stderr);
  assert(preview.stdout.includes(purgeId));
  assert(!preview.stdout.includes(heldId), 'held ticket must not be purge-eligible');

  // Owner backup/restore simulation on synthetic records. The software does
  // not claim production encryption, offsite backups or statutory compliance.
  fs.mkdirSync(backup, { mode: 0o700 });
  fs.copyFileSync(path.join(queue, heldId + '.json'), path.join(backup, heldId + '.json'));
  fs.copyFileSync(path.join(queue, heldId + '.hold.json'), path.join(backup, heldId + '.hold.json'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(backup, heldId + '.json'), 'utf8')).id, heldId);

  fs.writeFileSync(path.join(queue, purgeId + '.delivery.json'),
    JSON.stringify({ ticketId: purgeId, providerReference: 'synthetic', status: 'operator-attested-external-delivery' }),
    { mode: 0o600 });
  const purge = ops('purge-closed', '30', '--apply');
  assert.equal(purge.status, 0, purge.stderr);
  assert(!fs.existsSync(path.join(queue, purgeId + '.json')));
  assert(!fs.existsSync(path.join(queue, purgeId + '.delivery.json')));
  assert(fs.existsSync(path.join(queue, heldId + '.json')), 'legal hold must survive purge');
  assert(fs.existsSync(path.join(queue, heldId + '.hold.json')), 'hold marker must survive purge');
  assert(fs.existsSync(path.join(queue, openId + '.delivery.json')),
    'responded ticket must retain operator attestation');

  // A restore should retain hold semantics; a backup of a ticket alone is not
  // sufficient if the hold metadata was omitted.
  fs.rmSync(path.join(queue, heldId + '.json'));
  fs.rmSync(path.join(queue, heldId + '.hold.json'));
  fs.copyFileSync(path.join(backup, heldId + '.json'), path.join(queue, heldId + '.json'));
  fs.copyFileSync(path.join(backup, heldId + '.hold.json'), path.join(queue, heldId + '.hold.json'));
  assert(!ops('purge-closed', '30').stdout.includes(heldId),
    'restored hold must remain excluded from retention purge');
  console.log('P6 support contracts passed: explicit operator receipt, privacy, holds, synthetic restore');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
