#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadImpactMetadata, validateImpactMetadata } from '../src/impactMetadata.js';
import { buildImpactGraph } from '../src/impactGraph.js';
import { inspectRepository } from '../src/repositoryIntelligence.js';

const root = process.cwd();
const fixture = (name) => path.join(root, 'test', 'fixtures', 'impact-metadata', name);
const validPath = fixture('valid.json');
const invalidPath = fixture('invalid.json');
const malformedPath = fixture('malformed.json');

const valid = loadImpactMetadata(root, path.relative(root, validPath));
assert.equal(valid.status, 'valid');
assert.equal(valid.sourcePath, 'test/fixtures/impact-metadata/valid.json');
assert.equal(valid.schemaVersion, 1);
assert.deepEqual(valid.packages, [
  { id: 'shared', root: 'packages/shared', dependsOn: [] },
  { id: 'web', root: 'packages/web', dependsOn: ['shared'] }
]);
assert.deepEqual(valid.ownership, [{ path: 'config/**', packages: ['shared', 'web'] }]);
assert.deepEqual(valid.generatedPaths, [{ path: 'packages/web/generated/**', package: 'web', source: 'web API generator' }]);
assert.deepEqual(valid.repositoryWidePaths, ['.github/workflows/**', 'package.json']);
assert.deepEqual(valid.diagnostics, []);

const invalid = loadImpactMetadata(root, path.relative(root, invalidPath));
assert.equal(invalid.status, 'invalid');
assert.equal(invalid.schemaVersion, null);
assert.deepEqual(invalid.packages, []);
assert.deepEqual(invalid.ownership, []);
assert.deepEqual(invalid.generatedPaths, []);
assert.deepEqual(invalid.repositoryWidePaths, []);
assert.deepEqual(
  invalid.diagnostics.map((entry) => entry.code),
  ['unknown-package', 'invalid-path-pattern', 'unknown-dependency']
);

const missing = loadImpactMetadata(root, 'test/fixtures/impact-metadata/missing.json');
assert.equal(missing.status, 'invalid');
assert.equal(missing.sourcePath, 'test/fixtures/impact-metadata/missing.json');
assert.equal(missing.diagnostics[0].code, 'unreadable-source');
assert(!JSON.stringify(missing).includes(root), 'missing-file diagnostics must not disclose the absolute checkout path');

const malformed = loadImpactMetadata(root, path.relative(root, malformedPath));
assert.equal(malformed.status, 'invalid');
assert.equal(malformed.diagnostics[0].code, 'invalid-json');
assert.equal(malformed.diagnostics[0].message, 'Impact metadata is not valid JSON.');
assert(!JSON.stringify(malformed).includes(root), 'invalid-JSON diagnostics must not disclose the absolute checkout path');

const traversal = loadImpactMetadata(root, '../outside.json');
assert.equal(traversal.status, 'invalid');
assert.equal(traversal.sourcePath, null);
assert.equal(traversal.diagnostics[0].code, 'unsafe-source-path');

const absolute = loadImpactMetadata(root, validPath);
assert.equal(absolute.status, 'invalid');
assert.equal(absolute.sourcePath, null);
assert.equal(absolute.diagnostics[0].code, 'unsafe-source-path');

const notProvided = loadImpactMetadata(root);
assert.equal(notProvided.status, 'not-provided');
assert.deepEqual(notProvided.diagnostics, []);
assert.equal(buildImpactGraph('diff --git a/a b/a', notProvided).status, 'not-provided');

const duplicate = validateImpactMetadata({
  schemaVersion: 1,
  packages: [
    { id: 'web', root: 'packages/web', dependsOn: ['web'] },
    { id: 'web', root: 'packages/duplicate' }
  ]
});
assert.equal(duplicate.valid, false);
assert.equal(duplicate.metadata.status, 'invalid');
assert.deepEqual(duplicate.metadata.packages, []);
assert(duplicate.metadata.diagnostics.some((entry) => entry.code === 'self-dependency'));
assert(duplicate.metadata.diagnostics.some((entry) => entry.code === 'duplicate-package-id'));

const forwardCompatible = validateImpactMetadata({
  schemaVersion: 1,
  futureRootField: true,
  packages: [{ id: 'web', root: 'packages/web', futurePackageField: 'ignored' }]
});
assert.equal(forwardCompatible.valid, true);
assert.equal(forwardCompatible.metadata.status, 'valid');
assert.deepEqual(forwardCompatible.metadata.diagnostics.map((entry) => entry.code), ['unknown-field', 'unknown-field']);

const unsafeRoots = validateImpactMetadata({
  schemaVersion: 1,
  packages: [
    { id: 'glob', root: 'packages/*' },
    { id: 'drive', root: 'C:/outside' }
  ]
});
assert.equal(unsafeRoots.valid, false);
assert.deepEqual(unsafeRoots.metadata.packages, []);
assert(unsafeRoots.metadata.diagnostics.some((entry) => entry.code === 'invalid-package-root'));
assert(unsafeRoots.metadata.diagnostics.some((entry) => entry.code === 'invalid-path-pattern'));

const sharedChange = fs.readFileSync(fixture('shared-change.diff'), 'utf8');
const completeGraph = buildImpactGraph(sharedChange, valid);
assert.equal(completeGraph.status, 'complete');
assert.deepEqual(completeGraph.directPackages.map((entry) => entry.id), ['shared']);
assert.deepEqual(completeGraph.transitivePackages.map((entry) => entry.id), ['web']);
assert.deepEqual(completeGraph.repositoryWidePackages, []);
assert.deepEqual(completeGraph.edges, [{
  from: 'web',
  to: 'shared',
  source: 'test/fixtures/impact-metadata/valid.json',
  reason: 'web explicitly declares dependsOn shared'
}]);
assert.deepEqual(buildImpactGraph(sharedChange, valid), completeGraph, 'impact graph must be deterministic');

const mixedGraph = buildImpactGraph(fs.readFileSync(fixture('mixed-impact.diff'), 'utf8'), valid);
assert.equal(mixedGraph.status, 'partial');
assert.deepEqual(mixedGraph.directPackages.map((entry) => entry.id), ['shared', 'web']);
assert.deepEqual(mixedGraph.repositoryWidePackages.map((entry) => entry.id), ['shared', 'web']);
assert.deepEqual(mixedGraph.generatedFiles.map((entry) => [entry.path, entry.package]), [['packages/web/generated/client.js', 'web']]);
assert.deepEqual(mixedGraph.unknownFiles.map((entry) => entry.path), ['unowned/file.txt']);

const ambiguousMetadata = validateImpactMetadata({
  schemaVersion: 1,
  packages: [
    { id: 'api', root: 'packages/api' },
    { id: 'web', root: 'packages/web' }
  ],
  ownership: [
    { path: 'config/**', packages: ['api'] },
    { path: 'config/*.json', packages: ['web'] }
  ]
}).metadata;
ambiguousMetadata.sourcePath = 'inline-ambiguous.json';
const ambiguousGraph = buildImpactGraph('diff --git a/config/app.json b/config/app.json\n--- a/config/app.json\n+++ b/config/app.json', ambiguousMetadata);
assert.equal(ambiguousGraph.status, 'partial');
assert.equal(ambiguousGraph.diagnostics[0].code, 'ambiguous-ownership');
assert.deepEqual(ambiguousGraph.directPackages, []);

const cyclicMetadata = validateImpactMetadata({
  schemaVersion: 1,
  packages: [
    { id: 'api', root: 'packages/api', dependsOn: ['web'] },
    { id: 'web', root: 'packages/web', dependsOn: ['api'] }
  ]
}).metadata;
cyclicMetadata.sourcePath = 'inline-cycle.json';
const cyclicGraph = buildImpactGraph('diff --git a/packages/api/a.js b/packages/api/a.js\n--- a/packages/api/a.js\n+++ b/packages/api/a.js', cyclicMetadata);
assert.equal(cyclicGraph.status, 'partial');
assert(cyclicGraph.diagnostics.some((entry) => entry.code === 'dependency-cycle'));

const invalidGraph = buildImpactGraph(sharedChange, invalid);
assert.equal(invalidGraph.status, 'unknown');
assert.equal(invalidGraph.diagnostics[0].code, 'impact-metadata-invalid');

const symlinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-impact-root-'));
const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-impact-external-'));
try {
  fs.copyFileSync(validPath, path.join(externalRoot, 'valid.json'));
  fs.symlinkSync(externalRoot, path.join(symlinkRoot, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const escaped = loadImpactMetadata(symlinkRoot, 'linked/valid.json');
  assert.equal(escaped.status, 'invalid');
  assert.equal(escaped.diagnostics[0].code, 'unsafe-source-file');
} finally {
  fs.rmSync(symlinkRoot, { recursive: true, force: true });
  fs.rmSync(externalRoot, { recursive: true, force: true });
}

const repository = inspectRepository(
  fs.readFileSync(path.join(root, 'examples', 'sample.diff'), 'utf8'),
  root,
  path.relative(root, validPath)
);
assert.equal(repository.impactMetadata.status, 'valid');
assert(repository.impactGraph);

const cliOutput = execFileSync(process.execPath, [
  'src/cli.js',
  '--json',
  'examples/sample.diff',
  '--impact-metadata',
  path.relative(root, validPath)
], { cwd: root, encoding: 'utf8' });
const cliReport = JSON.parse(cliOutput);
assert.equal(cliReport.repository.impactMetadata.status, 'valid');
assert.equal(cliReport.repository.impactMetadata.sourcePath, 'test/fixtures/impact-metadata/valid.json');
assert(['complete', 'partial'].includes(cliReport.repository.impactGraph.status));

const markdownOutput = execFileSync(process.execPath, [
  'src/cli.js',
  '--markdown',
  'examples/sample.diff',
  '--impact-metadata',
  path.relative(root, validPath)
], { cwd: root, encoding: 'utf8' });
assert(markdownOutput.includes('**Impact metadata:** valid schema 1'), 'Markdown should expose valid impact metadata');
assert(markdownOutput.includes('**Explicit direct impact:**'), 'Markdown should expose direct graph impact');

const invalidOutput = execFileSync(process.execPath, [
  'src/cli.js',
  'examples/sample.diff',
  '--impact-metadata',
  path.relative(root, invalidPath)
], { cwd: root, encoding: 'utf8' });
assert(invalidOutput.includes('Impact metadata: unavailable'), 'Text output should preserve invalid metadata as unavailable');

const implementation = fs.readFileSync(path.join(root, 'src', 'impactMetadata.js'), 'utf8');
assert(!implementation.includes('node:child_process'), 'impact metadata loading must remain read-only');
assert(!/\b(?:spawn|exec)(?:Sync)?\s*\(/.test(implementation), 'impact metadata loading must not execute commands');
const graphImplementation = fs.readFileSync(path.join(root, 'src', 'impactGraph.js'), 'utf8');
assert(!graphImplementation.includes('node:child_process'), 'impact graph construction must remain read-only');
assert(!/\b(?:spawn|exec)(?:Sync)?\s*\(/.test(graphImplementation), 'impact graph construction must not execute commands');

console.log('impact metadata contracts passed');
console.log(`diagnostics=${invalid.diagnostics.length}`);
console.log(`packages=${valid.packages.length}`);
