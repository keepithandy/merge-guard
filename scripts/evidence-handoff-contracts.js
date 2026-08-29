#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateArtifactManifest } from '../src/artifactManifest.js';

const root = process.cwd();
const action = fs.readFileSync(path.join(root, 'action.yml'), 'utf8');
const examplePath = path.join(root, 'docs', 'examples', 'github-actions-explicit-evidence-handoff.yml');
const example = fs.readFileSync(examplePath, 'utf8');

for (const token of [
  'previous-manifest:',
  'expected-previous-repository:',
  'expected-previous-branch:',
  'expected-previous-commit:',
  'manifest-path:',
  'prior-evidence-status:',
  'scripts/create-artifact-manifest.js',
  '--previous-manifest',
  '--expected-repository',
  '--expected-branch',
  '--expected-commit'
]) assert(action.includes(token), `Action must include ${token}`);
assert(!action.includes('actions/upload-artifact'), 'composite Action must not upload caller artifacts');
assert(!action.includes('actions/download-artifact'), 'composite Action must not download caller artifacts');
assert(!/\bgh\s+run\s+(?:list|delete)\b/.test(action), 'composite Action must not search or delete workflow runs');

for (const token of [
  'workflow_dispatch:',
  'prior_run_id:',
  'prior_artifact_name:',
  'prior_commit:',
  'actions: read',
  'contents: read',
  'gh run download "$PRIOR_RUN_ID" --name "$PRIOR_ARTIFACT_NAME"',
  'previous-report: .merge-guard-prior/merge-guard-report.json',
  'previous-manifest: .merge-guard-prior/merge-guard-report.manifest.json',
  'expected-previous-commit: ${{ inputs.prior_commit }}',
  'actions/upload-artifact@v4',
  'retention-days: 14',
  'if-no-files-found: error'
]) assert(example.includes(token), `handoff example must include ${token}`);
for (const forbidden of ['pull-requests: write', 'security-events: write', 'gh run list', 'gh run delete', 'PRIOR_RUN_ID=latest']) {
  assert(!example.includes(forbidden), `handoff example must not include ${forbidden}`);
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-evidence-handoff-'));
try {
  const reportPath = path.join(root, 'test', 'fixtures', 'finding-comparison', 'current.json');
  const manifestPath = path.join(temporaryRoot, 'report.manifest.json');
  const generated = spawnSync(process.execPath, [
    'scripts/create-artifact-manifest.js',
    '--report', reportPath,
    '--output', manifestPath,
    '--repository', 'example/project',
    '--branch', 'main',
    '--commit', 'abc123',
    '--input-type', 'report',
    '--generated-at', '2026-08-29T00:00:00.000Z'
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(validateArtifactManifest(manifest, { report }).valid, true);
  assert.equal(manifest.evidence.repository, 'example/project');
  assert.equal(manifest.evidence.branch, 'main');
  assert.equal(manifest.evidence.commit, 'abc123');

  const repeatedPath = path.join(temporaryRoot, 'repeated.manifest.json');
  const repeated = spawnSync(process.execPath, [
    'scripts/create-artifact-manifest.js',
    '--report', reportPath,
    '--output', repeatedPath,
    '--repository', 'example/project',
    '--branch', 'main',
    '--commit', 'abc123',
    '--input-type', 'report',
    '--generated-at', '2026-08-29T00:00:00.000Z'
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.equal(fs.readFileSync(repeatedPath, 'utf8'), fs.readFileSync(manifestPath, 'utf8'), 'explicit inputs must produce byte-stable manifests');
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

const implementation = fs.readFileSync(path.join(root, 'scripts', 'create-artifact-manifest.js'), 'utf8');
assert(!implementation.includes('node:child_process'), 'manifest helper must not execute commands');
assert(!/\b(?:fetch|https?\.request)\s*\(/.test(implementation), 'manifest helper must not access the network');

console.log('caller-owned evidence handoff contracts passed');
