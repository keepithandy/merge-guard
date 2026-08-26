#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { annotateLegacyRisk, validateLegacyBaseline } from '../src/legacyRisk.js';

const valid = JSON.parse(fs.readFileSync('test/fixtures/legacy-risk/valid.json', 'utf8'));
const malformed = JSON.parse(fs.readFileSync('test/fixtures/legacy-risk/malformed.json', 'utf8'));
const today = new Date('2026-08-25T00:00:00Z');
const findings = [
  { identity: 'a'.repeat(64), ruleId: 'historical' },
  { identity: 'b'.repeat(64), ruleId: 'new-risk', weight: 4 }
];
const annotated = annotateLegacyRisk(findings, valid, { today });
assert.equal(annotated.acceptedCount, 1);
assert.equal(annotated.findings[0].legacyRisk.accepted, true);
assert.equal(annotated.findings[1].legacyRisk, null);
assert.equal(annotated.findings[1].weight, 4, 'baseline annotation must not alter new finding scores');
assert.equal(validateLegacyBaseline(malformed, { today }).accepted.length, 0);
assert(validateLegacyBaseline(malformed, { today }).warnings.length > 0);
const expired = { schemaVersion: 1, entries: [{ ...valid.entries[0], expiresOn: '2020-01-01' }] };
assert.equal(validateLegacyBaseline(expired, { today }).accepted.length, 0);
assert(validateLegacyBaseline(expired, { today }).warnings.some((item) => item.code === 'expired-entry'));
const unrelated = { schemaVersion: 1, entries: [{ ...valid.entries[0], findingIdentity: 'c'.repeat(64) }] };
assert.equal(annotateLegacyRisk(findings, unrelated, { today }).acceptedCount, 0);
console.log('legacy-risk contracts passed');
console.log('accepted=1');
console.log('newRiskScorePreserved=4');
