#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeDiff } from '../src/analyzeDiff.js';
import { applyPrContext } from '../src/prContext.js';
import {
  formatPullRequestSummary,
  PULL_REQUEST_SUMMARY_MARKER,
  PULL_REQUEST_SUMMARY_VERSION
} from '../src/pullRequestSummary.js';
import {
  buildCommentBody,
  findMergeGuardComment,
  getPullRequestNumber,
  MERGE_GUARD_COMMENT_MARKER
} from './pr-comment.js';

const root = process.cwd();
const fixtureRoot = path.join(root, 'test', 'fixtures', 'github-events');
const snapshotRoot = path.join(root, 'test', 'snapshots');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function event(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, `${name}.json`), 'utf8'));
}

function assertSnapshot(name, actual) {
  const snapshotPath = path.join(snapshotRoot, `${name}.md`);
  assert(fs.existsSync(snapshotPath), `missing Markdown snapshot: ${snapshotPath}`);
  assert.equal(actual, fs.readFileSync(snapshotPath, 'utf8').trimEnd(), `${name} snapshot mismatch`);
}

assert.equal(PULL_REQUEST_SUMMARY_VERSION, 1);
assert.equal(PULL_REQUEST_SUMMARY_MARKER, '<!-- merge-guard-pr-summary:v1 -->');

const opened = event('pull-request-opened');
const synchronize = event('pull-request-synchronize');
assert.equal(getPullRequestNumber(opened), 63);
assert.equal(getPullRequestNumber(synchronize), 63);
assert.equal(synchronize.before, opened.pull_request.head.sha);
assert.equal(synchronize.after, synchronize.pull_request.head.sha);
assert.throws(() => getPullRequestNumber({ action: 'workflow_dispatch' }), /pull request number/);

const diffText = read('examples/sample.diff');
const plainReport = analyzeDiff(diffText);
const contextualReport = applyPrContext(analyzeDiff(diffText), {
  title: opened.pull_request.title,
  body: opened.pull_request.body
});
assert.equal(contextualReport.riskScore, plainReport.riskScore);
assert.equal(contextualReport.riskLevel, plainReport.riskLevel);
assert.equal(contextualReport.mergeReadiness, plainReport.mergeReadiness);

const reportBefore = JSON.stringify(contextualReport);
const standardSummary = formatPullRequestSummary(contextualReport);
assert.equal(JSON.stringify(contextualReport), reportBefore, 'summary formatting must not mutate reports');
assert(standardSummary.startsWith('## merge-guard review summary'));
assert(standardSummary.includes(PULL_REQUEST_SUMMARY_MARKER));
assert(standardSummary.includes(`score **${contextualReport.riskScore}**`));
assert(standardSummary.includes('<summary>Files ('));
assert(standardSummary.includes('<summary>Rules ('));
assert(standardSummary.includes('<summary>Suggested and required checks ('));
assert(standardSummary.includes('### Highest-risk files'));
assert(standardSummary.indexOf('<code>src/app.js</code>') < standardSummary.indexOf('<details>'));
assert(standardSummary.includes('Harden &lt;startup&gt; while preserving score'));
assert(!standardSummary.includes('Harden <startup>'));

const docsSummary = formatPullRequestSummary(analyzeDiff(read('examples/docs-only.diff')));
assert(docsSummary.includes('**docs-only**'));
assertSnapshot('pr-summary-standard', standardSummary);
assertSnapshot('pr-summary-docs-only', docsSummary);

const commentBody = buildCommentBody(standardSummary);
assert(commentBody.startsWith(MERGE_GUARD_COMMENT_MARKER));
assert.equal(commentBody.split(MERGE_GUARD_COMMENT_MARKER).length - 1, 1);
assert(commentBody.includes(PULL_REQUEST_SUMMARY_MARKER));
const existing = findMergeGuardComment([
  { id: 1, body: `A reviewer quoted ${MERGE_GUARD_COMMENT_MARKER} in prose.` },
  { id: 2, body: commentBody }
]);
assert.equal(existing?.id, 2, 'only a leading stable marker should identify the managed comment');

console.log('pull-request summary contracts passed');
console.log(`summaryVersion=${PULL_REQUEST_SUMMARY_VERSION}`);
console.log(`changedFiles=${contextualReport.summary.changedFiles}`);
console.log(`rules=${contextualReport.rules.length}`);
