#!/usr/bin/env node
// Explicit, local-only calibration measurement. Never loads a held-out case.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { assessCalibrationPreflight } from '../src/calibrationPreflight.js';
import { evaluateHistoricalPrCorpus, loadHistoricalPrCorpus } from '../src/historicalPrEvaluation.js';
import { pilotCorpusContentHash } from '../src/historicalPrPreregistration.js';

const COMMIT = /^[a-f0-9]{40}$/;
const HASHED_METRIC_SOURCES = [
  'src/historicalPrEvaluation.js',
  'src/findingComparison.js',
  'src/artifactManifest.js'
];

export function metricSourceHash(root = process.cwd()) {
  const hash = createHash('sha256');
  for (const name of HASHED_METRIC_SOURCES) {
    const data = fs.readFileSync(path.join(root, name));
    hash.update(name + '\0').update(data).update('\0');
  }
  return hash.digest('hex');
}

function calibrationOnlyManifest(root) {
  const filePath = path.join(path.resolve(root), 'manifest.json');
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 256 * 1024) return false;
  const manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(manifest.cases) && manifest.cases.length > 0
    && manifest.cases.every((item) => item && item.partition === 'calibration');
}

function safeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
}

export function measureCalibration(corpus, { productCommit, implementationHash }) {
  if (!COMMIT.test(productCommit || '')) throw new Error('invalid-product-commit');
  if (!/^[a-f0-9]{64}$/.test(implementationHash || '')) throw new Error('invalid-metric-implementation-hash');
  if (!Array.isArray(corpus?.records) || !corpus.records.length
    || corpus.records.some((record) => record.entry?.partition !== 'calibration')) {
    throw new Error('calibration-only-corpus-required');
  }
  const preflight = assessCalibrationPreflight(corpus);
  if (preflight.status !== 'human-verification-required') throw new Error('calibration-preflight-blocked');
  const evaluation = evaluateHistoricalPrCorpus(corpus);
  evaluation.aggregate.corpus.partition = 'calibration';
  const metadata = {
    schemaVersion: 1,
    kind: 'calibration-measurement',
    evidenceStatus: 'provisional-human-verification-required',
    productCommit, // caller assertion; no Git lookup
    metricImplementationHash: implementationHash,
    corpusContentHash: pilotCorpusContentHash(corpus),
    corpusManifestHash: corpus.manifestHash,
    calibrationCaseCount: corpus.records.length,
    preflightCounts: preflight.counts,
    semantics: 'Read-only local calibration measurement. This is not independently verified Phase 1 evidence, not an accuracy claim and not a Phase 2 authorization.'
  };
  return { metadata, aggregate: evaluation.aggregate, cases: {
    schemaVersion: 1,
    partition: 'calibration',
    cases: evaluation.caseResults
  } };
}

function usage() {
  console.log('Usage: node scripts/calibration-measure.js --corpus <local-calibration-only-directory> --output <new-local-directory> --product-commit <full-40-character-sha>');
}
function main(args) {
  if (args.length === 1 && args[0] === '--help') return usage();
  if (args.length !== 6 || args[0] !== '--corpus' || args[2] !== '--output' || args[4] !== '--product-commit'
    || [args[1], args[3], args[5]].some((value) => !value || value.startsWith('--'))) throw new Error('invalid-arguments');
  const corpusPath = path.resolve(args[1]);
  const outputPath = path.resolve(args[3]);
  const productCommit = args[5];
  if (!COMMIT.test(productCommit)) throw new Error('invalid-product-commit');
  if (!calibrationOnlyManifest(corpusPath)) throw new Error('calibration-only-corpus-required');
  if (fs.existsSync(outputPath)) throw new Error('output-already-exists');
  if (outputPath === corpusPath || outputPath.startsWith(corpusPath + path.sep)) throw new Error('output-inside-input-corpus');
  const result = measureCalibration(loadHistoricalPrCorpus(corpusPath), {
    productCommit,
    implementationHash: metricSourceHash()
  });
  fs.mkdirSync(outputPath, { recursive: true, mode: 0o700 });
  try {
    safeJson(path.join(outputPath, 'metadata.json'), result.metadata);
    safeJson(path.join(outputPath, 'aggregate.json'), result.aggregate);
    safeJson(path.join(outputPath, 'case-results.json'), result.cases);
  } catch (error) {
    fs.rmSync(outputPath, { recursive: true, force: true });
    throw error;
  }
  console.log(JSON.stringify({
    status: 'provisional-human-verification-required',
    caseCount: result.metadata.calibrationCaseCount,
    note: 'Private output written locally; no independent-label proof or release decision'
  }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // The command entry point is deliberately checked by argv rather than
  // running on import, keeping pure functions testable.
  try { main(process.argv.slice(2)); }
  catch { console.error('calibration measurement blocked; inspect local corpus and prerequisites'); process.exitCode = 2; }
}
