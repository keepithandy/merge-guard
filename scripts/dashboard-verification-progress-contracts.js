#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  createVerificationProgress,
  progressByFinding,
  validateVerificationProgress,
  VERIFICATION_PROGRESS_SCHEMA_VERSION,
  VERIFICATION_PROGRESS_TOOL
} from '../dashboard/verification-progress.js';

const binding = 'a'.repeat(64);
const findings = [{ identity: 'builtin-routing-src-app' }, { identity: 'builtin-network-src-api' }];
const progress = new Map([
  ['builtin-routing-src-app', { completed: true, note: 'Ran startup smoke.' }],
  ['builtin-network-src-api', { completed: false, note: '' }]
]);
const document = createVerificationProgress(binding, findings, progress);
assert.equal(document.tool, VERIFICATION_PROGRESS_TOOL);
assert.equal(document.schemaVersion, VERIFICATION_PROGRESS_SCHEMA_VERSION);
assert.equal(document.reportBinding, binding);
assert.deepEqual(validateVerificationProgress(document), { valid: true, value: document });
assert.deepEqual(progressByFinding(document), progress);

for (const invalid of [
  { ...document, reportBinding: 'wrong' },
  { ...document, checks: [{ ...document.checks[0] }, { ...document.checks[0] }] },
  { ...document, checks: [{ ...document.checks[0], completed: 'true' }] },
  { ...document, checks: [{ ...document.checks[0], note: 'x'.repeat(2001) }] }
]) assert.equal(validateVerificationProgress(invalid).valid, false);

console.log('dashboard verification-progress contracts passed');
console.log(`checks=${document.checks.length}`);
