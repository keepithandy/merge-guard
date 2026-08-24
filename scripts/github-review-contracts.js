#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeDiff, formatMarkdownReport } from '../src/analyzeDiff.js';
import {
  createGithubAnnotationBundle,
  createSarifLog,
  formatGithubWorkflowCommands,
  GITHUB_REVIEW_SCHEMA_VERSION,
  parseAddedLineLocations,
  SARIF_VERSION
} from '../src/githubReviewOutputs.js';

const root = process.cwd();
const fixturePath = path.join(root, 'test', 'fixtures', 'github-review', 'annotations.diff');
const snapshotPath = path.join(root, 'test', 'snapshots', 'github-review-output.json');
const diffText = fs.readFileSync(fixturePath, 'utf8');
const report = analyzeDiff(diffText);
report.schemaVersion = 1;
report.configDiagnostics = [];

assert.equal(GITHUB_REVIEW_SCHEMA_VERSION, 1);
assert.equal(SARIF_VERSION, '2.1.0');
assert.deepEqual(parseAddedLineLocations(diffText).map((item) => [item.path, item.line]), [
  ['src/app.js', 9],
  ['src/app.js', 10]
]);
assert.deepEqual(parseAddedLineLocations(diffText.replace(/\r?\n/g, '\r\n')), parseAddedLineLocations(diffText));
assert.deepEqual(
  parseAddedLineLocations([
    'diff --git "a/src/file name.js" "b/src/file name.js"',
    '--- "a/src/file name.js"',
    '+++ "b/src/file name.js"',
    '@@ -40,0 +42,1 @@',
    '+changed'
  ].join('\n')),
  [{ path: 'src/file name.js', line: 42, content: 'changed' }]
);

const reportBefore = JSON.stringify(report);
const bundle = createGithubAnnotationBundle(report, diffText);
assert.equal(JSON.stringify(report), reportBefore, 'annotation mapping must not mutate the report');
assert.equal(bundle.schemaVersion, 1);
assert.equal(bundle.report.riskScore, report.riskScore);
assert.equal(bundle.annotations.length, 3);
assert.equal(new Set(bundle.annotations.map((item) => item.id)).size, bundle.annotations.length);
assert.deepEqual(
  bundle.annotations.map((item) => [item.ruleId, item.path, item.startLine, item.level]),
  [
    ['async-or-network', 'src/app.js', 9, 'warning'],
    ['implementation-without-tests', 'src/app.js', 9, 'warning'],
    ['routing-or-entry', 'src/app.js', 9, 'warning']
  ]
);
assert.deepEqual(
  bundle.unsupported.map((item) => [item.ruleId, item.path, item.reason]),
  [
    ['dependency-or-config', 'package.json', 'changed file has no added line to annotate'],
    ['implementation-without-tests', 'package.json', 'changed file has no added line to annotate']
  ]
);
assert(formatMarkdownReport(report).includes('Dependency or config file changed'));
assert(report.rules.some((rule) => rule.id === 'dependency-or-config'));
assert(bundle.semantics.includes('do not change findings'));
const docsDiff = fs.readFileSync(path.join(root, 'examples', 'docs-only.diff'), 'utf8');
const docsReport = analyzeDiff(docsDiff);
docsReport.schemaVersion = 1;
const docsBundle = createGithubAnnotationBundle(docsReport, docsDiff);
assert.equal(docsBundle.annotations[0].level, 'notice');
assert.equal(docsBundle.annotations[0].ruleId, 'docs-only');

const duplicateRuleReport = { ...report, rules: [...report.rules, report.rules[0]] };
assert.equal(
  createGithubAnnotationBundle(duplicateRuleReport, diffText).annotations.length,
  bundle.annotations.length,
  'duplicate rule records must not produce duplicate annotations'
);

const commands = formatGithubWorkflowCommands(bundle);
assert.equal(commands.split('\n').length, bundle.annotations.length);
assert(commands.includes('::warning file=src/app.js,line=9,endLine=9,title='));
assert.equal(
  formatGithubWorkflowCommands({
    annotations: [{
      level: 'warning',
      path: 'src/a,b.js',
      startLine: 4,
      endLine: 4,
      title: 'Title: check',
      message: '100%\nnext'
    }]
  }),
  '::warning file=src/a%2Cb.js,line=4,endLine=4,title=Title%3A check::100%25%0Anext'
);

const sarif = createSarifLog(report, bundle);
assert.equal(JSON.stringify(report), reportBefore, 'SARIF formatting must not mutate the report');
assert.equal(sarif.version, '2.1.0');
assert.equal(sarif.runs.length, 1);
assert.equal(sarif.runs[0].results.length, bundle.annotations.length);
assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uriBaseId, '%SRCROOT%');
assert(sarif.runs[0].results.every((result) => result.partialFingerprints.primaryLocationLineHash));
assert.equal(sarif.runs[0].invocations[0].properties.riskScore, report.riskScore);
assert.equal(sarif.runs[0].invocations[0].properties.unsupportedFindings, 2);

const snapshot = {
  bundle,
  sarif: {
    version: sarif.version,
    automationId: sarif.runs[0].automationDetails.id,
    ruleIds: sarif.runs[0].tool.driver.rules.map((rule) => rule.id),
    results: sarif.runs[0].results.map((result) => ({
      ruleId: result.ruleId,
      level: result.level,
      path: result.locations[0].physicalLocation.artifactLocation.uri,
      line: result.locations[0].physicalLocation.region.startLine,
      fingerprint: result.partialFingerprints.primaryLocationLineHash
    })),
    invocation: sarif.runs[0].invocations[0]
  }
};
assert(fs.existsSync(snapshotPath), `missing snapshot: ${snapshotPath}`);
assert.deepEqual(snapshot, JSON.parse(fs.readFileSync(snapshotPath, 'utf8')));

const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'github-review-output-v1.schema.json'), 'utf8'));
assert.equal(schema.properties.schemaVersion.const, 1);
assert(schema.$defs.annotation && schema.$defs.unsupported);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-review-'));
try {
  const reportPath = path.join(temporaryRoot, 'report.json');
  const temporaryDiffPath = path.join(temporaryRoot, 'change.diff');
  const annotationsPath = path.join(temporaryRoot, 'annotations.json');
  const sarifPath = path.join(temporaryRoot, 'merge-guard.sarif');
  fs.writeFileSync(reportPath, JSON.stringify(report), 'utf8');
  fs.writeFileSync(temporaryDiffPath, diffText, 'utf8');
  const run = spawnSync(process.execPath, [
    'scripts/github-review-outputs.js',
    '--report', reportPath,
    '--diff', temporaryDiffPath,
    '--annotations', annotationsPath,
    '--sarif', sarifPath,
    '--emit-commands'
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert(run.stdout.includes('::warning file=src/app.js,line=9'));
  assert.equal(JSON.parse(fs.readFileSync(annotationsPath, 'utf8')).annotations.length, 3);
  assert.equal(JSON.parse(fs.readFileSync(sarifPath, 'utf8')).version, '2.1.0');
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

const implementation = fs.readFileSync(path.join(root, 'src', 'githubReviewOutputs.js'), 'utf8');
assert(!implementation.includes('node:child_process'), 'review-output projection must not execute commands');
assert(!/\b(?:spawn|exec)(?:Sync)?\s*\(/.test(implementation), 'review-output projection must remain read-only');

console.log('GitHub review output contracts passed');
console.log(`annotations=${bundle.annotations.length}`);
console.log(`unsupportedLocations=${bundle.unsupported.length}`);
console.log(`sarifResults=${sarif.runs[0].results.length}`);
