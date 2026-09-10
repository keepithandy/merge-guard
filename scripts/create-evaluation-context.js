#!/usr/bin/env node

import fs from 'node:fs';
import { createEvaluationContext, sha256 } from '../src/evaluationContext.js';

function option(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function options(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) continue;
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
    values.push(value);
  }
  return values;
}

function help() {
  console.log(`merge-guard evaluation context

Usage:
  node scripts/create-evaluation-context.js --output context.json --base-sha <sha> --head-sha <sha> --tested-sha <sha>

Options:
  --output <path>             Context file to create
  --base-sha <sha>            Trusted pull-request base commit
  --head-sha <sha>            Pull-request head commit
  --tested-sha <sha>          Exact checkout evaluated by the scanner
  --input-type <type>         git-range or prebuilt-diff
  --starter-policy-revision <sha>  Base revision for materialized starter packs
  --policy-source <path>      Original repository-relative manifest path
  --policy-snapshot <path>    Materialized trusted manifest bytes
  --policy-changed <path>     Repository policy path changed by the pull request
  --help                      Show this help message
`);
}

function readSnapshot(filePath) {
  const stats = fs.lstatSync(filePath);
  if (stats.isSymbolicLink()) throw new Error(`symbolic links are not followed: ${filePath}`);
  if (!stats.isFile()) throw new Error(`policy snapshot is not a regular file: ${filePath}`);
  if (stats.size > 1024 * 1024) throw new Error(`policy snapshot exceeds 1 MB: ${filePath}`);
  return fs.readFileSync(filePath);
}

function writeContext(filePath, context) {
  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isSymbolicLink()) {
    throw new Error(`refusing to write through symbolic link: ${filePath}`);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(context, null, 2)}\n`, 'utf8');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) return help();
  const known = new Set(['--output', '--base-sha', '--head-sha', '--tested-sha', '--input-type', '--starter-policy-revision', '--policy-source', '--policy-snapshot', '--policy-changed']);
  const unknown = args.filter((arg) => arg.startsWith('--') && !known.has(arg));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);

  const output = option(args, '--output');
  const baseSha = option(args, '--base-sha');
  const headSha = option(args, '--head-sha');
  const testedSha = option(args, '--tested-sha');
  const inputType = option(args, '--input-type');
  const starterPolicyRevision = option(args, '--starter-policy-revision');
  const policySourcePath = option(args, '--policy-source');
  const policySnapshotPath = option(args, '--policy-snapshot');
  const policyChangedPaths = options(args, '--policy-changed');
  if (!output || !baseSha || !headSha || !testedSha) {
    throw new Error('--output, --base-sha, --head-sha, and --tested-sha are required');
  }
  if (Boolean(policySourcePath) !== Boolean(policySnapshotPath)) {
    throw new Error('--policy-source and --policy-snapshot must be supplied together');
  }

  const policySource = policySourcePath
    ? { path: policySourcePath, revision: baseSha, sha256: sha256(readSnapshot(policySnapshotPath)) }
    : null;
  const context = createEvaluationContext({
    schemaVersion: 1,
    baseSha,
    headSha,
    testedSha,
    ...(inputType ? { inputType } : {}),
    ...(starterPolicyRevision ? { starterPolicyRevision } : {}),
    ...(policySource ? { policySource } : {}),
    ...(policyChangedPaths.length ? { policyChanges: policyChangedPaths } : {})
  });
  writeContext(output, context);
  console.log(`wrote ${output}`);
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ error: error.message, code: 'EVALUATION_CONTEXT_IO_ERROR', diagnostics: error.diagnostics || [] }, null, 2));
  process.exitCode = 1;
}
