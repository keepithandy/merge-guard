#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateHistoricalPrCorpus, HistoricalPrEvaluationError, loadHistoricalPrCorpus, EVALUATION_SCHEMA_VERSION } from '../src/historicalPrEvaluation.js';

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

for (const schema of ['historical-pr-corpus-v1.schema.json', 'historical-pr-labels-v1.schema.json', 'historical-pr-case-result-v1.schema.json', 'historical-pr-evaluation-result-v1.schema.json']) {
  const value = JSON.parse(fs.readFileSync(path.join(root, 'schemas', schema), 'utf8'));
  assert.equal(value.properties.schemaVersion.const, 1);
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-historical-evaluation-'));
try {
  const copy = (name) => { const target = path.join(temporaryRoot, name); fs.cpSync(fixtureRoot, target, { recursive: true }); return target; };
  const valid = copy('valid');
  const validate = spawnSync(process.execPath, ['scripts/evaluate-historical-prs.js', '--corpus', valid, '--mode', 'validate'], { cwd: root, encoding: 'utf8' });
  assert.equal(validate.status, 0, validate.stderr);
  assert.equal(JSON.parse(validate.stdout).status, 'valid');
  const output = path.join(temporaryRoot, 'output');
  const run = spawnSync(process.execPath, ['scripts/evaluate-historical-prs.js', '--corpus', valid, '--mode', 'run', '--output', output], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const aggregateText = fs.readFileSync(path.join(output, 'aggregate.json'), 'utf8');
  assert(!aggregateText.includes('fetch'), 'CLI aggregate must remain content-free');
  assert.equal(JSON.parse(aggregateText).metrics.supportedScopeRecall.value, 1);
  const rerun = spawnSync(process.execPath, ['scripts/evaluate-historical-prs.js', '--corpus', valid, '--mode', 'run', '--output', output], { cwd: root, encoding: 'utf8' });
  assert.equal(rerun.status, 1, 'existing output may not be overwritten');
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
