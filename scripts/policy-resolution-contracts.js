#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeDiff, formatMarkdownReport, formatReport } from '../src/analyzeDiff.js';
import {
  applyPolicyExceptions,
  applyResolvedPolicies,
  loadAndResolvePolicyManifest,
  PolicyManifestError,
  POLICY_MANIFEST_SCHEMA_VERSION,
  resolvePolicyManifest,
  validatePolicyManifest
} from '../src/policyResolution.js';
import { applyReviewGuidance, inspectReviewGuidance } from '../src/reviewGuidance.js';

const root = process.cwd();
const fixtureRoot = path.join(root, 'test', 'fixtures', 'policy-resolution');
const fixedToday = new Date('2026-08-24T00:00:00.000Z');

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, `${name}.json`), 'utf8'));
}

function codes(result) {
  return result.fatal.map((item) => item.code);
}

assert.equal(POLICY_MANIFEST_SCHEMA_VERSION, 1);
const validInput = fixture('valid');
const validBefore = JSON.stringify(validInput);
const valid = validatePolicyManifest(validInput, { today: fixedToday });
assert.equal(valid.valid, true);
assert.deepEqual(valid.fatal, []);
assert.deepEqual(valid.warnings, []);
assert.equal(JSON.stringify(validInput), validBefore, 'manifest validation must not mutate input');
assert.equal(valid.manifest.root.policy, 'frontend');
assert.deepEqual(
  valid.manifest.packages.map((entry) => [entry.root, entry.effectivePolicy]),
  [
    ['apps/web', 'frontend'],
    ['packages/core', 'library'],
    ['packages/core/tools/cli', 'library'],
    ['services/deploy', 'infrastructure']
  ]
);

const diffText = fs.readFileSync(path.join(fixtureRoot, 'changes.diff'), 'utf8');
const resolution = resolvePolicyManifest(valid.manifest, diffText, {
  manifestPath: 'test/fixtures/policy-resolution/valid.json'
});
assert.deepEqual(
  resolution.assignments.map((entry) => [entry.path, entry.starterPolicyId]),
  [
    ['apps/web/src/auth/legacy/login.js', 'frontend'],
    ['docs/policy.md', 'frontend'],
    ['packages/core/src/index.js', 'library'],
    ['packages/core/tools/cli/src/index.js', 'library'],
    ['services/deploy/.github/workflows/deploy.yml', 'infrastructure'],
    ['src/routes/legacy/index.js', 'frontend']
  ]
);
const nestedAssignment = resolution.assignments.find((entry) =>
  entry.path === 'packages/core/tools/cli/src/index.js'
);
assert.equal(nestedAssignment.sourceRoot, 'packages/core');
assert.equal(nestedAssignment.evaluationRoot, 'packages/core/tools/cli');
assert.equal(nestedAssignment.relativePath, 'src/index.js');
assert.deepEqual(
  resolution.policyScopes.map((scope) => scope.starterPolicyId),
  ['frontend', 'infrastructure', 'library']
);
assert.equal(resolution.exceptions.length, 4);
assert(resolution.exceptions.every((entry) => entry.paths.length === 1));
assert.deepEqual(
  resolvePolicyManifest(valid.manifest, diffText, {
    manifestPath: 'test/fixtures/policy-resolution/valid.json'
  }),
  resolution,
  'policy resolution should be deterministic'
);

const baseline = analyzeDiff(diffText);
let { report, policyScopes } = applyResolvedPolicies(analyzeDiff(diffText), diffText, resolution);
assert.equal(report.policyPacks.length, 3);
assert.equal(report.riskScore, baseline.riskScore + 11);
const routeFinding = report.rules.find((rule) =>
  rule.id === 'policy:merge-guard.starter.frontend:client-routing-change'
);
assert.deepEqual(routeFinding.matchedFiles, ['src/routes/legacy/index.js']);
const libraryFinding = report.rules.find((rule) =>
  rule.id === 'policy:merge-guard.starter.library:public-api-change'
);
assert.deepEqual(libraryFinding.matchedFiles, [
  'packages/core/src/index.js',
  'packages/core/tools/cli/src/index.js'
]);
const infrastructureFinding = report.rules.find((rule) =>
  rule.id === 'policy:merge-guard.starter.infrastructure:workflow-permission-change'
);
assert.deepEqual(infrastructureFinding.matchedFiles, [
  'services/deploy/.github/workflows/deploy.yml'
]);

report = applyReviewGuidance(
  report,
  inspectReviewGuidance(diffText, policyScopes, path.join(root, 'test', 'fixtures', 'empty'))
);
const protectedMatch = report.reviewGuidance.protectedPaths.find((entry) =>
  entry.path === 'apps/web/src/auth/legacy/login.js'
);
assert.equal(protectedMatch.protectedPathId, 'frontend-auth');
assert.equal(protectedMatch.matchedPath, 'src/auth/legacy/login.js');

const scoreBeforeExceptions = report.riskScore;
report = applyPolicyExceptions(report, resolution);
assert.equal(report.riskScore, scoreBeforeExceptions, 'policy exceptions must not change risk score');
assert.equal(report.policyExceptions.active.length, 4);
assert.equal(report.policyExceptions.unmatched.length, 0);
assert(report.policyExceptions.semantics.includes('annotations-only'));
assert(routeFinding.policyExceptions.some((item) => item.id === 'legacy-root-route'));
assert(libraryFinding.policyExceptions.some((item) => item.id === 'core-export-transition'));
assert(protectedMatch.policyExceptions.some((item) => item.id === 'legacy-web-auth'));
assert(
  report.policyRequiredChecks
    .find((check) => check.policyPackId === 'merge-guard.starter.infrastructure' && check.id === 'plan-review')
    .policyExceptions.some((item) => item.id === 'plan-command-transition')
);
assert.equal(report.policyResolution.manifestPath, 'test/fixtures/policy-resolution/valid.json');
assert.equal(report.policyResolution.assignments.length, 6);
assert(formatReport(report).includes('Policy resolution:'));
assert(formatMarkdownReport(report).includes('## Policy resolution'));
assert(formatMarkdownReport(report).includes('annotations only'));

const conflict = validatePolicyManifest(fixture('conflict'), { today: fixedToday });
assert.equal(conflict.valid, false);
assert(codes(conflict).includes('conflicting-package-scope'));

const expired = validatePolicyManifest(fixture('expired'), { today: fixedToday });
assert.equal(expired.valid, false);
assert(codes(expired).includes('expired-exception'));

const blanket = validatePolicyManifest(fixture('blanket'), { today: fixedToday });
assert.equal(blanket.valid, false);
assert(codes(blanket).includes('blanket-exception'));

const missingMetadata = validatePolicyManifest(fixture('missing-metadata'), { today: fixedToday });
assert.equal(missingMetadata.valid, false);
assert.equal(codes(missingMetadata).filter((code) => code === 'required-string').length, 3);

const unknownTargetInput = fixture('valid');
unknownTargetInput.root.exceptions[0].target.id = 'missing-rule';
const unknownTarget = validatePolicyManifest(unknownTargetInput, { today: fixedToday });
assert.equal(unknownTarget.valid, false);
assert(codes(unknownTarget).includes('unknown-exception-target'));

const unknownPolicyInput = fixture('valid');
unknownPolicyInput.root.policy = 'unknown';
const unknownPolicy = validatePolicyManifest(unknownPolicyInput, { today: fixedToday });
assert.equal(unknownPolicy.valid, false);
assert(codes(unknownPolicy).includes('unknown-policy'));

const loaded = loadAndResolvePolicyManifest(
  'test/fixtures/policy-resolution/valid.json',
  diffText,
  { cwd: root, today: fixedToday }
);
assert.deepEqual(loaded.assignments, resolution.assignments);
assert.throws(
  () => loadAndResolvePolicyManifest('../outside.json', diffText, { cwd: root, today: fixedToday }),
  PolicyManifestError
);
if (process.platform !== 'win32') {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-policy-'));
  const temporaryRepository = path.join(temporaryRoot, 'repository');
  const outsideDirectory = path.join(temporaryRoot, 'outside');
  fs.mkdirSync(temporaryRepository);
  fs.mkdirSync(outsideDirectory);
  fs.writeFileSync(
    path.join(outsideDirectory, 'manifest.json'),
    JSON.stringify(validInput),
    'utf8'
  );
  fs.symlinkSync(outsideDirectory, path.join(temporaryRepository, 'linked'));
  assert.throws(
    () => loadAndResolvePolicyManifest(
      'linked/manifest.json',
      diffText,
      { cwd: temporaryRepository, today: fixedToday }
    ),
    (error) => error instanceof PolicyManifestError && error.message.includes('escapes the repository')
  );
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

const schema = JSON.parse(
  fs.readFileSync(path.join(root, 'schemas', 'policy-manifest-v1.schema.json'), 'utf8')
);
assert.equal(schema.properties.schemaVersion.const, 1);
assert(schema.$defs.exception && schema.$defs.packageScope);

const implementation = fs.readFileSync(path.join(root, 'src', 'policyResolution.js'), 'utf8');
assert(!implementation.includes('node:child_process'), 'policy resolution must not execute commands');
assert(!/\b(?:spawn|exec)(?:Sync)?\s*\(/.test(implementation), 'policy resolution must remain read-only');
assert(implementation.includes('lstatSync'), 'manifest loading should not follow symbolic links');
assert(implementation.includes('realpathSync'), 'manifest loading should reject symlinked path escapes');

console.log('policy-resolution contracts passed');
console.log(`assignments=${resolution.assignments.length}`);
console.log(`resolvedPolicies=${resolution.policyScopes.length}`);
console.log(`activeExceptions=${report.policyExceptions.active.length}`);
