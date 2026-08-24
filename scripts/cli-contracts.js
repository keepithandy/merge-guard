import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function run(args, input = '', options = {}) {
  return spawnSync(process.execPath, ['src/cli.js', ...args], {
    input,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) }
  });
}

assert.equal(run(['--help']).status, 0, 'help should succeed');
const prSummaryRun = run(['--pr-summary', 'examples/sample.diff']);
assert.equal(prSummaryRun.status, 0, 'pull-request summary mode should succeed');
assert(prSummaryRun.stdout.includes('<!-- merge-guard-pr-summary:v1 -->'));
assert(prSummaryRun.stdout.includes('<summary>Files (2)</summary>'));
assert(prSummaryRun.stdout.includes('<summary>Rules (2)</summary>'));
assert(prSummaryRun.stdout.includes('<summary>Suggested and required checks ('));
const annotationsRun = run(['--annotations', 'test/fixtures/github-review/annotations.diff']);
assert.equal(annotationsRun.status, 0, 'annotation JSON mode should succeed');
const annotations = JSON.parse(annotationsRun.stdout);
assert.equal(annotations.schemaVersion, 1);
assert.equal(annotations.annotations.length, 3);
assert.equal(annotations.unsupported.length, 2);
const sarifRun = run(['--sarif', 'test/fixtures/github-review/annotations.diff']);
assert.equal(sarifRun.status, 0, 'SARIF mode should succeed');
const sarif = JSON.parse(sarifRun.stdout);
assert.equal(sarif.version, '2.1.0');
assert.equal(sarif.runs[0].results.length, 3);
assert.equal(
  run(['--json', '--sarif', 'examples/sample.diff']).status,
  1,
  'structured output modes should conflict clearly'
);
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-cli-'));
try {
  const stepSummaryPath = path.join(temporaryRoot, 'step-summary.md');
  const reportJsonPath = path.join(temporaryRoot, 'report.json');
  const ciRun = run(
    ['--ci', '--report-json', reportJsonPath, '--fail-threshold', '999', 'examples/sample.diff'],
    '',
    { env: { GITHUB_STEP_SUMMARY: stepSummaryPath } }
  );
  assert.equal(ciRun.status, 0, 'CI summary contract should succeed below its explicit threshold');
  assert(ciRun.stdout.includes('# merge-guard report'), 'CI stdout should preserve the full Markdown report');
  const stepSummary = fs.readFileSync(stepSummaryPath, 'utf8');
  assert(stepSummary.includes('<!-- merge-guard-pr-summary:v1 -->'));
  assert(stepSummary.includes('### Highest-risk files'));
  const persistedReport = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));
  assert.equal(persistedReport.schemaVersion, 1);
  assert.equal(persistedReport.tool, 'merge-guard');
  assert(Array.isArray(persistedReport.rules));
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
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
const resolvedPolicyRun = run([
  '--json',
  '--policy-config',
  'test/fixtures/policy-resolution/valid.json',
  'test/fixtures/policy-resolution/changes.diff'
]);
assert.equal(resolvedPolicyRun.status, 0, 'explicit policy manifest should succeed');
const resolvedPolicyReport = JSON.parse(resolvedPolicyRun.stdout);
assert.equal(resolvedPolicyReport.policyPacks.length, 3);
assert.equal(resolvedPolicyReport.policyResolution.assignments.length, 6);
assert.equal(resolvedPolicyReport.policyExceptions.active.length, 4);
assert(resolvedPolicyReport.policyExceptions.semantics.includes('annotations-only'));
assert.equal(
  run([
    '--policy',
    'frontend',
    '--policy-config',
    'test/fixtures/policy-resolution/valid.json',
    'examples/sample.diff'
  ]).status,
  1,
  'direct and manifest policy selection should conflict clearly'
);
assert.equal(run(['--policy-config']).status, 1, 'missing policy-config value should fail');
assert.equal(run(['--report-json']).status, 1, 'missing report-json value should fail');
const expiredManifestRun = run([
  '--json',
  '--policy-config',
  'test/fixtures/policy-resolution/expired.json',
  'examples/sample.diff'
]);
assert.equal(expiredManifestRun.status, 1, 'expired policy exceptions should fail');
assert.equal(JSON.parse(expiredManifestRun.stderr).code, 'INVALID_POLICY_MANIFEST');
assert.equal(run(['--fail-threshold', '5', 'examples/sample.diff']).status, 0, 'threshold value should be consumed');
assert.equal(run(['--unknown']).status, 1, 'unknown options should fail');
assert.equal(run(['--preset']).status, 1, 'missing preset value should fail');
assert.equal(run(['--fail-threshold']).status, 1, 'missing threshold value should fail');
assert.equal(run(['--pr-title', 'Context', '--pr-body', 'missing.md', 'examples/sample.diff']).status, 1, 'missing PR body file should fail');
assert.equal(run([], 'diff --git a/src/example.js b/src/example.js\n+const value = 1;\n').status, 0, 'stdin diff mode should succeed');
console.log('merge-guard CLI contract tests passed');
