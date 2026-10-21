#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve('scripts/p6-candidate-evidence.js');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-p6-candidate-contract-'));
const fixture = path.join(root, 'fixture with spaces');
fs.mkdirSync(path.join(fixture, 'src'), { recursive: true });
const source = path.join(fixture, 'src', 'index.js');
fs.writeFileSync(source, 'console.log("synthetic fixture");\n');
fs.writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({
  name: 'merge-guard-candidate-fixture', version: '1.0.0', files: ['src/']
}));
fs.writeFileSync(path.join(fixture, '.gitignore'), 'src/ignored.txt\n');
function git(...args) {
  const result = spawnSync('git', args, { cwd: fixture, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function evidence(cwd = fixture) {
  return spawnSync(process.execPath, [script], {
    cwd, encoding: 'utf8', timeout: 30000, env: process.env
  });
}
try {
  git('init');
  git('add', '.');
  git('-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-m', 'Synthetic candidate fixture');
  const sha = git('rev-parse', 'HEAD');
  const clean = evidence();
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(JSON.parse(clean.stdout).checkedOutCommit, sha);
  if (process.platform === 'win32') {
    const alternateCase = evidence(fixture.toUpperCase());
    assert.equal(alternateCase.status, 0, 'Windows directory identity must ignore path casing: ' + alternateCase.stderr);
  }

  fs.appendFileSync(source, '// local modification\n');
  assert.notEqual(evidence().status, 0, 'dirty tracked source must not attest HEAD');
  fs.writeFileSync(source, 'console.log("synthetic fixture");\n');
  fs.writeFileSync(path.join(fixture, 'src', 'untracked.txt'), 'untracked package bytes');
  assert.notEqual(evidence().status, 0, 'untracked package files must not attest HEAD');
  fs.unlinkSync(path.join(fixture, 'src', 'untracked.txt'));

  // npm includes explicitly selected files even when Git ignores them.
  fs.writeFileSync(path.join(fixture, 'src', 'ignored.txt'), 'ignored package bytes');
  assert.notEqual(evidence().status, 0, 'ignored packaged bytes must not attest HEAD');
  fs.unlinkSync(path.join(fixture, 'src', 'ignored.txt'));
  assert.notEqual(evidence(path.join(fixture, 'src')).status, 0,
    'subdirectory invocation must not label a different package with repository HEAD');
  assert.equal(evidence().status, 0, 'restored clean candidate remains valid');
  console.log('P6 candidate contracts passed: clean HEAD, dirty/untracked/ignored refusal, root binding');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
