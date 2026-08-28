#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadImpactMetadata, validateImpactMetadata } from '../src/impactMetadata.js';
import { inspectRepository } from '../src/repositoryIntelligence.js';

const root = process.cwd();
const fixture = (name) => path.join(root, 'test', 'fixtures', 'impact-metadata', name);
const validPath = fixture('valid.json');
const invalidPath = fixture('invalid.json');

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

const traversal = loadImpactMetadata(root, '../outside.json');
assert.equal(traversal.status, 'invalid');
assert.equal(traversal.sourcePath, null);
assert.equal(traversal.diagnostics[0].code, 'unsafe-source-path');

const notProvided = loadImpactMetadata(root);
assert.equal(notProvided.status, 'not-provided');
assert.deepEqual(notProvided.diagnostics, []);

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

const repository = inspectRepository(
  fs.readFileSync(path.join(root, 'examples', 'sample.diff'), 'utf8'),
  root,
  path.relative(root, validPath)
);
assert.equal(repository.impactMetadata.status, 'valid');

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

const markdownOutput = execFileSync(process.execPath, [
  'src/cli.js',
  '--markdown',
  'examples/sample.diff',
  '--impact-metadata',
  path.relative(root, validPath)
], { cwd: root, encoding: 'utf8' });
assert(markdownOutput.includes('**Impact metadata:** valid schema 1'), 'Markdown should expose valid impact metadata without inferring dependencies');

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

console.log('impact metadata contracts passed');
console.log(`diagnostics=${invalid.diagnostics.length}`);
console.log(`packages=${valid.packages.length}`);
