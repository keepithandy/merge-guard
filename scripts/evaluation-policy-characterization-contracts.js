#!/usr/bin/env node
// Targeted synthetic positive/negative regression probes for a proposed
// library-policy precision fix. No private PR data or human evaluation labels.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeDiff } from '../src/analyzeDiff.js';
import { applyPolicyPack, loadStarterPolicyPack } from '../src/starterPolicies.js';

const fixtureRoot = path.join(process.cwd(), 'test', 'fixtures', 'evaluation-hypotheses');
const policy = loadStarterPolicyPack('library');
const compatibilityId = 'policy:merge-guard.starter.library:compatibility-marker-change';
const publicApiId = 'policy:merge-guard.starter.library:public-api-change';

function evaluateProbe(diff) {
  const standard = analyzeDiff(diff);
  const withLibraryPolicy = applyPolicyPack(analyzeDiff(diff), diff, policy);
  assert.deepEqual(analyzeDiff(diff), standard, 'policy selection must not mutate standard scanning');
  assert.deepEqual(applyPolicyPack(analyzeDiff(diff), diff, policy), withLibraryPolicy,
    'library policy must be deterministic');
  assert.deepEqual(withLibraryPolicy.policyPacks.map((entry) => entry.id),
    ['merge-guard.starter.library']);
  return { standard, withLibraryPolicy };
}

function fixture(name) {
  return fs.readFileSync(path.join(fixtureRoot, name), 'utf8');
}

function syntheticDiff(pathname, ...added) {
  const count = added.length;
  return [
    `diff --git a/${pathname} b/${pathname}`,
    `--- a/${pathname}`,
    `+++ b/${pathname}`,
    `@@ -1,0 +1,${count} @@`,
    ...added.map((line) => `+${line}`),
    ''
  ].join('\n');
}

function assertHit(report, id, pathName, count, weight) {
  const hits = report.rules.filter((rule) => rule.id === id);
  assert.equal(hits.length, 1, `expected one hit for ${id}`);
  const hit = hits[0];
  assert.deepEqual(hit.matchedFiles, [pathName]);
  assert.equal(hit.matchedLineCount, count);
  assert.equal(hit.weight, weight);
  return hit;
}

function assertNoHit(report, id, label) {
  assert(!report.rules.some((rule) => rule.id === id), label);
  assert(!report.flags.some((flag) =>
    id === compatibilityId && flag === 'Compatibility marker changed'), label);
}

// NEGATIVE: component.removed is an event name, not a declared breaking API
// change. This regression must protect against the old +3 false warning.
const eventName = evaluateProbe(fixture('library-component-event.diff'));
assertNoHit(eventName.standard, compatibilityId, 'default scanner never uses library policy');
assertNoHit(eventName.withLibraryPolicy, compatibilityId,
  'an event name must not claim a public compatibility change');
assert.equal(eventName.withLibraryPolicy.riskScore, eventName.standard.riskScore);
assert(!eventName.withLibraryPolicy.suggestedChecks.some((check) =>
  check === 'Run consumer fixtures against the supported compatibility range.'),
'compatibility-specific check must not appear without its rule');

// POSITIVE: an explicit BREAKING public API removal still must be reported.
const breakingNotice = evaluateProbe(fixture('library-breaking-notice.diff'));
assertHit(breakingNotice.withLibraryPolicy, compatibilityId, 'src/world.js', 1, 3);
assert.equal(breakingNotice.withLibraryPolicy.riskScore - breakingNotice.standard.riskScore, 3);
assert.equal(breakingNotice.standard.docsOnly, true);
assert(breakingNotice.withLibraryPolicy.suggestedChecks.some((check) =>
  check.includes('Run consumer fixtures against the supported compatibility range.')));

// POSITIVE: conventional deprecation and public removal wording still signals
// a compatibility review, preserving expected protection.
for (const line of [
  '/** @deprecated use createNextWorld */',
  '// DEPRECATED: use createNextWorld instead',
  '// BREAKING CHANGE: remove createWorld()',
  '// Removed public function createWorld',
  '// Removed support for legacy imports'
]) {
  const { standard, withLibraryPolicy } = evaluateProbe(syntheticDiff('src/world.js', line));
  assertHit(withLibraryPolicy, compatibilityId, 'src/world.js', 1, 3);
  assert.equal(withLibraryPolicy.riskScore - standard.riskScore, 3);
}

// NEGATIVE: arbitrary words, identifiers and transport event names are not
// semantically equivalent to removed public APIs.
for (const line of [
  'const removed = components.delete(id);',
  'events.emit("worker/deprecated");',
  'const breakingPoint = 3;',
  'const error = "not-removed";'
]) {
  const { standard, withLibraryPolicy } = evaluateProbe(syntheticDiff('src/world.js', line));
  assertNoHit(withLibraryPolicy, compatibilityId, `non-API keyword must not trigger: ${line}`);
  assert.equal(withLibraryPolicy.riskScore, standard.riskScore);
}

// NEGATIVE: a pure added re-export on src/index.js is a public API change,
// NOT evidence of changed routing or application navigation.
const exportOnly = evaluateProbe(fixture('library-export-only.diff'));
assertNoHit(exportOnly.standard, 'routing-or-entry',
  'a pure re-export must not produce navigation/routing guidance');
assert(!exportOnly.standard.suggestedChecks.includes(
  'Manually test the affected navigation or app entry path.'));
assertHit(exportOnly.withLibraryPolicy, publicApiId, 'src/index.js', 1, 4);
assert.equal(exportOnly.withLibraryPolicy.riskScore - exportOnly.standard.riskScore, 4);

// POSITIVE: real entrypoint navigation in the same index.js file must still be
// detected; only the narrow, export-only exception is allowed.
const entryNavigation = evaluateProbe(syntheticDiff('src/index.js',
  'export { createWorldPlugin } from "./world.js";',
  'navigate("/dashboard");'));
assertHit(entryNavigation.standard, 'routing-or-entry', 'src/index.js', 1, 2);
assert(entryNavigation.standard.suggestedChecks.includes(
  'Manually test the affected navigation or app entry path.'));

// POSITIVE: a non-export index.js implementation change is still an entrypoint
// change even if no literal navigation function name is present.
const entrySetup = evaluateProbe(syntheticDiff('src/index.js',
  'initializeWorld({ mode: "live" });'));
assertHit(entrySetup.standard, 'routing-or-entry', 'src/index.js', 0, 2);

// POSITIVE: deleting an existing export is not the same as adding a pure
// re-export. Avoid hiding potential breaking changes.
const exportDeletion = [
  'diff --git a/src/index.js b/src/index.js',
  '--- a/src/index.js',
  '+++ b/src/index.js',
  '@@ -1,1 +0,0 @@',
  '-export { createWorldPlugin } from "./world.js";',
  ''
].join('\n');
const deleted = evaluateProbe(exportDeletion);
assertHit(deleted.standard, 'routing-or-entry', 'src/index.js', 0, 2);

// POSITIVE: non-index route modules must retain routing coverage.
const routeChange = evaluateProbe(syntheticDiff('src/router.js',
  'navigate("/account");'));
assertHit(routeChange.standard, 'routing-or-entry', 'src/router.js', 1, 2);

console.log('library policy targeted fix regression contracts passed (synthetic-only)');
console.log('asserted: event-string negative; explicit breaking/deprecation positive; export-only negative; navigation/entry positives');
console.log('independent calibration evidence: unavailable; formal phase 2 authorization: not established');
