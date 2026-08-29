#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';
import { createReviewProjection } from '../src/reviewProjection.js';

const truthy = (value) => value === 'true';
const present = (filePath) => Boolean(filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile() && fs.statSync(filePath).size);
const env = process.env;
const reviewFailure = env.MERGE_GUARD_REVIEW_OUTCOME === 'failure' ? 'GitHub review output projection failed' : null;
const comparisonFailure = env.MERGE_GUARD_COMPARISON_OUTCOME === 'failure' ? 'finding comparison failed' : null;
const outputPath = env.MERGE_GUARD_PROJECTION_PATH || 'merge-guard-review-projection.json';
const projection = createReviewProjection({
  attemptOutcome: env.MERGE_GUARD_ATTEMPT_OUTCOME || 'completed',
  scanExitCode: env.MERGE_GUARD_SCAN_EXIT_CODE,
  reportPath: env.MERGE_GUARD_REPORT_PATH,
  reportAvailable: present(env.MERGE_GUARD_REPORT_PATH),
  manifestPath: env.MERGE_GUARD_MANIFEST_PATH,
  manifestAvailable: present(env.MERGE_GUARD_MANIFEST_PATH),
  annotationsRequested: truthy(env.MERGE_GUARD_ANNOTATIONS_REQUESTED),
  annotationsPath: env.MERGE_GUARD_ANNOTATIONS_PATH,
  annotationsAvailable: present(env.MERGE_GUARD_ANNOTATIONS_PATH),
  sarifRequested: truthy(env.MERGE_GUARD_SARIF_REQUESTED),
  sarifPath: env.MERGE_GUARD_SARIF_PATH,
  sarifAvailable: present(env.MERGE_GUARD_SARIF_PATH),
  reviewFailure,
  comparisonRequested: truthy(env.MERGE_GUARD_COMPARISON_REQUESTED),
  comparisonPath: env.MERGE_GUARD_COMPARISON_PATH,
  comparisonAvailable: present(env.MERGE_GUARD_COMPARISON_PATH),
  comparisonStatus: env.MERGE_GUARD_COMPARISON_STATUS || null,
  comparisonFailure,
  commentRequested: truthy(env.MERGE_GUARD_COMMENT_REQUESTED),
  commentEligible: truthy(env.MERGE_GUARD_COMMENT_ELIGIBLE),
  commentStatus: env.MERGE_GUARD_COMMENT_STATUS || null,
  commentResult: env.MERGE_GUARD_COMMENT_RESULT || null,
  commentReason: env.MERGE_GUARD_COMMENT_REASON || null
});

fs.writeFileSync(outputPath, `${JSON.stringify(projection, null, 2)}\n`, 'utf8');
console.log(`review_projection_path=${outputPath}`);
console.log(`review_projection_status=${projection.status}`);
