#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';
import {
  createGithubAnnotationBundle,
  createSarifLog,
  formatGithubWorkflowCommands
} from '../src/githubReviewOutputs.js';

function help() {
  console.log(`merge-guard GitHub review outputs

Usage:
  node scripts/github-review-outputs.js --report report.json --diff change.diff --annotations annotations.json
  node scripts/github-review-outputs.js --report report.json --diff change.diff --sarif merge-guard.sarif

Options:
  --report <path>       Completed merge-guard JSON report
  --diff <path>         Authoritative unified diff used to build the report
  --annotations <path> Write versioned annotation bundle JSON
  --sarif <path>        Write SARIF 2.1.0 output
  --emit-commands       Emit eligible GitHub workflow annotation commands
  --help                Show this help message
`);
}

function option(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a file path`);
  return value;
}

function readRegularFile(filePath, maxBytes) {
  const stats = fs.lstatSync(filePath);
  if (stats.isSymbolicLink()) throw new Error(`symbolic links are not followed: ${filePath}`);
  if (!stats.isFile()) throw new Error(`path is not a regular file: ${filePath}`);
  if (stats.size > maxBytes) throw new Error(`file exceeds ${maxBytes} bytes: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function writeJson(filePath, value) {
  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isSymbolicLink()) {
    throw new Error(`refusing to write through symbolic link: ${filePath}`);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    help();
    return;
  }
  const known = new Set(['--report', '--diff', '--annotations', '--sarif', '--emit-commands']);
  const unknown = args.filter((arg) => arg.startsWith('--') && !known.has(arg));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);

  const reportPath = option(args, '--report');
  const diffPath = option(args, '--diff');
  const annotationPath = option(args, '--annotations');
  const sarifPath = option(args, '--sarif');
  const emitCommands = args.includes('--emit-commands');
  if (!reportPath || !diffPath) throw new Error('--report and --diff are required');
  if (!annotationPath && !sarifPath && !emitCommands) {
    throw new Error('select --annotations, --sarif, or --emit-commands');
  }

  const report = JSON.parse(readRegularFile(reportPath, 10 * 1024 * 1024));
  const diffText = readRegularFile(diffPath, 20 * 1024 * 1024);
  if (!Number.isInteger(report.schemaVersion) || !Array.isArray(report.rules)) {
    throw new Error('report does not match the merge-guard JSON report contract');
  }
  const bundle = createGithubAnnotationBundle(report, diffText);
  if (annotationPath) writeJson(annotationPath, bundle);
  if (sarifPath) writeJson(sarifPath, createSarifLog(report, bundle));
  if (emitCommands) {
    const commands = formatGithubWorkflowCommands(bundle);
    if (commands) process.stdout.write(`${commands}\n`);
  }
  console.error(`merge-guard review outputs: ${bundle.annotations.length} annotation(s), ${bundle.unsupported.length} unsupported finding location(s)`);
}

try {
  main();
} catch (error) {
  console.error('merge-guard review output error:', error.message);
  process.exitCode = 1;
}
