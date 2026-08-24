#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { detectNpmWorkspaces } from '../src/workspaces.js';

const root = process.cwd();
const fixture = (name) => path.join(root, 'test', 'fixtures', name);

const workspaces = detectNpmWorkspaces(fixture('npm-workspaces'));
assert.equal(workspaces.kind, 'npm-workspaces');
assert.equal(workspaces.rootPackage.name, 'fixture-workspace');
assert.equal(workspaces.rootPackage.root, '.');
assert.deepEqual(workspaces.workspacePatterns, [
  'packages/*',
  'apps/*',
  'packages/*/tools/*',
  '!packages/ignored'
]);
assert.deepEqual(
  workspaces.packages.map((entry) => entry.root),
  ['apps/web', 'packages/core', 'packages/core/tools/cli']
);
assert.deepEqual(
  workspaces.packages.map((entry) => entry.name),
  ['@fixture/web', '@fixture/core', '@fixture/cli']
);
assert(workspaces.packages.every((entry) => entry.workspace && entry.source === 'workspace'));
assert.deepEqual(
  workspaces.warnings.map((entry) => entry.path),
  [
    'package.json#workspaces[4]',
    'package.json#workspaces[5]',
    'packages/broken/package.json'
  ]
);
assert(!workspaces.packages.some((entry) => entry.root.includes('ignored')));
assert.deepEqual(
  detectNpmWorkspaces(fixture('npm-workspaces')),
  workspaces,
  'workspace detection should be deterministic'
);

const objectWorkspaces = detectNpmWorkspaces(fixture('npm-workspaces-object'));
assert.equal(objectWorkspaces.kind, 'npm-workspaces');
assert.deepEqual(objectWorkspaces.workspacePatterns, ['modules/*']);
assert.deepEqual(objectWorkspaces.packages.map((entry) => entry.root), ['modules/api']);

const layout = detectNpmWorkspaces(fixture('npm-layout'));
assert.equal(layout.kind, 'npm-monorepo-layout');
assert.deepEqual(layout.workspacePatterns, []);
assert.deepEqual(layout.packages.map((entry) => entry.root), ['packages/service']);
assert.equal(layout.packages[0].source, 'layout');
assert.equal(layout.packages[0].workspace, false);

const malformed = detectNpmWorkspaces(fixture('malformed-package'));
assert.equal(malformed.kind, 'unknown');
assert.equal(malformed.rootPackage, null);
assert.equal(malformed.warnings.length, 1);
assert.equal(malformed.warnings[0].path, 'package.json');

const empty = detectNpmWorkspaces(fixture('empty'));
assert.equal(empty.kind, 'unknown');
assert.deepEqual(empty.packages, []);
assert.deepEqual(empty.warnings, []);

const implementation = fs.readFileSync(path.join(root, 'src', 'workspaces.js'), 'utf8');
assert(!implementation.includes('node:child_process'), 'workspace detection must remain read-only');
assert(!/\b(?:spawn|exec)(?:Sync)?\s*\(/.test(implementation), 'workspace detection must not execute commands');

console.log('repository intelligence contracts passed');
console.log(`workspacePackages=${workspaces.packages.length}`);
console.log(`workspaceWarnings=${workspaces.warnings.length}`);
console.log(`layoutPackages=${layout.packages.length}`);
