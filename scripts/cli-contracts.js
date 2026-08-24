import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function run(args, input = '') {
  return spawnSync(process.execPath, ['src/cli.js', ...args], {
    input,
    encoding: 'utf8'
  });
}

assert.equal(run(['--help']).status, 0, 'help should succeed');
assert.equal(run(['--preset', 'strict', 'examples/sample.diff']).status, 0, 'value options should consume their value');
const jsonRun = run(['--json', 'examples/sample.diff']);
assert.equal(jsonRun.status, 0, 'JSON mode should succeed');
const jsonReport = JSON.parse(jsonRun.stdout);
assert.equal(jsonReport.schemaVersion, 1, 'repository intelligence should remain additive in schema version 1');
assert(Array.isArray(jsonReport.projectChecks), 'JSON should retain the projectChecks string array');
assert.equal(jsonReport.policyPacks, undefined, 'starter policies must not be selected implicitly');
assert(Array.isArray(jsonReport.projectCheckDetails), 'JSON should expose projectCheckDetails');
assert.deepEqual(
  jsonReport.projectCheckDetails.map((detail) => detail.command),
  jsonReport.projectChecks,
  'detailed and legacy project check ordering should match'
);
assert(
  jsonReport.projectCheckDetails.every((detail) =>
    detail.sources.length && detail.sources.every((source) => source.path && source.reason)
  ),
  'every detected CLI check should include source and reason metadata'
);
assert.equal(jsonReport.repository.kind, 'single-package', 'JSON should expose the detected repository layout');
assert(jsonReport.repository.affectedPackages, 'JSON should expose affected-package mapping');
assert(jsonReport.reviewGuidance, 'JSON should expose review guidance separately');
assert.equal(jsonReport.reviewGuidance.codeOwners.sourcePath, null);
assert.deepEqual(jsonReport.reviewGuidance.codeOwners.suggestions, []);
assert(jsonReport.reviewGuidance.disclaimer.includes('do not prove assignment'));
const policyRun = run(['--json', '--policy', 'frontend', 'examples/sample.diff']);
assert.equal(policyRun.status, 0, 'explicit starter policy selection should succeed');
const policyReport = JSON.parse(policyRun.stdout);
assert.equal(policyReport.policyPacks[0].id, 'merge-guard.starter.frontend');
assert.deepEqual(
  policyReport.policyRequiredChecks.map((check) => check.command),
  ['npm test', 'npm run build']
);
assert.equal(policyReport.config.policyPacks[0].id, 'merge-guard.starter.frontend');
assert.equal(run(['--policy', 'unknown', 'examples/sample.diff']).status, 1, 'unknown starter policy should fail');
assert.equal(run(['--policy']).status, 1, 'missing policy value should fail');
assert.equal(run(['--fail-threshold', '5', 'examples/sample.diff']).status, 0, 'threshold value should be consumed');
assert.equal(run(['--unknown']).status, 1, 'unknown options should fail');
assert.equal(run(['--preset']).status, 1, 'missing preset value should fail');
assert.equal(run(['--fail-threshold']).status, 1, 'missing threshold value should fail');
assert.equal(run(['--pr-title', 'Context', '--pr-body', 'missing.md', 'examples/sample.diff']).status, 1, 'missing PR body file should fail');
assert.equal(run([], 'diff --git a/src/example.js b/src/example.js\n+const value = 1;\n').status, 0, 'stdin diff mode should succeed');
console.log('merge-guard CLI contract tests passed');
