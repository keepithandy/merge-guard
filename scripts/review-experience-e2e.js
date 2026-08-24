#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildCommentBody,
  findMergeGuardComment,
  MERGE_GUARD_COMMENT_MARKER,
  upsertPullRequestComment
} from './pr-comment.js';

const root = process.cwd();
const fixtureRoot = path.join(root, 'test', 'fixtures', 'review-e2e');
const eventRoot = path.join(root, 'test', 'fixtures', 'github-events');
const snapshotPath = path.join(root, 'test', 'snapshots', 'review-experience-e2e.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runNode(args, expectedStatus) {
  const run = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_STEP_SUMMARY: '' },
    maxBuffer: 10 * 1024 * 1024
  });
  assert.ifError(run.error);
  assert.equal(
    run.status,
    expectedStatus,
    `node ${args.join(' ')} exited ${run.status}\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`
  );
  return run;
}

const openedEvent = readJson(path.join(eventRoot, 'pull-request-opened.json'));
const synchronizeEvent = readJson(path.join(eventRoot, 'pull-request-synchronize.json'));
assert.equal(openedEvent.action, 'opened');
assert.equal(synchronizeEvent.action, 'synchronize');
assert.equal(openedEvent.pull_request.number, synchronizeEvent.pull_request.number);
assert.equal(synchronizeEvent.before, openedEvent.pull_request.head.sha);
assert.equal(synchronizeEvent.after, synchronizeEvent.pull_request.head.sha);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-review-e2e-'));
try {
  const firstBodyPath = path.join(temporaryRoot, 'push-1-body.md');
  const secondBodyPath = path.join(temporaryRoot, 'push-2-body.md');
  const firstReportPath = path.join(temporaryRoot, 'push-1-report.json');
  const secondReportPath = path.join(temporaryRoot, 'push-2-report.json');
  const thresholdReportPath = path.join(temporaryRoot, 'threshold-report.json');
  const annotationsPath = path.join(temporaryRoot, 'annotations.json');
  const sarifPath = path.join(temporaryRoot, 'merge-guard.sarif');
  const comparisonPath = path.join(temporaryRoot, 'comparison.json');
  const missingHistoryPath = path.join(temporaryRoot, 'missing-history.json');
  const firstDiffPath = path.join(fixtureRoot, 'push-1.diff');
  const secondDiffPath = path.join(fixtureRoot, 'push-2.diff');

  fs.writeFileSync(firstBodyPath, openedEvent.pull_request.body, 'utf8');
  fs.writeFileSync(secondBodyPath, synchronizeEvent.pull_request.body, 'utf8');

  const reportOnly = runNode([
    'src/cli.js',
    '--ci',
    '--report-json', firstReportPath,
    '--fail-threshold', '99',
    '--pr-title', openedEvent.pull_request.title,
    '--pr-body', firstBodyPath,
    firstDiffPath
  ], 0);
  assert(reportOnly.stdout.includes('# merge-guard report'));

  const firstCommentMode = runNode([
    'src/cli.js',
    '--ci',
    '--pr-summary',
    '--fail-threshold', '99',
    '--pr-title', openedEvent.pull_request.title,
    '--pr-body', firstBodyPath,
    firstDiffPath
  ], 0);
  assert(firstCommentMode.stdout.includes('<!-- merge-guard-pr-summary:v1 -->'));

  const commentMode = runNode([
    'src/cli.js',
    '--ci',
    '--pr-summary',
    '--report-json', secondReportPath,
    '--fail-threshold', '99',
    '--pr-title', synchronizeEvent.pull_request.title,
    '--pr-body', secondBodyPath,
    secondDiffPath
  ], 0);
  assert(commentMode.stdout.includes('<!-- merge-guard-pr-summary:v1 -->'));
  assert(commentMode.stdout.includes('## merge-guard review summary'));

  const reviewOutputs = runNode([
    'scripts/github-review-outputs.js',
    '--report', secondReportPath,
    '--diff', secondDiffPath,
    '--annotations', annotationsPath,
    '--sarif', sarifPath,
    '--emit-commands'
  ], 0);
  assert(reviewOutputs.stdout.includes('::warning file='));

  const compared = runNode([
    'scripts/compare-reports.js',
    '--previous', firstReportPath,
    '--current', secondReportPath,
    '--output', comparisonPath,
    '--markdown'
  ], 0);
  assert(compared.stdout.includes('Merge Guard finding comparison'));

  const missingHistory = runNode([
    'scripts/compare-reports.js',
    '--current', secondReportPath,
    '--output', missingHistoryPath
  ], 2);
  assert(missingHistory.stdout.includes('history-unavailable'));

  const threshold = runNode([
    'src/cli.js',
    '--ci',
    '--report-json', thresholdReportPath,
    '--fail-threshold', '1',
    secondDiffPath
  ], 1);
  assert(threshold.stdout.includes('# merge-guard report'));
  assert(fs.existsSync(thresholdReportPath), 'threshold failure must retain its immutable JSON report');

  const firstReport = readJson(firstReportPath);
  const secondReport = readJson(secondReportPath);
  const annotations = readJson(annotationsPath);
  const sarif = readJson(sarifPath);
  const comparison = readJson(comparisonPath);
  const unavailable = readJson(missingHistoryPath);
  assert.equal(firstReport.schemaVersion, 1);
  assert.equal(secondReport.schemaVersion, 1);
  assert.deepEqual(comparison.summary, { new: 2, unchanged: 2, resolved: 2 });
  assert.equal(annotations.annotations.length, 4);
  assert.equal(sarif.runs[0].results.length, annotations.annotations.length);

  const comments = [{
    id: 7,
    body: `Human review quoting a marker later in the body:\n${MERGE_GUARD_COMMENT_MARKER}`
  }];
  const requests = [];
  async function offlineRequest({ method, url, token, body }) {
    assert.equal(token, 'offline-fixture-token');
    requests.push({ method, url });
    if (method === 'GET') return comments.map((comment) => ({ ...comment }));
    if (method === 'POST') {
      const created = { id: 9001, body: body.body };
      comments.push(created);
      return { ...created };
    }
    if (method === 'PATCH') {
      const commentId = Number(url.split('/').at(-1));
      const existing = comments.find((comment) => comment.id === commentId);
      assert(existing, `missing fixture comment ${commentId}`);
      existing.body = body.body;
      return { ...existing };
    }
    throw new Error(`unexpected offline request: ${method} ${url}`);
  }

  const firstCommentBody = buildCommentBody(`${firstCommentMode.stdout}\n<!-- review-fixture-push:1 -->`);
  const created = await upsertPullRequestComment({
    repository: openedEvent.repository.full_name,
    pullRequestNumber: openedEvent.pull_request.number,
    token: 'offline-fixture-token',
    body: firstCommentBody,
    request: offlineRequest
  });
  assert.deepEqual(created, { action: 'created', commentId: 9001 });

  const secondCommentBody = buildCommentBody(
    `${commentMode.stdout}\n${compared.stdout}\n<!-- review-fixture-push:2 -->`
  );
  const updated = await upsertPullRequestComment({
    repository: synchronizeEvent.repository.full_name,
    pullRequestNumber: synchronizeEvent.pull_request.number,
    token: 'offline-fixture-token',
    body: secondCommentBody,
    request: offlineRequest
  });
  assert.deepEqual(updated, { action: 'updated', commentId: 9001 });

  const managedComments = comments.filter((comment) =>
    comment.body.trimStart().startsWith(MERGE_GUARD_COMMENT_MARKER)
  );
  assert.equal(managedComments.length, 1, 'rerun must update one managed comment');
  assert.equal(findMergeGuardComment(comments)?.id, 9001);
  assert(managedComments[0].body.includes('<!-- review-fixture-push:2 -->'));
  assert(!managedComments[0].body.includes('<!-- review-fixture-push:1 -->'));
  assert.equal(managedComments[0].body.split(MERGE_GUARD_COMMENT_MARKER).length - 1, 1);

  const result = {
    schemaVersion: 1,
    events: {
      pullRequestNumber: openedEvent.pull_request.number,
      actions: [openedEvent.action, synchronizeEvent.action],
      heads: [openedEvent.pull_request.head.sha, synchronizeEvent.pull_request.head.sha]
    },
    modes: {
      reportOnly: { exitCode: reportOnly.status, riskScore: firstReport.riskScore },
      comment: { exitCode: commentMode.status, riskScore: secondReport.riskScore }
    },
    reviewOutputs: {
      annotationSchemaVersion: annotations.schemaVersion,
      annotations: annotations.annotations.length,
      unsupported: annotations.unsupported.length,
      sarifVersion: sarif.version,
      sarifResults: sarif.runs[0].results.length
    },
    comparison: {
      status: comparison.status,
      summary: comparison.summary
    },
    missingHistory: {
      exitCode: missingHistory.status,
      status: unavailable.status,
      classificationAvailable: unavailable.classificationAvailable
    },
    threshold: {
      exitCode: threshold.status,
      reportProduced: fs.existsSync(thresholdReportPath)
    },
    commentUpsert: {
      actions: [created.action, updated.action],
      commentId: updated.commentId,
      managedComments: managedComments.length,
      requestMethods: requests.map((request) => request.method)
    }
  };

  assert.deepEqual(result, readJson(snapshotPath));
  console.log('review experience end-to-end fixture passed');
  console.log(`comparison=${comparison.summary.new} new/${comparison.summary.unchanged} unchanged/${comparison.summary.resolved} resolved`);
  console.log(`annotations=${annotations.annotations.length}`);
  console.log(`comment=${created.action}->${updated.action}`);
  console.log(`exitCodes=report:${reportOnly.status},comment:${commentMode.status},history:${missingHistory.status},threshold:${threshold.status}`);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
