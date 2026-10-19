#!/usr/bin/env node
// Local-only, evaluation-only preflight. No analysis of held-out diffs occurs.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { assessCalibrationPreflight } from '../src/calibrationPreflight.js';
import {
  EVALUATION_MAX_MANIFEST_BYTES,
  HistoricalPrEvaluationError,
  loadHistoricalPrCorpus
} from '../src/historicalPrEvaluation.js';

function print(result) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

function manifestScopeIsCalibrationOnly(corpusPath) {
  const manifestPath = path.join(path.resolve(corpusPath), 'manifest.json');
  const stat = fs.lstatSync(manifestPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > EVALUATION_MAX_MANIFEST_BYTES) {
    throw new Error('unacceptable-manifest');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return Array.isArray(manifest.cases) && manifest.cases.length > 0
    && manifest.cases.every((entry) => entry && entry.partition === 'calibration');
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node scripts/calibration-preflight.js --corpus <calibration-only-local-directory>');
  } else {
    if (args.length !== 2 || args[0] !== '--corpus' || !args[1] || args[1].startsWith('--')) {
      throw new Error('invalid-arguments');
    }
    // Reject a mixed corpus from manifest metadata alone before the loader
    // could read any held-out diff, label, or configuration.
    if (!manifestScopeIsCalibrationOnly(args[1])) {
      print({
        schemaVersion: 1,
        assessment: 'calibration-preflight',
        status: 'blocked',
        blockers: ['calibration-only-corpus-required'],
        semantics: 'Use a separate local calibration-only corpus. Held-out data was not loaded or analyzed.'
      });
      process.exitCode = 2;
    } else {
      const corpus = loadHistoricalPrCorpus(args[1]);
      const result = assessCalibrationPreflight(corpus);
      print(result);
      if (result.status === 'blocked') process.exitCode = 2;
    }
  }
} catch (error) {
  // Do not print source paths, local filesystem details, or private label data
  // from parser exceptions. Stable code counts are safe for local CI.
  const codes = error instanceof HistoricalPrEvaluationError
    ? error.diagnostics.map((item) => item.code).sort()
    : ['invalid-or-unavailable-corpus'];
  print({
    schemaVersion: 1,
    assessment: 'calibration-preflight',
    status: 'blocked',
    blockers: [...new Set(codes)],
    semantics: 'Local calibration validation failed; inspect private inputs locally. No raw evidence is included.'
  });
  process.exitCode = 2;
}
