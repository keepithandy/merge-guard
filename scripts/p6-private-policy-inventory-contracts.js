#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-p6-inventory-'));
const dir = path.join(root, 'private');
fs.mkdirSync(dir, { mode: 0o700 });
const valid = path.join(dir, 'release-integrity.json');
fs.copyFileSync(path.join('policies', 'pro-reference', 'release-integrity.json'), valid);
function audit(selected) {
  return spawnSync(process.execPath, ['scripts/p6-private-policy-inventory.js'], {
    env: { ...process.env, MERGE_GUARD_PRO_POLICY_DIRECTORY: selected },
    cwd: process.cwd(), encoding: 'utf8'
  });
}
try {
  const inventory = audit(dir);
  assert.equal(inventory.status, 0, inventory.stderr);
  const result = JSON.parse(inventory.stdout);
  assert.equal(result.rightsCleared, false);
  assert.equal(result.contentsUploaded, false);
  assert.equal(result.productionEnabled, false);
  assert.deepEqual(result.policies.map(p => p.id), ['release-integrity']);
  assert.match(result.policies[0].sha256, /^[a-f0-9]{64}$/);
  assert(!inventory.stdout.includes('"rules"'), 'never emit policy bytes');
  assert(!inventory.stdout.includes(root), 'never emit private paths');
  assert.notEqual(audit(path.resolve('policies/pro-reference')).status, 0,
    'checked-in public policy examples must not pass as private assets');

  fs.writeFileSync(path.join(dir, 'broken.json'), '{"identity":null}');
  assert.notEqual(audit(dir).status, 0, 'invalid JSON policy must fail entire audit');
  fs.rmSync(path.join(dir, 'broken.json'));
  let symlinkCreated = false;
  try {
    fs.symlinkSync(valid, path.join(dir, 'linked.json'), 'file');
    symlinkCreated = true;
  } catch (error) {
    if (process.platform !== 'win32' || !['EPERM','EACCES','ENOTSUP'].includes(error.code)) throw error;
  }
  if (symlinkCreated) {
    assert.notEqual(audit(dir).status, 0, 'policy symlinks must not be inventoried');
  }
  console.log('P6 private policy inventory contracts passed (rights never auto-attested).');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
