#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-support-ops-'));
const openId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const closedId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const recentId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const receivedAt = new Date(Date.now() - 100 * 86400000).toISOString();
const oldDate = new Date(Date.now() - 90 * 86400000).toISOString();
const recentDate = new Date(Date.now() - 1 * 86400000).toISOString();
const replyFile = path.join(dir, 'source.txt');
const writeTicket = (id, status, updatedAt) => {
  fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify({
    id, status, receivedAt, updatedAt, contact: 'private@example.invalid',
    message: 'Confidential support description'
  }), { mode: 0o600 });
};
const env = { ...process.env, MERGE_GUARD_PRO_SUPPORT_DIRECTORY: dir };
function run(...args) {
  return spawnSync(process.execPath, ['scripts/pro-support-operations.js', ...args], {
    cwd: process.cwd(), env, encoding: 'utf8', timeout: 20000
  });
}
try {
  writeTicket(openId, 'open', recentDate);
  writeTicket(closedId, 'closed', oldDate);
  writeTicket(recentId, 'closed', recentDate);
  const notification = run('pending', '--json');
  assert.equal(notification.status, 0, notification.stderr);
  const listed = JSON.parse(notification.stdout);
  assert.equal(listed.count, 1);
  assert.equal(listed.tickets[0].id, openId);
  assert(!notification.stdout.includes('private@example.invalid'));
  assert(!notification.stdout.includes('Confidential'));
  fs.writeFileSync(replyFile, 'We have reproduced the issue.', { mode: 0o600 });
  const firstDraft = run('draft', openId, replyFile);
  assert.equal(firstDraft.status, 0, firstDraft.stderr);
  assert.match(firstDraft.stdout, /No email sent/);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, openId + '.draft.json'), 'utf8'));
  assert.equal(saved.status, 'draft-unsent');
  assert.equal(saved.replyTo, 'private@example.invalid');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, openId + '.json'), 'utf8')).status, 'open');
  assert.notEqual(run('draft', openId, replyFile).status, 0, 'draft overwrite must fail');
  assert.notEqual(run('draft', closedId, replyFile).status, 0, 'closed draft must fail');
  fs.writeFileSync(replyFile, 'injected' + String.fromCharCode(27) + '[31m');
  assert.notEqual(run('draft', recentId, replyFile).status, 0);
  const preview = run('purge-closed', '30');
  assert.equal(preview.status, 0, preview.stderr);
  assert(preview.stdout.includes(closedId));
  assert(!preview.stdout.includes(recentId));
  assert(fs.existsSync(path.join(dir, closedId + '.json')), 'dry-run must not delete');
  assert.equal(run('purge-closed', '0', '--apply').status, 1);
  const applied = run('purge-closed', '30', '--apply');
  assert.equal(applied.status, 0, applied.stderr);
  assert(!fs.existsSync(path.join(dir, closedId + '.json')));
  assert(fs.existsSync(path.join(dir, recentId + '.json')));
  assert(fs.existsSync(path.join(dir, openId + '.json')));
  assert(fs.existsSync(path.join(dir, openId + '.draft.json')));
  assert.equal(JSON.parse(run('pending', '--json').stdout).count, 1);
  console.log('Pro support operations contracts passed');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
