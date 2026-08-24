#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';
import {
  compareFindingReports,
  FindingComparisonError,
  formatFindingComparisonMarkdown
} from '../src/findingComparison.js';

function help() {
  console.log(`merge-guard finding comparison

Usage:
  node scripts/compare-reports.js --previous previous.json --current current.json
  node scripts/compare-reports.js --current current.json --output comparison.json --markdown

Options:
  --previous <path>  Previous immutable JSON report; omit only when history is unavailable
  --current <path>   Current immutable JSON report
  --output <path>    Also write comparison JSON to a file
  --markdown         Print a pull-request-friendly Markdown comparison
  --help             Show this help message

Exit codes:
  0  comparison completed
  1  invalid, unreadable, or incompatible input
  2  previous history unavailable; classifications are unknown
`);
}

function option(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a file path`);
  return value;
}

function readReport(filePath) {
  const stats = fs.lstatSync(filePath);
  if (stats.isSymbolicLink()) throw new Error(`symbolic links are not followed: ${filePath}`);
  if (!stats.isFile()) throw new Error(`path is not a regular file: ${filePath}`);
  if (stats.size > 10 * 1024 * 1024) throw new Error(`report exceeds 10 MB: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeOutput(filePath, comparison) {
  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isSymbolicLink()) {
    throw new Error(`refusing to write through symbolic link: ${filePath}`);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(comparison, null, 2)}\n`, 'utf8');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    help();
    return;
  }
  const known = new Set(['--previous', '--current', '--output', '--markdown']);
  const unknown = args.filter((arg) => arg.startsWith('--') && !known.has(arg));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);

  const previousPath = option(args, '--previous');
  const currentPath = option(args, '--current');
  const outputPath = option(args, '--output');
  const markdown = args.includes('--markdown');
  if (!currentPath) throw new Error('--current is required');

  const current = readReport(currentPath);
  const previous = previousPath ? readReport(previousPath) : null;
  const comparison = compareFindingReports(previous, current);
  if (outputPath) writeOutput(outputPath, comparison);
  console.log(markdown
    ? formatFindingComparisonMarkdown(comparison)
    : JSON.stringify(comparison, null, 2));
  if (!comparison.historyAvailable) process.exitCode = 2;
}

try {
  main();
} catch (error) {
  const payload = error instanceof FindingComparisonError
    ? { error: error.message, code: error.code, diagnostics: error.diagnostics }
    : { error: error.message, code: 'COMPARISON_IO_ERROR', diagnostics: [] };
  console.error(JSON.stringify(payload, null, 2));
  process.exitCode = 1;
}
