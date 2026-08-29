#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createArtifactManifest } from '../src/artifactManifest.js';

const root = process.cwd();
const fixed = {
  repository: 'keepithandy/merge-guard',
  branch: 'codex/reproducibility-fixture',
  previousCommit: '1111111111111111111111111111111111111111',
  currentCommit: '2222222222222222222222222222222222222222',
  generatedAt: '2026-08-29T00:00:00.000Z'
};
const artifacts = [
  'previous-report.json', 'current-report.json', 'current-report.md',
  'previous-report.manifest.json', 'current-report.manifest.json',
  'annotations.json', 'merge-guard.sarif', 'comparison.json', 'comparison.md',
  'review-projection.json'
];

function runNode(cwd, args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, GITHUB_STEP_SUMMARY: '', ...options.env }
  });
  assert.ifError(result.error);
  assert.equal(result.status, options.status ?? 0, `${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return result;
}

function generateLane(laneRoot) {
  fs.mkdirSync(laneRoot, { recursive: true });
  const previousDiff = path.join(laneRoot, 'previous.diff');
  const currentDiff = path.join(laneRoot, 'current.diff');
  fs.copyFileSync(path.join(root, 'test', 'fixtures', 'review-e2e', 'push-1.diff'), previousDiff);
  fs.copyFileSync(path.join(root, 'test', 'fixtures', 'review-e2e', 'push-2.diff'), currentDiff);
  const cli = path.join(root, 'src', 'cli.js');
  runNode(laneRoot, [cli, '--ci', '--report-json', 'previous-report.json', '--fail-threshold', '99', 'previous.diff']);
  const current = runNode(laneRoot, [cli, '--ci', '--report-json', 'current-report.json', '--fail-threshold', '99', 'current.diff']);
  fs.writeFileSync(path.join(laneRoot, 'current-report.md'), current.stdout.replaceAll('\r\n', '\n'), 'utf8');

  const manifest = path.join(root, 'scripts', 'create-artifact-manifest.js');
  for (const [report, output, commit] of [
    ['previous-report.json', 'previous-report.manifest.json', fixed.previousCommit],
    ['current-report.json', 'current-report.manifest.json', fixed.currentCommit]
  ]) runNode(laneRoot, [manifest, '--report', report, '--output', output, '--repository', fixed.repository, '--branch', fixed.branch, '--commit', commit, '--input-type', 'diff', '--generated-at', fixed.generatedAt]);

  runNode(laneRoot, [path.join(root, 'scripts', 'github-review-outputs.js'), '--report', 'current-report.json', '--diff', 'current.diff', '--annotations', 'annotations.json', '--sarif', 'merge-guard.sarif']);
  const comparison = runNode(laneRoot, [
    path.join(root, 'scripts', 'compare-reports.js'),
    '--previous', 'previous-report.json', '--previous-manifest', 'previous-report.manifest.json',
    '--expected-repository', fixed.repository, '--expected-branch', fixed.branch, '--expected-commit', fixed.previousCommit,
    '--current', 'current-report.json', '--output', 'comparison.json', '--markdown'
  ]);
  fs.writeFileSync(path.join(laneRoot, 'comparison.md'), comparison.stdout.replaceAll('\r\n', '\n'), 'utf8');
  runNode(laneRoot, [path.join(root, 'scripts', 'create-review-projection.js')], { env: {
    MERGE_GUARD_PROJECTION_PATH: 'review-projection.json',
    MERGE_GUARD_SCAN_EXIT_CODE: '0',
    MERGE_GUARD_REPORT_PATH: 'current-report.json',
    MERGE_GUARD_MANIFEST_PATH: 'current-report.manifest.json',
    MERGE_GUARD_ANNOTATIONS_REQUESTED: 'true', MERGE_GUARD_ANNOTATIONS_PATH: 'annotations.json',
    MERGE_GUARD_SARIF_REQUESTED: 'true', MERGE_GUARD_SARIF_PATH: 'merge-guard.sarif',
    MERGE_GUARD_COMPARISON_REQUESTED: 'true', MERGE_GUARD_COMPARISON_PATH: 'comparison.json', MERGE_GUARD_COMPARISON_STATUS: 'compared',
    MERGE_GUARD_COMMENT_REQUESTED: 'true', MERGE_GUARD_COMMENT_ELIGIBLE: 'true', MERGE_GUARD_COMMENT_STATUS: 'produced', MERGE_GUARD_COMMENT_RESULT: 'previewed'
  }});
  return Object.fromEntries(artifacts.map((name) => [name, fs.readFileSync(path.join(laneRoot, name))]));
}

function hashes(outputs) {
  return Object.fromEntries(artifacts.map((name) => [name, createHash('sha256').update(outputs[name]).digest('hex')]));
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-reproducibility-'));
try {
  const local = generateLane(path.join(temporaryRoot, 'local'));
  const ci = generateLane(path.join(temporaryRoot, 'ci'));
  const repeat = generateLane(path.join(temporaryRoot, 'repeat'));
  for (const name of artifacts) {
    assert.deepEqual(ci[name], local[name], `${name} differs between local and CI-style lanes`);
    assert.deepEqual(repeat[name], local[name], `${name} differs on repeat generation`);
  }
  const actualHashes = hashes(local);
  const expectedHashes = JSON.parse(fs.readFileSync(path.join(root, 'test', 'snapshots', 'evidence-reproducibility-v1.json'), 'utf8'));
  if (process.env.MERGE_GUARD_PRINT_REPRO_HASHES === 'true') console.log(JSON.stringify(actualHashes, null, 2));
  assert.deepEqual(actualHashes, expectedHashes, 'durable review evidence hashes changed');

  const report = JSON.parse(local['current-report.json'].toString('utf8'));
  const evidence = { repository: fixed.repository, branch: fixed.branch, commit: fixed.currentCommit, inputType: 'diff', configuration: report.config };
  const first = createArtifactManifest({ report, evidence, generatedAt: fixed.generatedAt });
  const later = createArtifactManifest({ report, evidence, generatedAt: '2026-08-30T00:00:00.000Z' });
  const stableManifestEvidence = ({ artifactId, generated, ...value }) => ({ ...value, generated: { tool: generated.tool, toolVersion: generated.toolVersion } });
  assert.deepEqual(stableManifestEvidence(later), stableManifestEvidence(first), 'only generated.at and its derived artifactId may vary');
  assert.notEqual(later.generated.at, first.generated.at);
  assert.notEqual(later.artifactId, first.artifactId);

  console.log('durable review evidence reproducibility contracts passed');
  console.log(`artifacts=${artifacts.length}`);
  console.log('lanes=local,ci-style,repeat');
  console.log('generatedMetadataExclusions=manifest.generated.at,manifest.artifactId');
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
