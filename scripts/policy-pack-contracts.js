#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeDiff, formatMarkdownReport, formatReport } from '../src/analyzeDiff.js';
import {
  formatPolicyDiagnostics,
  MERGE_GUARD_VERSION,
  POLICY_PACK_SCHEMA_VERSION,
  REPORT_SCHEMA_VERSION,
  validatePolicyPack
} from '../src/policyPacks.js';
import {
  applyPolicyPack,
  listStarterPolicyPacks,
  loadStarterPolicyPack,
  PolicyPackSelectionError,
  STARTER_POLICY_IDS
} from '../src/starterPolicies.js';

const root = process.cwd();
const fixtureRoot = path.join(root, 'test', 'fixtures', 'policy-packs');

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, `${name}.json`), 'utf8'));
}

function codes(result, severity) {
  return result[severity].map((item) => item.code);
}

assert.equal(POLICY_PACK_SCHEMA_VERSION, 1);
assert.equal(REPORT_SCHEMA_VERSION, 1);
assert.equal(MERGE_GUARD_VERSION, '1.0.0');

const validFixture = fixture('valid');
const validFixtureBefore = JSON.stringify(validFixture);
const valid = validatePolicyPack(validFixture);
assert.equal(valid.valid, true);
assert.equal(valid.fatal.length, 0);
assert.equal(valid.warnings.length, 0);
assert.equal(valid.policy.schemaVersion, 1);
assert.equal(valid.policy.identity.id, 'merge-guard.frontend-base');
assert.equal(valid.policy.rules[0].id, 'browser-storage-change');
assert.equal(valid.policy.requiredChecks[0].id, 'unit-tests');
assert.deepEqual(valid.policy.protectedPaths[0].requiredCheckIds, ['unit-tests']);
assert.equal(JSON.stringify(validFixture), validFixtureBefore, 'validation must not mutate policy input');
assert.deepEqual(validatePolicyPack(validFixture), valid, 'policy validation should be deterministic');

const missing = validatePolicyPack(fixture('missing-version'));
assert.equal(missing.valid, false);
assert(codes(missing, 'fatal').includes('missing-schema-version'));
assert(missing.fatal.find((item) => item.code === 'missing-schema-version').guidance);

const future = validatePolicyPack(fixture('future-version'));
assert.equal(future.valid, false);
assert(codes(future, 'fatal').includes('future-schema-version'));

const legacy = validatePolicyPack(fixture('legacy-version'));
assert.equal(legacy.valid, false);
assert(codes(legacy, 'fatal').includes('legacy-schema-version'));
assert(legacy.fatal.find((item) => item.code === 'legacy-schema-version').guidance);

const malformed = validatePolicyPack(fixture('malformed'));
assert.equal(malformed.valid, false);
for (const expectedCode of [
  'invalid-schema-version',
  'invalid-id',
  'required-string',
  'invalid-semver',
  'future-report-schema-version',
  'invalid-version-range',
  'incompatible-merge-guard-version',
  'invalid-pattern',
  'invalid-weight',
  'invalid-type',
  'unknown-required-check'
]) {
  assert(codes(malformed, 'fatal').includes(expectedCode), `malformed fixture should include ${expectedCode}`);
}

const warningResult = validatePolicyPack(fixture('warnings'));
assert.equal(warningResult.valid, true);
assert.equal(warningResult.fatal.length, 0);
assert(codes(warningResult, 'warnings').includes('missing-description'));
assert(codes(warningResult, 'warnings').includes('unknown-field'));
assert(codes(warningResult, 'warnings').includes('duplicate-command'));
assert(formatPolicyDiagnostics(warningResult.warnings).includes('[WARNING]'));

const tooOldRuntime = validatePolicyPack(validFixture, { mergeGuardVersion: '0.0.9' });
assert(codes(tooOldRuntime, 'fatal').includes('incompatible-merge-guard-version'));
const tooNewRuntime = validatePolicyPack(validFixture, { mergeGuardVersion: '2.0.0' });
assert(codes(tooNewRuntime, 'fatal').includes('incompatible-merge-guard-version'));

const emptyPolicy = structuredClone(validFixture);
emptyPolicy.rules = [];
emptyPolicy.protectedPaths = [];
emptyPolicy.requiredChecks = [];
const emptyResult = validatePolicyPack(emptyPolicy);
assert.equal(emptyResult.valid, true);
assert(codes(emptyResult, 'warnings').includes('empty-policy-pack'));

const invalidRoot = validatePolicyPack(null);
assert.equal(invalidRoot.valid, false);
assert.deepEqual(codes(invalidRoot, 'fatal'), ['invalid-policy-pack']);

const sampleDiff = fs.readFileSync(path.join(root, 'examples', 'sample.diff'), 'utf8');
const builtInBefore = analyzeDiff(sampleDiff);
validatePolicyPack(validFixture);
assert.deepEqual(
  analyzeDiff(sampleDiff),
  builtInBefore,
  'validating a policy must not alter built-in scoring defaults'
);

const jsonSchema = JSON.parse(
  fs.readFileSync(path.join(root, 'schemas', 'policy-pack-v1.schema.json'), 'utf8')
);
assert.equal(jsonSchema.properties.schemaVersion.const, 1);
assert.deepEqual(jsonSchema.required, ['schemaVersion', 'identity', 'compatibility']);
assert(jsonSchema.$defs.rule && jsonSchema.$defs.protectedPath && jsonSchema.$defs.requiredCheck);

const starterFixtureRoot = path.join(root, 'test', 'fixtures', 'starter-policies');
const starterExpectations = JSON.parse(
  fs.readFileSync(path.join(starterFixtureRoot, 'expectations.json'), 'utf8')
);
const starterList = listStarterPolicyPacks();
assert.deepEqual(starterList.map((entry) => entry.id), STARTER_POLICY_IDS);
assert.equal(new Set(starterList.map((entry) => entry.policyId)).size, STARTER_POLICY_IDS.length);

for (const id of STARTER_POLICY_IDS) {
  const policy = loadStarterPolicyPack(id);
  const diff = fs.readFileSync(path.join(starterFixtureRoot, `${id}.diff`), 'utf8');
  const baseline = analyzeDiff(diff);
  const report = applyPolicyPack(analyzeDiff(diff), diff, policy);
  const expectation = starterExpectations[id];

  assert.equal(report.policyPacks.length, 1);
  assert.equal(report.policyPacks[0].id, policy.identity.id);
  assert.equal(report.config.policyPacks[0].id, policy.identity.id);
  assert.equal(report.riskScore, baseline.riskScore + expectation.riskDelta);
  const finding = report.rules.find((rule) => rule.id === expectation.ruleId);
  assert(finding, `${id} should emit ${expectation.ruleId}`);
  assert.equal(finding.policy, true);
  assert.equal(finding.custom, false);
  assert.equal(finding.policyPackId, policy.identity.id);
  assert.deepEqual(
    report.policyRequiredChecks.map((check) => check.command),
    expectation.requiredCommands
  );
  for (const command of expectation.requiredCommands) {
    assert(
      report.suggestedChecks.some((check) => check.includes(command)),
      `${id} should suggest ${command}`
    );
  }
  assert.deepEqual(
    applyPolicyPack(analyzeDiff(diff), diff, policy),
    report,
    `${id} application should be deterministic`
  );
  assert(formatReport(report).includes('Selected policy packs:'));
  assert(formatMarkdownReport(report).includes('## Selected policy packs'));
}

const explicitSelectionBaseline = analyzeDiff(sampleDiff);
listStarterPolicyPacks();
loadStarterPolicyPack('frontend');
assert.deepEqual(
  analyzeDiff(sampleDiff),
  explicitSelectionBaseline,
  'listing or loading a starter pack must not apply it'
);
assert.throws(
  () => loadStarterPolicyPack('unknown'),
  (error) => error instanceof PolicyPackSelectionError && error.message.includes('Available packs')
);
const duplicatePolicy = loadStarterPolicyPack('frontend');
const duplicateReport = applyPolicyPack(analyzeDiff(sampleDiff), sampleDiff, duplicatePolicy);
assert.throws(
  () => applyPolicyPack(duplicateReport, sampleDiff, duplicatePolicy),
  PolicyPackSelectionError
);

const implementation = fs.readFileSync(path.join(root, 'src', 'policyPacks.js'), 'utf8');
assert(!implementation.includes('node:child_process'), 'policy validation must not execute commands');
assert(!/\b(?:spawn|exec)(?:Sync)?\s*\(/.test(implementation), 'policy validation must remain read-only');

console.log('policy-pack contracts passed');
console.log(`validRules=${valid.policy.rules.length}`);
console.log(`validProtectedPaths=${valid.policy.protectedPaths.length}`);
console.log(`validRequiredChecks=${valid.policy.requiredChecks.length}`);
console.log(`malformedFatal=${malformed.fatal.length}`);
console.log(`warningDiagnostics=${warningResult.warnings.length}`);
console.log(`starterPolicies=${starterList.length}`);
