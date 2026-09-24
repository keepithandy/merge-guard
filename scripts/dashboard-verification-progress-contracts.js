#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compareDashboardReports, extractDashboardFindings } from '../dashboard/comparison.js';
import {
  buildVerificationPlan,
  createRuntimeDefect,
  createUserCheck,
  createVerificationSession,
  humanVerificationMarkdown,
  reportIdentity,
  verificationSummary
} from '../dashboard/human-verification.js';
import {
  createVerificationProgress,
  progressByFinding,
  validateVerificationProgress,
  verificationProgressMatchesReport,
  VERIFICATION_PROGRESS_SCHEMA_VERSION,
  VERIFICATION_PROGRESS_TOOL
} from '../dashboard/verification-progress.js';

const binding = 'a'.repeat(64);
const otherBinding = 'b'.repeat(64);
const previousReport = JSON.parse(fs.readFileSync('test/fixtures/finding-comparison/previous.json', 'utf8'));
const currentReport = JSON.parse(fs.readFileSync('test/fixtures/finding-comparison/current.json', 'utf8'));
const reportBefore = JSON.stringify(currentReport);
const findings = extractDashboardFindings(currentReport);
const comparison = compareDashboardReports(previousReport, currentReport);
const session = createVerificationSession({ report: currentReport, findings, comparison, sessionId: 'session-1', now: '2026-09-21T21:00:00.000Z' });

assert(session.items.length >= findings.length);
assert(session.items.every((item) => item.status === 'untested'), 'new session must start entirely Untested');
assert.equal(verificationSummary(session).pass, 0);
assert.equal(verificationSummary(session).untested, session.items.length);
assert(session.items.filter((item) => item.comparisonState === 'new').every((item) => item.status === 'untested'));

session.items[0].status = 'pass';
session.items[0].note = 'Explicitly exercised the affected path.';
session.items[1].status = 'fail';
if (session.items[2]) session.items[2].status = 'na';
assert.equal(verificationSummary(session).pass, 1, 'Pass must be explicit');
assert.equal(verificationSummary(session).fail, 1, 'Fail must be explicit');
assert.equal(verificationSummary(session).na, session.items[2] ? 1 : 0, 'N/A must be distinct');

const userCheck = createUserCheck({ id: 'user-1', title: 'Launch on iPhone Safari', instruction: 'Open the current build.', note: 'Manual mobile pass.' });
assert.equal(userCheck.provenance, 'User-added check');
assert.equal(userCheck.status, 'untested');
session.items.push(userCheck);

const defect = createRuntimeDefect({
  id: 'defect-1', title: 'Existing save fails to load', severity: 'high', component: 'Save loader',
  expectedBehavior: 'Old save loads.', actualBehavior: 'Load stops at startup.', reproductionSteps: 'Open an old save.',
  evidenceReference: 'save-failure.png', relatedVerificationItem: session.items[1].id,
  relatedFinding: session.items[1].findingIdentity, observationState: 'new'
});
session.runtimeDefects.push(defect);
assert.equal(defect.kind, 'human-runtime-defect');
assert(!currentReport.rules.some((rule) => rule.id === defect.id), 'runtime defects must remain separate from Merge Guard findings');
assert.equal(JSON.stringify(currentReport), reportBefore, 'Human Verification must not mutate the imported report');

const identity = reportIdentity(currentReport);
const document = createVerificationProgress(binding, identity, session);
assert.equal(document.tool, VERIFICATION_PROGRESS_TOOL);
assert.equal(document.schemaVersion, VERIFICATION_PROGRESS_SCHEMA_VERSION);
assert.equal(document.reportBinding, binding);
assert.equal(validateVerificationProgress(document).valid, true);
assert.equal(verificationProgressMatchesReport(document, binding), true);
assert.equal(verificationProgressMatchesReport(document, otherBinding), false, 'wrong report evidence must be rejected');
assert.equal(progressByFinding(document).get(session.items[0].findingIdentity).status, 'pass');

const markdown = humanVerificationMarkdown({ reportBinding: binding, reportIdentity: identity, session });
for (const expected of ['Merge Guard Human Verification', 'Report Binding', binding, 'Verification Results', '[PASS]', '[FAIL]', 'Runtime Defects', 'HIGH — Existing save fails to load', 'does not alter Merge Guard’s deterministic risk analysis']) assert(markdown.includes(expected));

const legacy = {
  tool: VERIFICATION_PROGRESS_TOOL,
  schemaVersion: 1,
  reportBinding: binding,
  checks: [{ findingIdentity: findings[0].identity, completed: true, note: 'Legacy verified checkbox.' }]
};
const legacyValidation = validateVerificationProgress(legacy);
assert.equal(legacyValidation.valid, true, 'schema v1 evidence remains loadable');
assert.equal(legacyValidation.legacySchemaVersion, 1, 'legacy evidence must be explicit');
assert.equal(progressByFinding(legacy).get(findings[0].identity).status, 'pass');

const previousPlan = buildVerificationPlan(previousReport, extractDashboardFindings(previousReport));
if (previousPlan.length) previousPlan[0].status = 'pass';
const currentPlan = buildVerificationPlan(currentReport, findings, comparison);
assert(currentPlan.every((item) => item.status === 'untested'), 'previous Pass must never carry to the current report');
for (const resolved of comparison.resolvedFindings) assert(!currentPlan.some((item) => item.findingIdentity === resolved.identity && item.status === 'pass'), 'resolved findings are report comparison state, not manual Pass');

for (const invalid of [
  { ...document, reportBinding: 'wrong' },
  { ...document, schemaVersion: 99 },
  { ...document, session: { ...session, items: [{ ...session.items[0], status: 'approved' }] } },
  { ...document, session: { ...session, items: [{ ...session.items[0] }, { ...session.items[0] }] } },
  { ...document, session: { ...session, runtimeDefects: [{ ...defect, severity: 'blocker' }] } }
]) assert.equal(validateVerificationProgress(invalid).valid, false);

console.log('dashboard verification-progress contracts passed');
console.log(`checks=${session.items.length}`);
console.log(`runtimeDefects=${session.runtimeDefects.length}`);
console.log(`schemaVersion=${VERIFICATION_PROGRESS_SCHEMA_VERSION}`);
