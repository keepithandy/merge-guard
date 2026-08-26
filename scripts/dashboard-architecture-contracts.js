#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const manifestPath = 'dashboard/architecture-boundary.v1.json';
const schemaPath = 'schemas/dashboard-boundary-v1.schema.json';
const architecturePath = 'docs/architecture/dashboard-architecture.md';
const decisionPath = 'docs/architecture/decisions/0001-local-dashboard-boundary.md';
const threatModelPath = 'docs/architecture/dashboard-threat-model.md';
const manifest = readJson(manifestPath);
const schema = readJson(schemaPath);
const architecture = read(architecturePath);
const decision = read(decisionPath);
const threatModel = read(threatModelPath);

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.status, 'accepted');
assert.equal(manifest.implementationStatus, 'implemented');
assert.equal(manifest.$schema, '../schemas/dashboard-boundary-v1.schema.json');
assert.equal(schema.properties.schemaVersion.const, 1);
assert.equal(schema.properties.status.const, 'accepted');
assert(schema.$defs.runtime && schema.$defs.inputs && schema.$defs.network && schema.$defs.storage);

assert.equal(manifest.runtime.plannedEntrypoint, 'node dashboard/server.js');
assert.equal(manifest.runtime.server.bindHost, '127.0.0.1');
assert.equal(manifest.runtime.server.port, 'ephemeral');
assert.deepEqual(manifest.runtime.server.methods, ['GET', 'HEAD']);
assert.equal(manifest.runtime.server.assetAccess, 'fixed-allowlist');
assert.equal(manifest.runtime.server.acceptsRequestBodies, false);
assert.equal(manifest.runtime.server.acceptsUserFiles, false);
assert.equal(manifest.runtime.server.hostHeaderPolicy, 'exact-loopback-authority');
assert.equal(manifest.runtime.server.cors, false);
assert.equal(manifest.runtime.server.cache, 'no-store');

assert.deepEqual(manifest.runtime.browser.inputAcquisition, ['file-picker', 'drag-and-drop']);
assert.equal(manifest.runtime.browser.processing, 'dedicated-module-worker');
assert.equal(manifest.runtime.browser.state, 'memory-only');
assert.equal(manifest.runtime.browser.serviceWorker, false);
assert.equal(manifest.runtime.browser.remoteRequests, false);

assert.deepEqual(manifest.inputs.diff.extensions, ['.diff', '.patch']);
assert.equal(manifest.inputs.diff.maxBytes, 20 * 1024 * 1024);
assert.equal(manifest.inputs.diff.maxLines, 200000);
assert.equal(manifest.inputs.diff.encoding, 'utf-8');
assert.equal(manifest.inputs.diff.requiredMarker, 'diff --git ');
assert(manifest.inputs.diff.reject.includes('archive'));
assert(manifest.inputs.diff.reject.includes('binary-patch'));
assert(manifest.inputs.diff.reject.includes('nul-byte'));

assert.deepEqual(manifest.inputs.report.extensions, ['.json']);
assert.equal(manifest.inputs.report.maxBytes, 10 * 1024 * 1024);
assert.equal(manifest.inputs.report.maxDepth, 64);
assert.equal(manifest.inputs.report.maxFiles, 10000);
assert.equal(manifest.inputs.report.maxRules, 50000);
assert.equal(manifest.inputs.report.maxChecks, 10000);
assert.equal(manifest.inputs.report.maxComparisonFiles, 2);
assert.equal(manifest.inputs.report.requiredTool, 'merge-guard');
assert.deepEqual(manifest.inputs.report.supportedSchemaVersions, [1]);

assert.equal(manifest.processing.timeoutMs, 10000);
assert.equal(manifest.processing.commitStateAfterValidation, true);
assert.equal(manifest.processing.executeInput, false);
assert.equal(manifest.processing.executeSuggestedChecks, false);
assert.equal(manifest.processing.compileInputRegex, false);
assert.equal(manifest.processing.renderUntrustedStringsWith, 'textContent');
assert.equal(manifest.processing.importedReportScoreSource, 'report-values-only');
assert.equal(manifest.processing.importedDiffScoreSource, 'shared-merge-guard-core-only');

assert.equal(manifest.network.implicitRequests, false);
assert.deepEqual(manifest.network.remoteOrigins, []);
assert.equal(manifest.network.runtimeDependencies, 'bundled-local-only');
assert.equal(manifest.network.telemetry, false);
assert.equal(manifest.network.updateChecks, false);
for (const directive of [
  "default-src 'none'",
  "connect-src 'none'",
  "style-src 'self'",
  "style-src-attr 'none'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "worker-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "manifest-src 'none'"
]) {
  assert(manifest.network.contentSecurityPolicy.includes(directive), `CSP should include ${directive}`);
}
assert(!/https?:\/\//.test(JSON.stringify(manifest)), 'dashboard manifest must not allow a remote origin');

assert.deepEqual(manifest.storage.browserPersistentStores, []);
assert.equal(manifest.storage.serverPersistence, false);
assert.equal(manifest.storage.remoteStorage, false);
assert.equal(manifest.storage.clearOnReload, true);
assert.equal(manifest.storage.exports, 'explicit-user-download');
assert.equal(manifest.storage.objectUrls, 'revoke-after-download');
assert.deepEqual(manifest.outputs.formats, ['markdown', 'json']);
assert.equal(manifest.outputs.trigger, 'explicit-user-action');
assert.equal(manifest.outputs.preserveReportValues, true);
assert.equal(manifest.outputs.executeChecks, false);

assert.equal(manifest.errors.behavior, 'reject-before-state-commit');
assert.equal(manifest.errors.retainPreviousValidView, true);
assert.equal(manifest.errors.exposeLocalPaths, false);
assert.deepEqual(manifest.errors.categories, [
  'too-large',
  'unsupported-type',
  'invalid-encoding',
  'malformed-input',
  'incompatible-schema',
  'processing-timeout'
]);

assert.deepEqual(manifest.threatIds, [
  'DASH-T01',
  'DASH-T02',
  'DASH-T03',
  'DASH-T04',
  'DASH-T05',
  'DASH-T06',
  'DASH-T07',
  'DASH-T08',
  'DASH-T09'
]);
for (const threatId of manifest.threatIds) {
  assert(threatModel.includes(`| ${threatId} |`), `threat model should define ${threatId}`);
}

for (const section of [
  '## Trust boundaries',
  '## Process boundary',
  '## Browser and file boundary',
  '## Validation and state transition',
  '## Scoring boundary',
  '## Network and storage boundary',
  '## Error contract',
  '## Verification gate'
]) {
  assert(architecture.includes(section), `architecture should include ${section}`);
}
assert(architecture.includes("connect-src 'none'"));
assert(architecture.includes('No selected string is evaluated'));
assert(architecture.includes('implements the constrained loopback runtime and local import validation'));
assert(decision.includes('Status: Accepted'));
assert(decision.includes('## Alternatives considered'));
assert(decision.includes('machine-readable'));
assert(threatModel.includes('## Assets'));
assert(threatModel.includes('## Security invariants'));
assert(threatModel.includes('No selected byte crosses'));

const packageMetadata = readJson('package.json');
for (const packagePath of [
  'dashboard/',
  architecturePath,
  decisionPath,
  threatModelPath
]) {
  assert(
    packageMetadata.files.includes(packagePath) || (packagePath.startsWith('docs/') && packageMetadata.files.includes('docs/')),
    `package files should include ${packagePath}`
  );
}
assert.equal(
  packageMetadata.scripts?.['test:dashboard-architecture'],
  'node scripts/dashboard-architecture-contracts.js'
);

const nodeWorkflow = read('.github/workflows/node-lts.yml');
assert(nodeWorkflow.includes('npm run test:dashboard-architecture'));

console.log('dashboard architecture contracts passed');
console.log(`schemaVersion=${manifest.schemaVersion}`);
console.log(`threats=${manifest.threatIds.length}`);
console.log(`diffLimit=${manifest.inputs.diff.maxBytes}`);
console.log(`reportLimit=${manifest.inputs.report.maxBytes}`);
console.log('remoteOrigins=0');
