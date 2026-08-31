#!/usr/bin/env node

import assert from 'node:assert/strict';
import { analyzeDiff } from '../src/analyzeDiff.js';
import {
  applyBrowserGameSaveCompatibility,
  inspectBrowserGameSaveCompatibility
} from '../src/browserGameSaveCompatibility.js';
import { selectPrimaryChecks } from '../src/projectChecks.js';
import { applyPolicyPack, loadStarterPolicyPack } from '../src/starterPolicies.js';

const versionWithoutMigration = [
  'diff --git a/src/game/saveState.js b/src/game/saveState.js',
  '--- a/src/game/saveState.js',
  '+++ b/src/game/saveState.js',
  "-const SAVE_VERSION = 1;",
  "-localStorage.getItem('dungeondex-save-v1');",
  "-localStorage.setItem('dungeondex-save-v1', payload);",
  "+const SAVE_VERSION = 2;",
  "+localStorage.getItem('dungeondex-save-v2');",
  "+localStorage.setItem('dungeondex-save-v2', payload);"
].join('\n');

const missing = inspectBrowserGameSaveCompatibility(versionWithoutMigration);
assert.equal(missing.status, 'review-required');
assert.deepEqual(missing.storageKeys.removed, ['dungeondex-save-v1']);
assert.deepEqual(missing.storageKeys.added, ['dungeondex-save-v2']);
assert.deepEqual(missing.saveVersions.removed, ['1']);
assert.deepEqual(missing.saveVersions.added, ['2']);
assert.equal(missing.migrationEvidence.present, false);
assert.deepEqual(missing.concerns.map((concern) => concern.id), [
  'storage-key-removed-or-renamed',
  'save-version-change-without-migration'
]);

const versionWithMigration = `${versionWithoutMigration}\n${[
  'diff --git a/src/game/migrations/saveV2.js b/src/game/migrations/saveV2.js',
  '--- /dev/null',
  '+++ b/src/game/migrations/saveV2.js',
  '+export function migrateSaveV1(save) { return { ...save, saveVersion: 2 }; }'
].join('\n')}`;
const covered = inspectBrowserGameSaveCompatibility(versionWithMigration);
assert.equal(covered.status, 'review-required', 'storage-key replacement still requires an old-save check');
assert.equal(covered.migrationEvidence.present, true);
assert.deepEqual(covered.migrationEvidence.paths, ['src/game/migrations/saveV2.js']);
assert(!covered.concerns.some((concern) => concern.id === 'save-version-change-without-migration'));

const versionOnlyWithMigration = [
  'diff --git a/src/game/saveState.js b/src/game/saveState.js',
  '--- a/src/game/saveState.js',
  '+++ b/src/game/saveState.js',
  '-const saveVersion = 1;',
  '+const saveVersion = 2;',
  '+const migrated = migrateSaveV1(save);'
].join('\n');
assert.equal(inspectBrowserGameSaveCompatibility(versionOnlyWithMigration).status, 'migration-present');

const unrelated = inspectBrowserGameSaveCompatibility([
  'diff --git a/src/game/combat.js b/src/game/combat.js',
  '--- a/src/game/combat.js',
  '+++ b/src/game/combat.js',
  '+export const damage = 4;'
].join('\n'));
assert.equal(unrelated.status, 'not-detected');
assert.deepEqual(unrelated.checks, []);

const report = applyBrowserGameSaveCompatibility(analyzeDiff(versionWithoutMigration), versionWithoutMigration);
report.primaryChecks = selectPrimaryChecks(report);
assert.equal(report.saveCompatibility.status, 'review-required');
assert(
  report.saveCompatibility.checks.includes(report.primaryChecks[0]),
  'save compatibility must lead the focused check plan'
);
assert(report.primaryChecks.length <= 3);

const policyReport = applyPolicyPack(
  analyzeDiff(versionWithoutMigration),
  versionWithoutMigration,
  loadStarterPolicyPack('browser-game')
);
policyReport.primaryChecks = selectPrimaryChecks(policyReport);
assert.equal(policyReport.saveCompatibility.status, 'review-required');
assert(policyReport.primaryChecks.every((check, index) => index >= 2 || policyReport.saveCompatibility.checks.includes(check)));
assert(policyReport.suggestedChecks.includes(policyReport.saveCompatibility.checks[0]));

const frontendReport = applyPolicyPack(
  analyzeDiff(versionWithoutMigration),
  versionWithoutMigration,
  loadStarterPolicyPack('frontend')
);
assert.equal(frontendReport.saveCompatibility, undefined, 'other policies must preserve existing behavior');

console.log('browser-game save compatibility contracts passed');
