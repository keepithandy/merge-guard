#!/usr/bin/env node
// Evaluation-only synthetic characterization fixtures. They are NOT human
// evidence, accuracy measurements, a fix, or a formal roadmap-phase result.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeDiff } from '../src/analyzeDiff.js';
import { applyPolicyPack, loadStarterPolicyPack } from '../src/starterPolicies.js';

const fixtureRoot = path.join(process.cwd(), 'test', 'fixtures', 'evaluation-hypotheses');
const policy = loadStarterPolicyPack('library');

function evaluateSyntheticProbe(filename) {
  const diff = fs.readFileSync(path.join(fixtureRoot, filename), 'utf8');
  const standard = analyzeDiff(diff);
  const withLibraryPolicy = applyPolicyPack(analyzeDiff(diff), diff, policy);
  assert.deepEqual(analyzeDiff(diff), standard, 'explicit library selection must not affect standard scans');
  assert.deepEqual(
    applyPolicyPack(analyzeDiff(diff), diff, policy),
    withLibraryPolicy,
    'library-policy matching must be reproducible'
  );
  assert.deepEqual(withLibraryPolicy.policyPacks.map((entry) => entry.id), ['merge-guard.starter.library']);
  return { standard, withLibraryPolicy };
}

function expectRule(report, id) {
  const matching = report.rules.filter((rule) => rule.id === id);
  assert.equal(matching.length, 1, `expected exactly one ${id} hit`);
  return matching[0];
}

const compatibilityId = 'policy:merge-guard.starter.library:compatibility-marker-change';
const publicApiId = 'policy:merge-guard.starter.library:public-api-change';

// Synthetic probe A: "removed" appears inside an event name and DOES NOT, on
// its own, establish public-API removal. The present pattern nevertheless
// reports a positive compatibility finding; record this behavior without
// asserting that it is a human-reviewed false positive.
const eventName = evaluateSyntheticProbe('library-component-event.diff');
assert.equal(eventName.standard.rules.some((rule) => rule.id === compatibilityId), false);
const eventHit = expectRule(eventName.withLibraryPolicy, compatibilityId);
assert.equal(eventHit.weight, 3);
assert.deepEqual(eventHit.matchedFiles, ['src/world.js']);
assert.equal(eventHit.matchedLineCount, 1);
assert.equal(eventName.withLibraryPolicy.riskScore - eventName.standard.riskScore, 3);
assert(eventName.withLibraryPolicy.suggestedChecks.some((check) =>
  check.includes('Run consumer fixtures against the supported compatibility range.')));

// Synthetic probe B: an explicit breaking change notice is a positive control,
// and its compatibility warning MUST be retained by any future authorized fix.
const breakingNotice = evaluateSyntheticProbe('library-breaking-notice.diff');
const breakingHit = expectRule(breakingNotice.withLibraryPolicy, compatibilityId);
assert.equal(breakingHit.weight, 3);
assert.deepEqual(breakingHit.matchedFiles, ['src/world.js']);
assert.equal(breakingHit.matchedLineCount, 1);
assert.equal(breakingNotice.withLibraryPolicy.riskScore - breakingNotice.standard.riskScore, 3);
assert.equal(breakingNotice.standard.docsOnly, true);

// The current policy treats both inputs as compatible rule hits. This is a
// characterization assertion, not the intended future negative regression
// assertion. After Phase 1 PASS and exact Phase 2 approval, an approved repair
// should change ONLY the event-name expectation to "no compatibility hit",
// while preserving the genuine BREAKING notice and checking frozen calibration.
assert.equal(Boolean(eventHit), Boolean(breakingHit));

// Synthetic probe C: public module exports trigger "routing-or-entry" on the
// index.js filename alone. The library-specific public-API warning is justified;
// navigation guidance may be inappropriate, but is not yet adjudicated.
const exportOnly = evaluateSyntheticProbe('library-export-only.diff');
const routeHit = expectRule(exportOnly.standard, 'routing-or-entry');
assert.deepEqual(routeHit.matchedFiles, ['src/index.js']);
assert.equal(routeHit.matchedLineCount, 0);
assert.equal(routeHit.weight, 2);
const apiHit = expectRule(exportOnly.withLibraryPolicy, publicApiId);
assert.deepEqual(apiHit.matchedFiles, ['src/index.js']);
assert.equal(apiHit.matchedLineCount, 1);
assert.equal(apiHit.weight, 4);
assert.equal(exportOnly.withLibraryPolicy.riskScore - exportOnly.standard.riskScore, 4);

console.log('library policy characterization contracts passed (synthetic-only; current behavior frozen)');
console.log('open hypotheses: event-name compatibility overmatch; index.js navigation guidance overmatch');
console.log('independent evidence: pending; production and policy changes: none');
