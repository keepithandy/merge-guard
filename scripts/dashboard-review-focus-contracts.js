#!/usr/bin/env node

import assert from 'node:assert/strict';
import { buildReviewFocus } from '../dashboard/review-focus.js';

const report = { mergeReadiness: 'NEEDS_REVIEW' };
const findings = [{ identity: 'routing' }, { identity: 'state' }];
const focus = buildReviewFocus({
  report,
  findings,
  progress: new Map([['routing', { completed: true }]]),
  comparison: { configurationChanged: true, summary: { new: 2, unchanged: 1 } },
  expiringSuppressions: [{ ruleId: 'legacy' }]
});
assert.deepEqual(focus.verification, { total: 2, completed: 1, remaining: 1 });
assert.deepEqual(focus.items.map((item) => item.key), [
  'configuration-changed',
  'new-findings',
  'verification-pending',
  'recurring-findings',
  'expiring-suppressions',
  'reported-readiness'
]);
assert(focus.items.find((item) => item.key === 'reported-readiness').detail.includes('reviewer judgment'));

const recorded = buildReviewFocus({
  report,
  findings: [{ identity: 'routing' }],
  progress: new Map([['routing', { completed: true }]]),
  comparison: null,
  expiringSuppressions: []
});
assert.equal(recorded.items[0].key, 'verification-recorded');
assert.equal(recorded.items.at(-1).key, 'reported-readiness');

console.log('dashboard review-focus contracts passed');
console.log(`actions=${focus.items.length}`);
