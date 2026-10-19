#!/usr/bin/env node
// All generated examples are synthetic contract fixtures, never evaluation evidence.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compareCalibrationMeasurements } from '../src/calibrationComparison.js';
import { metricSourceHash } from './calibration-measure.js';

const root = process.cwd();
const fixtures = path.join(root, 'test', 'fixtures', 'historical-pr-evaluation', 'cases');
const templatePositive = JSON.parse(fs.readFileSync(path.join(fixtures, 'case-routing', 'labels.json'), 'utf8'));
const templateControl = JSON.parse(fs.readFileSync(path.join(fixtures, 'case-docs', 'labels.json'), 'utf8'));
const positiveDiff = fs.readFileSync(path.join(fixtures, 'case-routing', 'change.diff'), 'utf8');
const controlDiff = fs.readFileSync(path.join(fixtures, 'case-docs', 'change.diff'), 'utf8');

assert.match(metricSourceHash(root), /^[a-f0-9]{64}$/);
assert.equal(metricSourceHash(root), metricSourceHash(root));

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-calibration-comparison-'));
const corpusRoot = path.join(work, 'corpus');
fs.mkdirSync(path.join(corpusRoot, 'cases'), { recursive: true });

const cases = [];
for (let i = 0; i < 30; i += 1) {
  const id = `synthetic-${String(i).padStart(3, '0')}`;
  const isControl = i >= 15;
  const directory = `cases/${id}`;
  const dir = path.join(corpusRoot, directory);
  fs.mkdirSync(dir);
  // Unique synthetic diff data, so exact-duplicate detection stays green.
  const diff = (isControl ? controlDiff : positiveDiff) + `+// synthetic-contract-case-${i}\n`;
  fs.writeFileSync(path.join(dir, 'change.diff'), diff);
  const labels = structuredClone(isControl ? templateControl : templatePositive);
  labels.caseId = id;
  labels.repositoryAlias = 'synthetic-repo';
  if (!isControl) {
    labels.concerns[0].id = `concern-${i}`;
    labels.concerns[0].severity = i < 5 ? 'high' : 'medium';
  }
  fs.writeFileSync(path.join(dir, 'labels.json'), JSON.stringify(labels));
  cases.push({
    id, repositoryAlias: 'synthetic-repo', partition: 'calibration', directory,
    setupMinutes: 3, repositoryShape: 'single-package', ecosystem: 'node',
    changeCategory: isControl ? 'docs' : 'routing', diffSize: 'small'
  });
}
const manifest = { schemaVersion: 1, corpusId: 'synthetic-comparison-fixture', cases };
fs.writeFileSync(path.join(corpusRoot, 'manifest.json'), JSON.stringify(manifest) + '\n');

const cmd = (filename, args) => spawnSync(process.execPath, [`scripts/${filename}`, ...args], {
  cwd: root, encoding: 'utf8'
});
const measureArgs = (dir, commit, corpus = corpusRoot) => ['--corpus', corpus, '--output', dir, '--product-commit', commit];
const readMeasurement = (directory) => ({
  metadata: JSON.parse(fs.readFileSync(path.join(directory, 'metadata.json'), 'utf8')),
  aggregate: JSON.parse(fs.readFileSync(path.join(directory, 'aggregate.json'), 'utf8')),
  cases: JSON.parse(fs.readFileSync(path.join(directory, 'case-results.json'), 'utf8'))
});

try {
  const baselineDir = path.join(work, 'baseline');
  const candidateDir = path.join(work, 'candidate');
  const baseline = cmd('calibration-measure.js', measureArgs(baselineDir, 'a'.repeat(40)));
  assert.equal(baseline.status, 0, `baseline measurement: ${baseline.stderr}`);
  assert.equal(JSON.parse(baseline.stdout).status, 'provisional-human-verification-required');
  const candidate = cmd('calibration-measure.js', measureArgs(candidateDir, 'b'.repeat(40)));
  assert.equal(candidate.status, 0, `candidate measurement: ${candidate.stderr}`);
  assert.equal(cmd('calibration-measure.js', measureArgs(baselineDir, 'a'.repeat(40))).status, 2, 'never overwrite baseline');
  const first = readMeasurement(baselineDir);
  const second = readMeasurement(candidateDir);
  assert.equal(first.aggregate.corpus.partition, 'calibration');
  assert.equal(first.metadata.calibrationCaseCount, 30);
  assert.equal(first.metadata.preflightCounts.supportedConcerns, 15);
  assert.equal(first.metadata.preflightCounts.lowRiskControls, 15);
  assert.equal(first.metadata.preflightCounts.highSeveritySupportedConcerns, 5);
  assert.equal(first.metadata.corpusContentHash, second.metadata.corpusContentHash);
  assert.equal(first.metadata.metricImplementationHash, second.metadata.metricImplementationHash);

  const compared = compareCalibrationMeasurements(first, second);
  assert.equal(compared.caseCount, 30);
  assert.equal(compared.status, 'provisional-human-verification-required');
  assert.equal(compared.metrics.actionablePrecision.percentagePointChange, 0);
  assert.equal(compared.metrics.supportedScopeRecall.percentagePointChange, 0);
  const serialized = JSON.stringify(compared);
  assert(!serialized.includes('synthetic-000'), 'per-case IDs are private');
  assert(!serialized.includes('synthetic-repo'), 'repository alias is private');
  assert(!serialized.includes('src/router.js'), 'paths are private');

  const output = path.join(work, 'comparison.json');
  const comparison = cmd('calibration-compare.js', ['--baseline', baselineDir, '--candidate', candidateDir, '--output', output]);
  assert.equal(comparison.status, 0, comparison.stderr);
  assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).caseCount, 30);
  assert.equal(cmd('calibration-compare.js', ['--baseline', baselineDir, '--candidate', candidateDir, '--output', output]).status, 2, 'never overwrite comparison');

  const mutate = (modifier) => {
    const clone = structuredClone(second);
    modifier(clone);
    return () => compareCalibrationMeasurements(first, clone);
  };
  assert.throws(mutate((v) => { v.metadata.corpusContentHash = '0'.repeat(64); }), /corpus-or-label-identity-drift/);
  assert.throws(mutate((v) => { v.metadata.metricImplementationHash = '0'.repeat(64); }), /metric-implementation-drift/);
  assert.throws(mutate((v) => { v.cases.cases[0].inputHash = '0'.repeat(64); }), /case-input-or-label-drift/);
  assert.throws(mutate((v) => { v.cases.cases[0].configurationHash = '0'.repeat(64); }), /case-input-or-label-drift/);
  assert.throws(mutate((v) => { v.cases.cases[0].supportedConcernCount = 0; }), /inconsistent-candidate-aggregate|case-input-or-label-drift/);
  assert.throws(mutate((v) => { v.aggregate.corpus.partition = 'held-out'; }), /invalid-candidate-calibration-snapshot/);
  assert.throws(mutate((v) => { v.cases.cases[0].matchedFindingCount = 999; }), /invalid-candidate-case-result/);
  assert.throws(mutate((v) => { v.aggregate.metrics.actionablePrecision.value = 7; }), /invalid-candidate-metric/);
  assert.throws(mutate((v) => { v.aggregate.metrics.supportedScopeRecall.denominator += 1; }), /invalid-candidate-metric|inconsistent-candidate-aggregate/);

  const modifiedCaseDir = path.join(corpusRoot, cases[0].directory);
  const labelsPath = path.join(modifiedCaseDir, 'labels.json');
  const mutatedLabels = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
  mutatedLabels.concerns[0].rationale = 'synthetic altered evidence';
  fs.writeFileSync(labelsPath, JSON.stringify(mutatedLabels));
  const driftDir = path.join(work, 'drift');
  const driftMeasure = cmd('calibration-measure.js', measureArgs(driftDir, 'c'.repeat(40)));
  assert.equal(driftMeasure.status, 0, driftMeasure.stderr);
  assert.throws(() => compareCalibrationMeasurements(first, readMeasurement(driftDir)), /corpus-or-label-identity-drift/);

  const mixedManifest = { ...manifest, cases: [...manifest.cases, {
    ...manifest.cases[0], id: 'held-out-test', partition: 'held-out', directory: 'cases/held-out-test'
  }] };
  fs.writeFileSync(path.join(corpusRoot, 'manifest.json'), JSON.stringify(mixedManifest));
  assert.equal(cmd('calibration-measure.js', measureArgs(path.join(work, 'must-not-exist'), 'd'.repeat(40))).status, 2);
  assert.equal(fs.existsSync(path.join(work, 'must-not-exist')), false);

  assert.equal(cmd('calibration-measure.js', ['--help']).status, 0);
  assert.equal(cmd('calibration-compare.js', ['--help']).status, 0);
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
console.log('calibration measurement and comparison contracts passed (synthetic-only)');
