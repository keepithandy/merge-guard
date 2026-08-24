#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  compareFindingReports,
  extractStableFindings,
  FindingComparisonError,
  FINDING_COMPARISON_SCHEMA_VERSION,
  FINDING_IDENTITY_VERSION,
  formatFindingComparisonMarkdown,
  hashImmutableReport
} from '../src/findingComparison.js';

const root = process.cwd();
const fixtureRoot = path.join(root, 'test', 'fixtures', 'finding-comparison');
const snapshotPath = path.join(root, 'test', 'snapshots', 'finding-comparison.json');

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, `${name}.json`), 'utf8'));
}

assert.equal(FINDING_IDENTITY_VERSION, 1);
assert.equal(FINDING_COMPARISON_SCHEMA_VERSION, 1);
const previous = fixture('previous');
const current = fixture('current');
const previousBefore = JSON.stringify(previous);
const currentBefore = JSON.stringify(current);

const previousFindings = extractStableFindings(previous);
const currentFindings = extractStableFindings(current);
assert.equal(previousFindings.length, 3);
assert.equal(currentFindings.length, 3);
assert(previousFindings.some((item) => item.ruleId === 'large-change' && item.path === null));
assert.equal(
  previousFindings.find((item) => item.ruleId === 'routing-or-entry').identity,
  currentFindings.find((item) => item.ruleId === 'routing-or-entry').identity,
  'identity must remain stable when finding details change'
);

const comparison = compareFindingReports(previous, current);
assert.equal(JSON.stringify(previous), previousBefore, 'previous report must remain immutable');
assert.equal(JSON.stringify(current), currentBefore, 'current report must remain immutable');
assert.equal(comparison.status, 'compared');
assert.equal(comparison.historyAvailable, true);
assert.deepEqual(comparison.summary, { new: 1, unchanged: 2, resolved: 1 });
assert.deepEqual(comparison.findings.new.map((item) => item.ruleId), ['async-or-network']);
assert.deepEqual(comparison.findings.resolved.map((item) => item.ruleId), ['state-or-persistence']);
assert(comparison.findings.unchanged.every((item) => item.detailsChanged));
assert.equal(comparison.previous.contentHash, hashImmutableReport(previous));
assert.equal(comparison.current.contentHash, hashImmutableReport(current));
assert.equal(
  hashImmutableReport(Object.fromEntries(Object.entries(previous).reverse())),
  hashImmutableReport(previous),
  'report hash must not depend on object key insertion order'
);
assert.deepEqual(comparison, JSON.parse(fs.readFileSync(snapshotPath, 'utf8')));

const duplicateReport = { ...current, rules: [...current.rules, current.rules[0]] };
assert.equal(extractStableFindings(duplicateReport).length, currentFindings.length);
const sourcedReport = {
  ...current,
  files: [],
  rules: [
    { id: 'same-id', custom: true, matchedFiles: ['src/shared.js'], label: 'Custom', weight: 1 },
    { id: 'same-id', policyPackId: 'policy.example', matchedFiles: ['src/shared.js'], label: 'Policy', weight: 1 }
  ]
};
assert.equal(extractStableFindings(sourcedReport).length, 2, 'finding source must participate in identity');

const missing = compareFindingReports(null, current);
assert.equal(missing.status, 'history-unavailable');
assert.equal(missing.historyAvailable, false);
assert.equal(missing.classificationAvailable, false);
assert.deepEqual(missing.summary, { new: null, unchanged: null, resolved: null });
assert.deepEqual(missing.findings, { new: [], unchanged: [], resolved: [] });
assert(missing.warning.includes('must not be treated as a clean comparison'));
assert(formatFindingComparisonMarkdown(missing).includes('finding changes are unknown'));

assert.throws(
  () => compareFindingReports(previous, fixture('future')),
  (error) => error instanceof FindingComparisonError && error.code === 'INCOMPATIBLE_REPORT_SCHEMA'
);
assert.throws(
  () => compareFindingReports(previous, { schemaVersion: 1 }),
  (error) => error instanceof FindingComparisonError && error.code === 'INVALID_REPORT'
);

const markdown = formatFindingComparisonMarkdown(comparison);
assert(markdown.includes('**New:** 1 · **Unchanged:** 2 · **Resolved:** 1'));
assert(markdown.includes('src/api.js'));
assert(markdown.includes('src/legacyState.js'));
assert(markdown.includes('does not by itself prove remediation'));

const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'finding-comparison-v1.schema.json'), 'utf8'));
assert.equal(schema.properties.schemaVersion.const, 1);
assert.equal(schema.properties.findingIdentityVersion.const, 1);
assert(schema.$defs.finding && schema.$defs.unchanged);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-comparison-'));
try {
  const outputPath = path.join(temporaryRoot, 'comparison.json');
  const compared = spawnSync(process.execPath, [
    'scripts/compare-reports.js',
    '--previous', path.join(fixtureRoot, 'previous.json'),
    '--current', path.join(fixtureRoot, 'current.json'),
    '--output', outputPath,
    '--markdown'
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(compared.status, 0, compared.stderr);
  assert(compared.stdout.includes('Merge Guard finding comparison'));
  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, 'utf8')).summary, comparison.summary);

  const missingOutputPath = path.join(temporaryRoot, 'missing.json');
  const unavailable = spawnSync(process.execPath, [
    'scripts/compare-reports.js',
    '--current', path.join(fixtureRoot, 'current.json'),
    '--output', missingOutputPath
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(unavailable.status, 2, 'missing history must have a distinct non-clean exit code');
  assert.equal(JSON.parse(fs.readFileSync(missingOutputPath, 'utf8')).status, 'history-unavailable');

  const incompatible = spawnSync(process.execPath, [
    'scripts/compare-reports.js',
    '--previous', path.join(fixtureRoot, 'previous.json'),
    '--current', path.join(fixtureRoot, 'future.json')
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(incompatible.status, 1);
  assert.equal(JSON.parse(incompatible.stderr).code, 'INCOMPATIBLE_REPORT_SCHEMA');
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

const implementation = fs.readFileSync(path.join(root, 'src', 'findingComparison.js'), 'utf8');
assert(!implementation.includes('node:child_process'), 'finding comparison must not execute commands');
assert(!/\b(?:spawn|exec)(?:Sync)?\s*\(/.test(implementation), 'finding comparison must remain read-only');

console.log('finding comparison contracts passed');
console.log(`new=${comparison.summary.new}`);
console.log(`unchanged=${comparison.summary.unchanged}`);
console.log(`resolved=${comparison.summary.resolved}`);
