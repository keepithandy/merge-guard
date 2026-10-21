import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { analyzeDiff } from '../src/analyzeDiff.js';

function singleFileDiff(file, addedLine = '+export const changed = true;') {
  return [
    `diff --git a/${file} b/${file}`,
    `--- a/${file}`,
    `+++ b/${file}`,
    '@@ -0,0 +1 @@',
    addedLine,
    ''
  ].join('\n');
}

function hasRule(report, id) {
  return report.rules.some((rule) => rule.id === id);
}

// Regression: these are ordinary implementation files, not tests. Prior broad
// /test|spec|smoke/ substring matching silently removed the missing-test signal
// and attached a misleading test-change discount.
const productionFiles = [
  'src/contest.js',
  'src/testimonial.js',
  'src/special.js',
  'src/specification.js',
  'src/smokehouse.js',
  'src/testing-utils.js'
];
for (const file of productionFiles) {
  const report = analyzeDiff(singleFileDiff(file));
  assert.equal(report.summary.changedFiles, 1, file);
  assert.equal(report.docsOnly, false, file);
  assert(hasRule(report, 'implementation-without-tests'),
    `${file} should receive implementation-without-tests`);
  assert(!hasRule(report, 'test-change'),
    `${file} must not be treated as a test fixture`);
  assert(report.riskScore > 0, `${file} must not receive an accidental test discount`);
}

// Positive controls: conventional test names, test trees and scripts contracts.
for (const file of [
  'test/core.test.js',
  'tests/integration.js',
  'src/foo.spec.ts',
  'src/test_save.py',
  'src/__tests__/core.js',
  'src/fixtures/mock.js',
  'scripts/plugin-worker-contracts.js',
  'scripts/smoke_check.mjs'
]) {
  const report = analyzeDiff(singleFileDiff(file));
  assert(hasRule(report, 'test-change'), `${file} must remain test evidence`);
  assert(!hasRule(report, 'implementation-without-tests'),
    `${file} must not be counted as an untested implementation change`);
}

const source = singleFileDiff('src/contest.js');
const sourceAndTest = [
  source.trimEnd(),
  singleFileDiff('tests/contest.test.js')
].join('\n');
const sourceOnlyReport = analyzeDiff(source);
const mixed = analyzeDiff(sourceAndTest);
assert.equal(mixed.summary.changedFiles, 2);
assert(hasRule(mixed, 'test-change'), 'genuine test changes must retain their discount');
assert(!hasRule(mixed, 'implementation-without-tests'),
  'genuine test companion should satisfy the broad test-change heuristic');
assert(mixed.riskScore < sourceOnlyReport.riskScore);

// Confirm the public CLI uses the same classifier and retains its v1 schema.
const cli = spawnSync(process.execPath, ['src/cli.js', '--json'], {
  input: source,
  encoding: 'utf8'
});
assert.equal(cli.status, 0, cli.stderr || 'CLI must accept a valid diff');
const cliReport = JSON.parse(cli.stdout);
assert.equal(cliReport.schemaVersion, 1);
assert(hasRule(cliReport, 'implementation-without-tests'));
assert(!hasRule(cliReport, 'test-change'));

console.log('Free test-path classification contracts passed');
