#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';
import { analyzeDiff, formatMarkdownReport, formatReport } from './analyzeDiff.js';
import { createAiReviewSummary } from './aiReview.js';

const KNOWN_OPTIONS = new Set(['--json', '--markdown', '--ci', '--ai', '--preset', '--help', '-h']);
const VALID_PRESETS = new Set(['safe', 'standard', 'strict']);

function printHelp() {
  console.log(`merge-guard

Usage:
  merge-guard <path-to-diff>
  git diff | merge-guard
  node src/cli.js examples/sample.diff

Options:
  --json              Print the report as JSON
  --markdown          Print the report as Markdown
  --ci                Print Markdown, write to GITHUB_STEP_SUMMARY when available, and fail on configured high risk
  --ai                Add an optional AI-ready review summary to the report
  --preset <preset>   Use risk preset: safe, standard, or strict
  --help              Show this help message

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

function getOptionValue(args, optionName) {
  const optionIndex = args.indexOf(optionName);
  if (optionIndex === -1) return null;

  const value = args[optionIndex + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value`);
  }

  return value;
}

function findFileArg(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--preset') {
      index += 1;
      continue;
    }

    if (!arg.startsWith('--')) {
      return arg;
    }
  }

  return null;
}

function validateOptions(args) {
  const unknown = args.filter((arg) => arg.startsWith('--') && !KNOWN_OPTIONS.has(arg));
  if (unknown.length) {
    throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  }
}

function resolveConfig(args) {
  const config = loadConfig();
  const preset = getOptionValue(args, '--preset');

  if (preset) {
    const normalizedPreset = preset.trim().toLowerCase();
    if (!VALID_PRESETS.has(normalizedPreset)) {
      throw new Error(`invalid preset: ${preset}. Use safe, standard, or strict.`);
    }

    config.preset = normalizedPreset;
  }

  return config;
}

function writeGitHubStepSummary(markdown) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  fs.appendFileSync(summaryFile, `${markdown}\n`, 'utf8');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  validateOptions(args);

  const jsonMode = args.includes('--json');
  const markdownMode = args.includes('--markdown');
  const ciMode = args.includes('--ci');
  const aiMode = args.includes('--ai');
  const fileArg = findFileArg(args);

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

  const report = analyzeDiff(diffText, resolveConfig(args));

  if (aiMode) {
    report.aiReview = createAiReviewSummary(report, diffText);
  }

  const markdown = formatMarkdownReport(report);

  if (ciMode) {
    writeGitHubStepSummary(markdown);
  }

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else if (markdownMode || ciMode) {
    console.log(markdown);
  } else {
    console.log(formatReport(report));
  }

  if (ciMode && report.riskScore >= report.config.failThreshold) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('merge-guard error:', error.message);
  process.exitCode = 1;
});
