#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = path.join(root, 'test', 'fixtures');

function run(args, cwd = root) {
  return spawnSync(process.execPath, [path.join(root, 'src', 'cli.js'), ...args], {
    cwd,
    encoding: 'utf8'
  });
}

const first = run(['--doctor', '--json']);
const second = run(['--doctor', '--json']);
assert.equal(first.status, 0, 'base doctor invocation should be healthy');
assert.equal(second.status, 0, 'repeated doctor invocation should be healthy');
assert.deepEqual(JSON.parse(first.stdout), JSON.parse(second.stdout), 'doctor JSON output should be stable for the same workspace and runtime');

const baseReport = JSON.parse(first.stdout);
assert.equal(baseReport.schemaVersion, 1);
assert.equal(baseReport.command, 'doctor');
assert.equal(baseReport.healthy, true);
assert.deepEqual(
  baseReport.checks.map((entry) => entry.id),
  ['runtime', 'package-identity', 'configuration', 'policy-manifest', 'plugin-manifest', 'repository-context', 'action-contract', 'action-inputs'],
  'doctor check ordering is a stable public contract'
);
assert(!first.stdout.includes(root), 'doctor JSON should not disclose an absolute workspace path');

const human = run(['--doctor']);
assert.equal(human.status, 0, 'human doctor output should be healthy');
assert(human.stdout.includes('Merge Guard doctor'));
assert(human.stdout.includes('Result: HEALTHY'));

const standalone = path.join(fixtureRoot, 'consumer-conformance', 'standalone-node');
const selected = run([
  '--doctor',
  '--json',
  '--policy-config', '../../policy-resolution/valid.json',
  '--plugin-manifest', '../../plugins/valid-manifest.json',
  '--action-inputs', '../../doctor/action-inputs-valid.json'
], standalone);
assert.equal(selected.status, 0, 'doctor should validate selected configuration, policy, plugin, and Action inputs');
const selectedReport = JSON.parse(selected.stdout);
assert(selectedReport.checks.every((entry) => entry.status !== 'error'));
for (const id of ['configuration', 'policy-manifest', 'plugin-manifest', 'action-inputs']) {
  assert.equal(selectedReport.checks.find((entry) => entry.id === id).status, 'pass', `${id} should pass for the public fixture`);
}

const invalidConfig = run(['--doctor', '--json'], path.join(fixtureRoot, 'doctor', 'invalid-config'));
assert.equal(invalidConfig.status, 1, 'doctor should fail a malformed configuration');
assert.equal(JSON.parse(invalidConfig.stdout).checks.find((entry) => entry.id === 'configuration').status, 'error');

const invalidAction = run(['--doctor', '--json', '--action-inputs', 'test/fixtures/doctor/action-inputs-invalid.json']);
assert.equal(invalidAction.status, 1, 'doctor should fail unsupported Action inputs');
assert.equal(JSON.parse(invalidAction.stdout).checks.find((entry) => entry.id === 'action-inputs').status, 'error');
assert(!invalidAction.stdout.includes('this-must-not-appear'), 'doctor should redact Action input values');

const incompatible = run(['--doctor', '--markdown']);
assert.equal(incompatible.status, 1, 'doctor should reject diff output modes');
assert.equal(run(['--doctor', 'examples/sample.diff']).status, 1, 'doctor should reject a diff positional argument');
const traversal = run(['--doctor', '--json', '--action-inputs', 'test/fixtures/doctor/action-inputs-traversal.json']);
assert.equal(traversal.status, 1, 'doctor should reject parent-directory Action paths');
assert.equal(JSON.parse(traversal.stdout).checks.find((entry) => entry.id === 'action-inputs').status, 'error');
console.log('doctor contracts passed');
