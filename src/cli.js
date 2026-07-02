#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';
import { analyzeDiff, formatMarkdownReport, formatReport } from './analyzeDiff.js';
import { createAiReviewSummary } from './aiReview.js';

const KNOWN_OPTIONS = new Set(['--json', '--markdown', '--ci', '--ai', '--help', '-h']);

function printHelp() {
  console.log(`merge-guard

Usage:
  merge-guard <path-to-diff>
  git diff | merge-guard
  node src/cli.js examples/sample.diff

Options:
  --json       Print the report as JSON
  --markdown   Print the report as Markdown
  --ci         Print Markdown, write to GITHUB_STEP_SUMMARY when available, and fail on configured high risk
  --ai         Add an optional AI-ready review summary to the report
  --help       Show this help message

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

function findFileArg(args) {
  return args.find((arg) => !arg.startsWith('--'));
}

function validateOptions(args) {
  const unknown = args.filter((arg) => arg.startsWith('--') && !KNOWN_OPTIONS.has(arg));
  if (unknown.length) {
    throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  }
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

  const report = analyzeDiff(diffText, loadConfig());

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
