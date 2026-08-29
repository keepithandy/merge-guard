#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { evaluateHistoricalPrCorpus, HistoricalPrEvaluationError, loadHistoricalPrCorpus } from '../src/historicalPrEvaluation.js';

function option(args, name) { const index = args.indexOf(name); return index === -1 ? null : args[index + 1]; }
function writeJson(filePath, value) { if (fs.existsSync(filePath)) throw new Error(`refusing to overwrite existing output: ${filePath}`); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function help() { console.log('Usage: node scripts/evaluate-historical-prs.js --corpus <directory> --mode validate|run [--output <directory>]'); }

try {
  const args = process.argv.slice(2); if (args.includes('--help')) { help(); process.exit(0); }
  const known = new Set(['--corpus', '--mode', '--output']); const unknown = args.filter((arg) => arg.startsWith('--') && !known.has(arg)); if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const corpusPath = option(args, '--corpus'); const mode = option(args, '--mode') || 'validate'; const output = option(args, '--output');
  if (!corpusPath || !['validate', 'run'].includes(mode) || (mode === 'run' && !output)) throw new Error('require --corpus and --mode validate|run; --output is required for run');
  const corpus = loadHistoricalPrCorpus(corpusPath);
  if (mode === 'validate') { console.log(JSON.stringify({ status: 'valid', corpusId: corpus.manifest.corpusId, caseCount: corpus.records.length, manifestHash: corpus.manifestHash }, null, 2)); process.exit(0); }
  const outputRoot = path.resolve(output); if (fs.existsSync(outputRoot)) throw new Error('output directory must not already exist'); fs.mkdirSync(outputRoot, { recursive: true });
  const result = evaluateHistoricalPrCorpus(corpus); writeJson(path.join(outputRoot, 'aggregate.json'), result.aggregate); writeJson(path.join(outputRoot, 'case-results.json'), { schemaVersion: 1, cases: result.caseResults });
  console.log(JSON.stringify({ status: 'completed', output: outputRoot, corpusId: corpus.manifest.corpusId, caseCount: result.caseResults.length }, null, 2));
} catch (error) {
  const diagnostics = error instanceof HistoricalPrEvaluationError ? error.diagnostics : [];
  console.error(JSON.stringify({ error: error.message, diagnostics }, null, 2)); process.exitCode = 1;
}
