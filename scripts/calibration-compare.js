#!/usr/bin/env node
// Compare two already captured calibration snapshots, never raw diffs.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { compareCalibrationMeasurements } from '../src/calibrationComparison.js';

function readJson(root, filename) {
  const filePath = path.join(path.resolve(root), filename);
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8_000_000) throw new Error('invalid-measurement-file');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function readMeasurement(root) {
  return {
    metadata: readJson(root, 'metadata.json'),
    aggregate: readJson(root, 'aggregate.json'),
    cases: readJson(root, 'case-results.json')
  };
}
function usage() {
  console.log('Usage: node scripts/calibration-compare.js --baseline <local-measurement-directory> --candidate <local-measurement-directory> --output <new-local-json-path>');
}
function main(args) {
  if (args.length === 1 && args[0] === '--help') return usage();
  if (args.length !== 6 || args[0] !== '--baseline' || args[2] !== '--candidate' || args[4] !== '--output'
    || [args[1], args[3], args[5]].some((v) => !v || v.startsWith('--'))) throw new Error('invalid-arguments');
  const output = path.resolve(args[5]);
  if (fs.existsSync(output)) throw new Error('output-already-exists');
  const result = compareCalibrationMeasurements(readMeasurement(args[1]), readMeasurement(args[3]));
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({
    status: result.status, caseCount: result.caseCount,
    actionablePrecisionPercentagePointChange: result.metrics.actionablePrecision.percentagePointChange,
    supportedScopeRecallPercentagePointChange: result.metrics.supportedScopeRecall.percentagePointChange,
    note: 'Content-free local comparison written. Human evidence verification remains mandatory.'
  }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch { console.error('calibration comparison blocked: invalid, unsafe, incompatible, or unavailable local snapshots'); process.exitCode = 2; }
}
