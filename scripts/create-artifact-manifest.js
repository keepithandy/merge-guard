#!/usr/bin/env node

import fs from 'node:fs';
import { createArtifactManifest } from '../src/artifactManifest.js';

function option(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function help() {
  console.log(`merge-guard artifact manifest

Usage:
  node scripts/create-artifact-manifest.js --report report.json --output report.manifest.json --repository owner/name --commit abc123 --branch main

Options:
  --report <path>       Explicit Merge Guard JSON report
  --output <path>       Manifest output path
  --repository <name>   Repository identity recorded as evidence
  --commit <sha>        Commit identity recorded as evidence
  --branch <name>       Optional branch identity recorded as evidence
  --input-type <type>   diff or report; default diff
  --generated-at <iso>  Optional ISO timestamp; defaults to current time
  --help                Show this help message
`);
}

function readReport(filePath) {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink()) throw new Error(`symbolic links are not followed: ${filePath}`);
  if (!stat.isFile()) throw new Error(`report is not a regular file: ${filePath}`);
  if (stat.size > 10 * 1024 * 1024) throw new Error(`report exceeds 10 MB: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeManifest(filePath, manifest) {
  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isSymbolicLink()) {
    throw new Error(`refusing to write through symbolic link: ${filePath}`);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) return help();
  const known = new Set(['--report', '--output', '--repository', '--commit', '--branch', '--input-type', '--generated-at']);
  const unknown = args.filter((arg) => arg.startsWith('--') && !known.has(arg));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);

  const reportPath = option(args, '--report');
  const outputPath = option(args, '--output');
  const repository = option(args, '--repository');
  const commit = option(args, '--commit');
  const branch = option(args, '--branch');
  const inputType = option(args, '--input-type') || 'diff';
  const generatedAt = option(args, '--generated-at') || new Date().toISOString();
  if (!reportPath || !outputPath || !repository || !commit) {
    throw new Error('--report, --output, --repository, and --commit are required');
  }

  const report = readReport(reportPath);
  const evidence = {
    repository,
    commit,
    inputType,
    ...(branch ? { branch } : {}),
    configuration: report.config || {}
  };
  const manifest = createArtifactManifest({ report, evidence, generatedAt });
  writeManifest(outputPath, manifest);
  console.log(`wrote ${outputPath}`);
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ error: error.message, code: error.code || 'ARTIFACT_MANIFEST_IO_ERROR', diagnostics: error.diagnostics || [] }, null, 2));
  process.exitCode = 1;
}
