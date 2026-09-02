#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { evaluateHistoricalPrCorpus, HistoricalPrEvaluationError, loadHistoricalPrCorpus } from '../src/historicalPrEvaluation.js';
import { createPilotPreregistration, validatePilotPreregistration } from '../src/historicalPrPreregistration.js';

function option(args, name) { const index = args.indexOf(name); return index === -1 ? null : args[index + 1]; }
function writeJson(filePath, value) { if (fs.existsSync(filePath)) throw new Error(`refusing to overwrite existing output: ${filePath}`); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(filePath) { const stat = fs.lstatSync(filePath); if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 256 * 1024) throw new Error('preregistration must be a regular JSON file no larger than 256 KiB'); return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function help() { console.log('Usage: node scripts/evaluate-historical-prs.js --corpus <directory> --mode validate|preregister|run [--partition calibration|held-out] [--output <path>] [--product-commit <sha>] [--recorded-at <utc>] [--preregistration <file>]'); }

try {
  const args = process.argv.slice(2); if (args.includes('--help')) { help(); process.exit(0); }
  const known = new Set(['--corpus', '--mode', '--output', '--partition', '--product-commit', '--recorded-at', '--preregistration']); const unknown = args.filter((arg) => arg.startsWith('--') && !known.has(arg)); if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const corpusPath = option(args, '--corpus'); const mode = option(args, '--mode') || 'validate'; const output = option(args, '--output'); const partition = option(args, '--partition'); const productCommit = option(args, '--product-commit');
  if (!corpusPath || !['validate', 'preregister', 'run'].includes(mode)) throw new Error('require --corpus and --mode validate|preregister|run');
  if (mode === 'preregister' && (!output || !productCommit || !option(args, '--recorded-at'))) throw new Error('preregister requires --output, --product-commit, and --recorded-at');
  if (mode === 'run' && (!output || !['calibration', 'held-out'].includes(partition))) throw new Error('run requires --output and --partition calibration|held-out');
  const corpus = loadHistoricalPrCorpus(corpusPath);
  if (mode === 'validate') { console.log(JSON.stringify({ status: 'valid', corpusId: corpus.manifest.corpusId, caseCount: corpus.records.length, manifestHash: corpus.manifestHash }, null, 2)); process.exit(0); }
  if (mode === 'preregister') { const record = createPilotPreregistration(corpus, { productCommit, recordedAt: option(args, '--recorded-at') }); writeJson(path.resolve(output), record); console.log(JSON.stringify({ status: 'preregistered', preregistrationId: record.preregistrationId, output: path.resolve(output) }, null, 2)); process.exit(0); }
  let preregistration = null;
  if (partition === 'held-out') {
    const preregistrationPath = option(args, '--preregistration');
    if (!preregistrationPath || !productCommit) throw new Error('held-out run requires --preregistration and --product-commit');
    preregistration = readJson(path.resolve(preregistrationPath));
    const validation = validatePilotPreregistration(preregistration, corpus, { productCommit });
    if (!validation.valid) throw new HistoricalPrEvaluationError('held-out preregistration is invalid', validation.diagnostics);
  }
  const scopedCorpus = { ...corpus, records: corpus.records.filter((record) => record.entry.partition === partition) };
  if (!scopedCorpus.records.length) throw new Error(`corpus contains no ${partition} cases`);
  const outputRoot = path.resolve(output); if (fs.existsSync(outputRoot)) throw new Error('output directory must not already exist'); fs.mkdirSync(outputRoot, { recursive: true });
  const result = evaluateHistoricalPrCorpus(scopedCorpus); result.aggregate.corpus.partition = partition; if (preregistration) result.aggregate.corpus.preregistrationId = preregistration.preregistrationId;
  writeJson(path.join(outputRoot, 'aggregate.json'), result.aggregate); writeJson(path.join(outputRoot, 'case-results.json'), { schemaVersion: 1, partition, cases: result.caseResults });
  console.log(JSON.stringify({ status: 'completed', partition, output: outputRoot, corpusId: corpus.manifest.corpusId, caseCount: result.caseResults.length }, null, 2));
} catch (error) {
  const diagnostics = error instanceof HistoricalPrEvaluationError ? error.diagnostics : [];
  console.error(JSON.stringify({ error: error.message, diagnostics }, null, 2)); process.exitCode = 1;
}
