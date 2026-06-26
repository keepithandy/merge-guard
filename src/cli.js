#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';
import { analyzeDiff, formatReport } from './analyzeDiff.js';

function printHelp() {
  console.log(`merge-guard

Usage:
  merge-guard <path-to-diff>
  git diff | merge-guard
  node src/cli.js examples/sample.diff

Options:
  --json     Print the report as JSON
  --help     Show this help message

Config:
  merge-guard reads merge-guard.config.json when it exists in the current directory.
`);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function loadConfig() {
  const configFile = 'merge-guard.config.json';

  if (!fs.existsSync(configFile)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch (error) {
    throw new Error(`invalid merge-guard.config.json: ${error.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const jsonMode = args.includes('--json');
  const fileArg = args.find((arg) => !arg.startsWith('--'));

  let diffText = '';

  if (fileArg) {
    if (!fs.existsSync(fileArg)) {
      console.error(`merge-guard error: file not found: ${fileArg}`);
      process.exitCode = 1;
      return;
    }

    diffText = fs.readFileSync(fileArg, 'utf8');
  } else if (!process.stdin.isTTY) {
    diffText = await readStdin();
  } else {
    printHelp();
    return;
  }

  if (!diffText.trim()) {
    console.error('merge-guard error: no diff content provided');
    process.exitCode = 1;
    return;
  }

  const report = analyzeDiff(diffText, loadConfig());

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReport(report));
  }
}

main().catch((error) => {
  console.error('merge-guard error:', error.message);
  process.exitCode = 1;
});
