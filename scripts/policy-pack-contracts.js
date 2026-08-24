#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeDiff } from '../src/analyzeDiff.js';
import {
  formatPolicyDiagnostics,
  MERGE_GUARD_VERSION,
  POLICY_PACK_SCHEMA_VERSION,
  REPORT_SCHEMA_VERSION,
  validatePolicyPack
} from '../src/policyPacks.js';

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
assert.equal(MERGE_GUARD_VERSION, '0.1.0');

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
const tooNewRuntime = validatePolicyPack(validFixture, { mergeGuardVersion: '1.0.0' });
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

const implementation = fs.readFileSync(path.join(root, 'src', 'policyPacks.js'), 'utf8');
assert(!implementation.includes('node:child_process'), 'policy validation must not execute commands');
assert(!/\b(?:spawn|exec)(?:Sync)?\s*\(/.test(implementation), 'policy validation must remain read-only');

console.log('policy-pack contracts passed');
console.log(`validRules=${valid.policy.rules.length}`);
console.log(`validProtectedPaths=${valid.policy.protectedPaths.length}`);
console.log(`validRequiredChecks=${valid.policy.requiredChecks.length}`);
console.log(`malformedFatal=${malformed.fatal.length}`);
console.log(`warningDiagnostics=${warningResult.warnings.length}`);
