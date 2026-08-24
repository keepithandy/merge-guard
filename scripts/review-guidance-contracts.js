#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeDiff, formatMarkdownReport, formatReport } from '../src/analyzeDiff.js';
import {
  applyReviewGuidance,
  findCodeOwners,
  inspectReviewGuidance,
  matchCodeOwners,
  parseCodeOwners
} from '../src/reviewGuidance.js';
import { loadStarterPolicyPack } from '../src/starterPolicies.js';

const root = process.cwd();
const fixtureRoot = path.join(root, 'test', 'fixtures', 'codeowners');
const diffText = fs.readFileSync(path.join(fixtureRoot, 'changes.diff'), 'utf8');

const parsed = findCodeOwners(path.join(fixtureRoot, 'valid'));
assert.equal(parsed.sourcePath, '.github/CODEOWNERS');
assert.equal(parsed.entries.length, 6);
assert.deepEqual(parsed.warnings, []);

const frontendPolicy = loadStarterPolicyPack('frontend');
const guidance = inspectReviewGuidance(
  diffText,
  [frontendPolicy],
  path.join(fixtureRoot, 'valid')
);
assert.deepEqual(guidance.changedPaths, [
  'docs/guide.md',
  'other/file.txt',
  'src/auth/generated/code.js',
  'src/auth/login.js',
  'src/auth/new.js',
  'src/auth/old.js',
  'src/auth/special.js'
]);

function suggestion(filePath) {
  return guidance.codeOwners.suggestions.find((entry) => entry.path === filePath);
}

assert.deepEqual(suggestion('docs/guide.md').owners, ['@docs-team', 'docs@example.com']);
assert.deepEqual(suggestion('other/file.txt').owners, ['@global-owner']);
assert.deepEqual(suggestion('src/auth/login.js').owners, ['@security-owner', '@octo/auth-team']);
assert.deepEqual(suggestion('src/auth/new.js').owners, ['@security-owner', '@octo/auth-team']);
assert.deepEqual(suggestion('src/auth/old.js').owners, ['@security-owner', '@octo/auth-team']);
assert.deepEqual(suggestion('src/auth/special.js').owners, ['@specialist']);
assert.equal(suggestion('src/auth/login.js').status, 'suggested-unverified');
assert.deepEqual(guidance.codeOwners.unownedPaths, [
  { path: 'src/auth/generated/code.js', pattern: 'src/auth/generated/**', line: 7 }
]);
assert.deepEqual(guidance.codeOwners.unmatchedPaths, []);
assert.equal(guidance.protectedPaths.length, 5);
assert(guidance.protectedPaths.every((entry) => entry.status === 'specialized-review-suggested'));
assert(guidance.protectedPaths.every((entry) => entry.policyPackId === 'merge-guard.starter.frontend'));
assert(guidance.protectedPaths.every((entry) =>
  entry.requiredChecks.map((check) => check.command).join(',') === 'npm test,npm run build'
));
assert(guidance.disclaimer.includes('do not prove assignment'));
assert(guidance.disclaimer.includes('approval'));

const baseline = analyzeDiff(diffText);
const guidedReport = applyReviewGuidance(analyzeDiff(diffText), guidance);
assert.equal(guidedReport.riskScore, baseline.riskScore, 'review guidance must not affect risk scoring');
assert.equal(guidedReport.riskLevel, baseline.riskLevel);
assert.equal(guidedReport.mergeReadiness, baseline.mergeReadiness);
assert.deepEqual(guidedReport.rules, baseline.rules);
assert.deepEqual(guidedReport.suggestedChecks, baseline.suggestedChecks);
assert(formatReport(guidedReport).includes('Review guidance:'));
assert(formatMarkdownReport(guidedReport).includes('## Review guidance'));
assert(formatMarkdownReport(guidedReport).includes('do not prove assignment'));

const malformed = findCodeOwners(path.join(fixtureRoot, 'malformed'));
assert.equal(malformed.entries.length, 2);
assert.deepEqual(
  malformed.warnings.map((item) => item.code),
  [
    'unsupported-negation',
    'unsupported-character-range',
    'unsupported-escaped-comment',
    'invalid-owner',
    'malformed-pattern'
  ]
);
const malformedMatches = matchCodeOwners(['docs/guide.md', 'src/file.js'], malformed);
assert.deepEqual(malformedMatches.suggestions.find((entry) => entry.path === 'docs/guide.md').owners, ['@valid-owner']);
assert.deepEqual(malformedMatches.suggestions.find((entry) => entry.path === 'src/file.js').owners, ['@valid-owner']);

const docsLocation = findCodeOwners(path.join(fixtureRoot, 'docs-location'));
assert.equal(docsLocation.sourcePath, 'docs/CODEOWNERS');
assert.deepEqual(matchCodeOwners(['src/file.js'], docsLocation).suggestions[0].owners, ['@docs-location-owner']);

const empty = findCodeOwners(path.join(root, 'test', 'fixtures', 'empty'));
assert.equal(empty.sourcePath, null);
assert.deepEqual(empty.entries, []);
assert.deepEqual(empty.warnings, []);

const invalidContent = parseCodeOwners(null);
assert.deepEqual(invalidContent.warnings.map((item) => item.code), ['invalid-content']);

const oversizedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-codeowners-'));
try {
  fs.mkdirSync(path.join(oversizedRoot, '.github'));
  fs.writeFileSync(
    path.join(oversizedRoot, '.github', 'CODEOWNERS'),
    Buffer.alloc(3 * 1024 * 1024, 32)
  );
  const oversized = findCodeOwners(oversizedRoot);
  assert.deepEqual(oversized.warnings.map((item) => item.code), ['file-too-large']);
} finally {
  fs.rmSync(oversizedRoot, { recursive: true, force: true });
}

const implementation = fs.readFileSync(path.join(root, 'src', 'reviewGuidance.js'), 'utf8');
assert(!implementation.includes('node:child_process'), 'review guidance must not execute commands');
assert(!/\b(?:spawn|exec)(?:Sync)?\s*\(/.test(implementation), 'review guidance must remain read-only');
assert(implementation.includes('lstatSync'), 'CODEOWNERS discovery should not follow symbolic links');

console.log('review-guidance contracts passed');
console.log(`codeOwnerSuggestions=${guidance.codeOwners.suggestions.length}`);
console.log(`protectedPathMatches=${guidance.protectedPaths.length}`);
console.log(`malformedWarnings=${malformed.warnings.length}`);
