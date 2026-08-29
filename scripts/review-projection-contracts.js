#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createReviewProjection, REVIEW_PROJECTION_SCHEMA_VERSION } from '../src/reviewProjection.js';
import { buildCommentBody, MERGE_GUARD_COMMENT_MARKER, upsertPullRequestComment } from './pr-comment.js';

const root = process.cwd();
const base = {
  attemptOutcome: 'completed', scanExitCode: 0,
  reportAvailable: true, reportPath: 'merge-guard-report.json',
  manifestAvailable: true, manifestPath: 'merge-guard-report.manifest.json',
  annotationsRequested: true, annotationsAvailable: true, annotationsPath: 'merge-guard-annotations.json',
  sarifRequested: true, sarifAvailable: true, sarifPath: 'merge-guard.sarif',
  comparisonRequested: true, comparisonAvailable: true, comparisonPath: 'merge-guard-comparison.json', comparisonStatus: 'compared',
  commentRequested: true, commentEligible: true, commentStatus: 'produced', commentResult: 'updated'
};

assert.equal(REVIEW_PROJECTION_SCHEMA_VERSION, 1);
const complete = createReviewProjection(base);
assert.equal(complete.status, 'complete');
assert.equal(complete.channels.threshold.result, 'passed');
assert(Object.values(complete.channels).every((entry) => ['produced', 'skipped'].includes(entry.status)));

const fork = createReviewProjection({ ...base, commentStatus: 'unavailable', commentReason: 'resource not accessible by integration' });
assert.equal(fork.status, 'degraded');
assert.equal(fork.channels.report.status, 'produced');
assert.equal(fork.channels.comment.status, 'unavailable');
assert.equal(fork.channels.comparison.status, 'produced');

const threshold = createReviewProjection({ ...base, scanExitCode: 1 });
assert.equal(threshold.status, 'complete');
assert.equal(threshold.channels.threshold.result, 'failed');
assert.equal(threshold.channels.report.status, 'produced', 'threshold failure must retain authoritative evidence');

const partial = createReviewProjection({ ...base, reviewFailure: 'annotation adapter failed' });
assert.equal(partial.status, 'failed');
assert.equal(partial.channels.report.status, 'produced');
assert.equal(partial.channels.annotations.status, 'failed');
assert.equal(partial.channels.sarif.status, 'failed');

const canceled = createReviewProjection({ ...base, attemptOutcome: 'cancelled' });
assert.equal(canceled.status, 'incomplete');
assert(Object.values(canceled.channels).every((entry) => entry.status === 'incomplete'));
assert.deepEqual(createReviewProjection(base), complete, 'a rerun after cancellation must reconstruct the deterministic complete projection');

const comments = [];
const requests = [];
async function request({ method, url, body }) {
  requests.push(method);
  if (method === 'GET') return comments.map((entry) => ({ ...entry }));
  if (method === 'POST') {
    const created = { id: 42, body: body.body };
    comments.push(created);
    return created;
  }
  if (method === 'PATCH') {
    comments[0].body = body.body;
    return { ...comments[0] };
  }
  throw new Error(`unexpected request ${method} ${url}`);
}
const commentOptions = { repository: 'keepithandy/merge-guard', pullRequestNumber: 1, token: 'fixture', request };
assert.deepEqual(await upsertPullRequestComment({ ...commentOptions, body: buildCommentBody('first') }), { action: 'created', commentId: 42 });
assert.deepEqual(await upsertPullRequestComment({ ...commentOptions, body: buildCommentBody('duplicate event') }), { action: 'updated', commentId: 42 });
assert.deepEqual(await upsertPullRequestComment({ ...commentOptions, body: buildCommentBody('rerun') }), { action: 'updated', commentId: 42 });
assert.equal(comments.length, 1);
assert.equal(comments[0].body.split(MERGE_GUARD_COMMENT_MARKER).length - 1, 1);
assert.deepEqual(requests, ['GET', 'POST', 'GET', 'PATCH', 'GET', 'PATCH']);

await assert.rejects(
  upsertPullRequestComment({ ...commentOptions, request: async () => { throw new Error('resource not accessible by integration'); }, body: buildCommentBody('fork') }),
  /resource not accessible/
);

const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'review-projection-v1.schema.json'), 'utf8'));
assert.equal(schema.properties.schemaVersion.const, 1);
assert.deepEqual(schema.properties.status.enum, ['complete', 'degraded', 'failed', 'incomplete']);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-review-projection-'));
try {
  const reportPath = path.join(temporaryRoot, 'report.json');
  const manifestPath = path.join(temporaryRoot, 'manifest.json');
  const outputPath = path.join(temporaryRoot, 'projection.json');
  fs.writeFileSync(reportPath, '{}', 'utf8');
  fs.writeFileSync(manifestPath, '{}', 'utf8');
  const run = spawnSync(process.execPath, ['scripts/create-review-projection.js'], {
    cwd: root, encoding: 'utf8', env: {
      ...process.env,
      MERGE_GUARD_PROJECTION_PATH: outputPath,
      MERGE_GUARD_REPORT_PATH: reportPath,
      MERGE_GUARD_MANIFEST_PATH: manifestPath,
      MERGE_GUARD_COMMENT_REQUESTED: 'false',
      MERGE_GUARD_COMMENT_ELIGIBLE: 'false',
      MERGE_GUARD_ANNOTATIONS_REQUESTED: 'false',
      MERGE_GUARD_SARIF_REQUESTED: 'false',
      MERGE_GUARD_COMPARISON_REQUESTED: 'false',
      MERGE_GUARD_SCAN_EXIT_CODE: '1'
    }
  });
  assert.equal(run.status, 0, run.stderr);
  const projection = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(projection.status, 'complete');
  assert.equal(projection.channels.threshold.result, 'failed');
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('review projection resilience contracts passed');
console.log('scenarios=complete,fork-read-only,threshold,partial,cancel-recovery,duplicate-rerun');
