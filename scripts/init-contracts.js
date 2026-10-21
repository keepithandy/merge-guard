#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { initializeConfig } from '../src/initializeConfig.js';

const cli = path.resolve('src/cli.js');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-init-contract-'));
const marker = path.join(root, 'must-not-run');
const sentinel = 'SYNTHETIC-INIT-SECRET';
const env = { ...process.env,
  MERGE_GUARD_POLAR_ENVIRONMENT: 'invalid-environment-must-not-be-read',
  MERGE_GUARD_LICENSE_KEY: sentinel, GITHUB_TOKEN: sentinel };
function run(cwd, ...args) {
  return spawnSync(process.execPath, [cli, 'init', ...args], {
    cwd, env, encoding: 'utf8', timeout: 10000
  });
}
function directory(name) {
  const cwd = path.join(root, name);
  fs.mkdirSync(cwd);
  return cwd;
}
const filename = cwd => path.join(cwd, 'merge-guard.config.json');
try {
  const cwd = directory('new project');
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
    scripts: { test: `node -e "require('fs').writeFileSync('${marker.replaceAll('\\', '/')}', 'bad')"` }
  }));
  const preview = run(cwd, '--dry-run');
  assert.equal(preview.status, 0, preview.stderr);
  assert(preview.stdout.includes('No files written.'));
  assert(!fs.existsSync(filename(cwd)));
  const initialized = run(cwd);
  assert.equal(initialized.status, 0, initialized.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(filename(cwd), 'utf8')), { preset: 'standard' });
  assert(initialized.stdout.includes('git diff | merge-guard'));
  assert(!initialized.stdout.includes(sentinel));
  assert(!initialized.stderr.includes(sentinel));
  assert(!fs.existsSync(marker), 'init must never execute discovered package commands');
  assert.deepEqual(fs.readdirSync(cwd).sort(), ['merge-guard.config.json', 'package.json']);
  if (process.platform !== 'win32') assert.equal(fs.statSync(filename(cwd)).mode & 0o777, 0o600);

  // The default initializer must not alter report scoring or built-in checks.
  const diff = fs.readFileSync('examples/sample.diff', 'utf8');
  function scan() {
    const result = spawnSync(process.execPath, [cli, '--json'], { cwd, env, input: diff, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }
  const configured = scan();
  fs.unlinkSync(filename(cwd));
  assert.deepEqual(scan(), configured, 'default setup must preserve the complete default report');
  fs.writeFileSync(path.join(cwd, 'init'), diff);
  const namedInit = spawnSync(process.execPath, [cli, '--json', './init'], { cwd, env, encoding: 'utf8' });
  assert.equal(namedInit.status, 0, namedInit.stderr);
  assert.equal(JSON.parse(namedInit.stdout).schemaVersion, 1,
    'an explicit relative path still scans a diff named init');
  fs.unlinkSync(path.join(cwd, 'init'));

  for (const preset of ['safe', 'standard', 'strict']) {
    const selected = directory(preset);
    assert.equal(run(selected, '--preset', preset).status, 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(filename(selected), 'utf8')), { preset });
  }
  for (const args of [
    ['extra.diff'], ['--force'], ['--json'], ['--dry-run', '--dry-run'],
    ['--preset'], ['--preset', 'unknown'], ['--preset', 'safe', '--preset', 'strict'],
    ['--doctor'], ['--policy', 'frontend'], ['--version']
  ]) {
    const invalid = run(cwd, ...args);
    assert.notEqual(invalid.status, 0, 'invalid init arguments must fail before writing');
    assert(!fs.existsSync(filename(cwd)));
  }

  const original = '{invalid existing config: never read or replace}';
  fs.writeFileSync(filename(cwd), original);
  assert.notEqual(run(cwd).status, 0);
  assert.equal(fs.readFileSync(filename(cwd), 'utf8'), original);
  assert.equal(run(cwd, '--dry-run').status, 0);
  assert.equal(fs.readFileSync(filename(cwd), 'utf8'), original);
  fs.unlinkSync(filename(cwd));
  fs.mkdirSync(filename(cwd));
  assert.notEqual(run(cwd).status, 0, 'an existing directory must be preserved');
  fs.rmdirSync(filename(cwd));

  // Link fixtures are required on POSIX; Windows privilege limits are reported
  // explicitly rather than pretending the link checks ran on that machine.
  let linked = false;
  try { fs.symlinkSync(path.join(root, 'missing-target'), filename(cwd), 'file'); linked = true; }
  catch (error) {
    if (process.platform !== 'win32' || !['EPERM', 'EACCES'].includes(error.code)) throw error;
    console.log('NOT RUN on this Windows host: dangling file symlink fixture (requires OS privilege).');
  }
  if (linked) {
    assert.notEqual(run(cwd).status, 0);
    assert(fs.lstatSync(filename(cwd)).isSymbolicLink());
    assert(!fs.existsSync(path.join(root, 'missing-target')));
    fs.unlinkSync(filename(cwd));
  }

  // A failed persistence operation must not leave a partial newly created
  // configuration or delete someone else's existing file.
  const sync = fs.fsyncSync;
  try {
    fs.fsyncSync = () => { throw new Error(sentinel); };
    assert.throws(() => initializeConfig([], { cwd }), error => !error.message.includes(sentinel));
    assert(!fs.existsSync(filename(cwd)), 'remove our incomplete file on persistence failure');
  } finally { fs.fsyncSync = sync; }
  const link = fs.linkSync;
  try {
    fs.linkSync = () => { const error = new Error(sentinel); error.code = 'ENOTSUP'; throw error; };
    assert.throws(() => initializeConfig([], { cwd }), error =>
      error.message.includes('--dry-run') && !error.message.includes(sentinel));
    assert(!fs.existsSync(filename(cwd)), 'unsupported filesystems must not get a partial config');
  } finally { fs.linkSync = link; }
  if (linked) {
    const raced = directory('link during publication');
    const missing = path.join(root, 'race-target');
    try {
      fs.linkSync = (temporary, target) => {
        fs.symlinkSync(missing, target, 'file');
        return link(temporary, target);
      };
      assert.throws(() => initializeConfig([], { cwd: raced }));
      assert(fs.lstatSync(filename(raced)).isSymbolicLink());
      assert(!fs.existsSync(missing), 'publication must never follow a newly inserted dangling link');
      assert.deepEqual(fs.readdirSync(raced), ['merge-guard.config.json']);
    } finally { fs.linkSync = link; }
  }
  try {
    fs.linkSync = (temporary, target) => {
      fs.writeFileSync(target, 'replacement must survive');
      return link(temporary, target);
    };
    assert.throws(() => initializeConfig([], { cwd }));
    assert.equal(fs.readFileSync(filename(cwd), 'utf8'), 'replacement must survive',
      'a target appearing during publication must never be overwritten or deleted');
  } finally { fs.linkSync = link; }
  assert(!fs.readdirSync(cwd).some(name => name.startsWith('.merge-guard-init-')),
    'failed setup and publication must remove our temporary files');
  assert(!fs.existsSync(marker));
  console.log('Free init contracts passed: preview, presets, offline isolation, safe creation, defaults and refusal paths');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
