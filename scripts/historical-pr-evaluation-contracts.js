#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateHistoricalPrCorpus, HistoricalPrEvaluationError, loadHistoricalPrCorpus, EVALUATION_SCHEMA_VERSION } from '../src/historicalPrEvaluation.js';
import {
  createPilotPreregistration,
  PILOT_THRESHOLDS,
  pilotCorpusProfile,
  validatePilotPreregistration
} from '../src/historicalPrPreregistration.js';

const root = process.cwd();
const fixtureRoot = path.join(root, 'test', 'fixtures', 'historical-pr-evaluation');
const corpus = loadHistoricalPrCorpus(fixtureRoot);
assert.equal(EVALUATION_SCHEMA_VERSION, 1);
assert.equal(corpus.manifest.corpusId, 'fixture-evaluation-v1');
assert.equal(corpus.records.length, 3);
assert.deepEqual(corpus.records.map((item) => item.entry.id), ['case-async', 'case-docs', 'case-routing']);

const evaluated = evaluateHistoricalPrCorpus(corpus);
assert.equal(evaluated.aggregate.corpus.caseCount, 3);
assert.deepEqual(evaluated.aggregate.metrics.actionablePrecision, { numerator: 2, denominator: 5, value: 0.4 });
assert.deepEqual(evaluated.aggregate.metrics.supportedScopeRecall, { numerator: 2, denominator: 2, value: 1 });
assert.equal(evaluated.aggregate.metrics.criticalSupportedScopeRecall.status, 'insufficient-evidence');
assert.deepEqual(evaluated.aggregate.metrics.cleanPrSpecificity, { numerator: 1, denominator: 1, value: 1 });
assert.deepEqual(evaluated.aggregate.metrics.coverage.changeCategory, { docs: 1, network: 1, routing: 1 });
assert.equal(evaluated.caseResults.find((item) => item.caseId === 'case-docs').findingCount, 0);
const contentFree = JSON.stringify(evaluated);
assert(!contentFree.includes("fetch('/data')"), 'evaluation output must not contain diff text');
assert(!contentFree.includes('Updated guide'), 'evaluation output must not contain source contents');

function stable(value) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy.aggregate.runtimeMs;
  delete copy.aggregate.metrics.runtimeMs;
  for (const item of copy.caseResults) delete item.runtimeMs;
  return copy;
}
assert.deepEqual(stable(evaluateHistoricalPrCorpus(corpus)), stable(evaluated), 'matching and non-timing output must be deterministic');

for (const schema of ['historical-pr-corpus-v1.schema.json', 'historical-pr-labels-v1.schema.json', 'historical-pr-case-result-v1.schema.json', 'historical-pr-evaluation-result-v1.schema.json', 'historical-pr-preregistration-v1.schema.json']) {
  const value = JSON.parse(fs.readFileSync(path.join(root, 'schemas', schema), 'utf8'));
  assert.equal(value.properties.schemaVersion.const, 1);
}

assert.throws(
  () => createPilotPreregistration(corpus, { productCommit: 'a'.repeat(40), recordedAt: '2026-09-01T00:00:00.000Z' }),
  (error) => error instanceof HistoricalPrEvaluationError && error.diagnostics.some((item) => item.code === 'insufficient-held-out-cases')
);

const template = corpus.records.find((record) => record.entry.partition === 'held-out');
const pilotRecords = Array.from({ length: PILOT_THRESHOLDS.minimumHeldOutCases }, (_, index) => {
  const id = `held-out-${String(index).padStart(3, '0')}`;
  const hasConcern = index < PILOT_THRESHOLDS.minimumSupportedConcerns;
  const lowRisk = index >= PILOT_THRESHOLDS.minimumSupportedConcerns
    && index < PILOT_THRESHOLDS.minimumSupportedConcerns + PILOT_THRESHOLDS.minimumLowRiskControls;
  return {
    ...template,
    entry: { ...template.entry, id, repositoryAlias: `repo-${index % PILOT_THRESHOLDS.minimumRepositoryAliases}`, partition: 'held-out' },
    labels: {
      ...template.labels,
      caseId: id,
      repositoryAlias: `repo-${index % PILOT_THRESHOLDS.minimumRepositoryAliases}`,
      lowRisk,
      concerns: hasConcern ? [{ ...template.labels.concerns[0], id: `concern-${index}` }] : []
    },
    inputHash: String(index).padStart(64, '0')
  };
});
const pilotCorpus = {
  ...corpus,
  manifest: { ...corpus.manifest, corpusId: 'pilot-fixture-v1' },
  manifestHash: 'b'.repeat(64),
  records: pilotRecords
};
const profile = pilotCorpusProfile(pilotCorpus);
assert.equal(profile.heldOutCaseCount, 50);
assert.equal(profile.repositoryAliasCount, 5);
assert.equal(profile.supportedConcernCount, 15);
assert.equal(profile.lowRiskControlCount, 15);
const preregistration = createPilotPreregistration(pilotCorpus, {
  productCommit: 'a'.repeat(40),
  recordedAt: '2026-09-01T00:00:00.000Z'
});
assert.equal(validatePilotPreregistration(preregistration, pilotCorpus, { productCommit: 'a'.repeat(40) }).valid, true);
assert.equal(validatePilotPreregistration({ ...preregistration, thresholds: { ...preregistration.thresholds, actionablePrecisionMinimum: 0.5 } }, pilotCorpus, { productCommit: 'a'.repeat(40) }).valid, false);
assert.equal(validatePilotPreregistration(preregistration, { ...pilotCorpus, manifestHash: 'c'.repeat(64) }, { productCommit: 'a'.repeat(40) }).valid, false);
assert(
  validatePilotPreregistration(preregistration, corpus, { productCommit: 'a'.repeat(40) }).diagnostics.some((item) => item.code === 'insufficient-held-out-cases'),
  'held-out execution must recheck corpus prerequisites instead of trusting record fields'
);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-historical-evaluation-'));
try {
  const copy = (name) => { const target = path.join(temporaryRoot, name); fs.cpSync(fixtureRoot, target, { recursive: true }); return target; };
  const valid = copy('valid');
  const validate = spawnSync(process.execPath, ['scripts/evaluate-historical-prs.js', '--corpus', valid, '--mode', 'validate'], { cwd: root, encoding: 'utf8' });
  assert.equal(validate.status, 0, validate.stderr);
  assert.equal(JSON.parse(validate.stdout).status, 'valid');
  const output = path.join(temporaryRoot, 'output');
  const run = spawnSync(process.execPath, ['scripts/evaluate-historical-prs.js', '--corpus', valid, '--mode', 'run', '--partition', 'calibration', '--output', output], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const aggregateText = fs.readFileSync(path.join(output, 'aggregate.json'), 'utf8');
  assert(!aggregateText.includes('fetch'), 'CLI aggregate must remain content-free');
  assert.equal(JSON.parse(aggregateText).metrics.supportedScopeRecall.value, 1);
  assert.equal(JSON.parse(aggregateText).corpus.partition, 'calibration');
  const rerun = spawnSync(process.execPath, ['scripts/evaluate-historical-prs.js', '--corpus', valid, '--mode', 'run', '--partition', 'calibration', '--output', output], { cwd: root, encoding: 'utf8' });
  assert.equal(rerun.status, 1, 'existing output may not be overwritten');
  const missingPartition = spawnSync(process.execPath, ['scripts/evaluate-historical-prs.js', '--corpus', valid, '--mode', 'run', '--output', path.join(temporaryRoot, 'missing-partition')], { cwd: root, encoding: 'utf8' });
  assert.equal(missingPartition.status, 1, 'run must select calibration or held-out explicitly');
  const unregisteredHeldOut = spawnSync(process.execPath, ['scripts/evaluate-historical-prs.js', '--corpus', valid, '--mode', 'run', '--partition', 'held-out', '--output', path.join(temporaryRoot, 'held-out')], { cwd: root, encoding: 'utf8' });
  assert.equal(unregisteredHeldOut.status, 1, 'held-out run must require preregistration evidence');
  const insufficientPreregistrationPath = path.join(temporaryRoot, 'insufficient-preregistration.json');
  const insufficientPreregistration = spawnSync(process.execPath, ['scripts/evaluate-historical-prs.js', '--corpus', valid, '--mode', 'preregister', '--output', insufficientPreregistrationPath, '--product-commit', 'a'.repeat(40), '--recorded-at', '2026-09-01T00:00:00.000Z'], { cwd: root, encoding: 'utf8' });
  assert.equal(insufficientPreregistration.status, 1, 'small corpus must not produce a pilot preregistration');
  assert.equal(fs.existsSync(insufficientPreregistrationPath), false);
  const unknownOption = spawnSync(process.execPath, ['scripts/evaluate-historical-prs.js', '--corpus', valid, '--unknown'], { cwd: root, encoding: 'utf8' });
  assert.equal(unknownOption.status, 1, 'unknown CLI options must fail closed');

  const leakage = copy('leakage');
  const leakageManifestPath = path.join(leakage, 'manifest.json'); const leakageManifest = JSON.parse(fs.readFileSync(leakageManifestPath, 'utf8'));
  leakageManifest.cases[1].repositoryAlias = 'repo-alpha'; fs.writeFileSync(leakageManifestPath, JSON.stringify(leakageManifest), 'utf8');
  assert.throws(() => loadHistoricalPrCorpus(leakage), HistoricalPrEvaluationError);

  const unsafe = copy('unsafe'); const unsafeManifestPath = path.join(unsafe, 'manifest.json'); const unsafeManifest = JSON.parse(fs.readFileSync(unsafeManifestPath, 'utf8'));
  unsafeManifest.cases[0].directory = '../outside'; fs.writeFileSync(unsafeManifestPath, JSON.stringify(unsafeManifest), 'utf8');
  assert.throws(() => loadHistoricalPrCorpus(unsafe), HistoricalPrEvaluationError);

  const privateLabel = copy('private'); const privatePath = path.join(privateLabel, 'cases', 'case-routing', 'labels.json'); const labels = JSON.parse(fs.readFileSync(privatePath, 'utf8'));
  labels.concerns[0].rationale = 'see https://private.example.invalid'; fs.writeFileSync(privatePath, JSON.stringify(labels), 'utf8');
  assert.throws(() => loadHistoricalPrCorpus(privateLabel), HistoricalPrEvaluationError);

  const symlink = copy('symlink');
  try {
    const target = path.join(symlink, 'cases', 'case-routing', 'change.diff');
    fs.unlinkSync(target); fs.symlinkSync(path.join(root, 'examples', 'sample.diff'), target);
    assert.throws(() => loadHistoricalPrCorpus(symlink), HistoricalPrEvaluationError);
  } catch (error) {
    if (!(error instanceof HistoricalPrEvaluationError) && error.code !== 'EPERM') throw error;
  }
} finally { fs.rmSync(temporaryRoot, { recursive: true, force: true }); }

const implementation = fs.readFileSync(path.join(root, 'src', 'historicalPrEvaluation.js'), 'utf8');
assert(!implementation.includes('node:child_process'), 'evaluation loader must not execute commands');
assert(!/\b(?:spawn|exec)(?:Sync)?\s*\(/.test(implementation), 'evaluation loader must remain read-only');

console.log('historical PR evaluation contracts passed');
console.log('fixtures=valid,leakage,path-escape,privacy,symlink');
