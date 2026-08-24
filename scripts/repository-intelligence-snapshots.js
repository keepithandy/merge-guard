#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mapChangedFilesToPackages } from '../src/affectedPackages.js';
import { detectProjectCheckDetails } from '../src/projectChecks.js';
import { detectNpmWorkspaces } from '../src/workspaces.js';

const root = process.cwd();
const fixture = (name) => path.join(root, 'test', 'fixtures', name);
const snapshotPath = path.join(root, 'test', 'snapshots', 'repository-intelligence-contracts.json');

function layoutSnapshot(name) {
  const layout = detectNpmWorkspaces(fixture(name));
  return {
    kind: layout.kind,
    rootPackage: layout.rootPackage?.root ?? null,
    workspacePatterns: layout.workspacePatterns,
    packageRoots: layout.packages.map((entry) => entry.root),
    warningPaths: layout.warnings.map((entry) => entry.path)
  };
}

function sourceSummary(source) {
  return source.path + ' — ' + source.reason;
}

function checkSnapshot(name) {
  const details = detectProjectCheckDetails(fixture(name));

  assert(
    details.every((detail) =>
      detail.sources.length
      && detail.sources.every((source) => source.path && source.reason)
    ),
    name + ' contains a project check without source/reason metadata'
  );

  return details.map((detail) => ({
    command: detail.command,
    category: detail.category,
    ecosystem: detail.ecosystem,
    sources: detail.sources
      .map(sourceSummary)
      .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
  }));
}

function affectedSnapshot() {
  const diffText = fs.readFileSync(
    path.join(fixture('affected-packages'), 'changes.diff'),
    'utf8'
  );
  const affected = mapChangedFilesToPackages(
    diffText,
    detectNpmWorkspaces(fixture('npm-workspaces'))
  );

  assert(
    affected.sharedImpactPackages.every((entry) => entry.reason.includes('does not infer dependencies')),
    'shared impact must remain explicitly non-dependency-derived'
  );

  return {
    changedFiles: affected.changedFiles,
    directPackages: affected.directPackages.map((entry) => ({
      root: entry.root,
      files: entry.files
    })),
    sharedFiles: affected.sharedFiles,
    sharedImpactPackageRoots: affected.sharedImpactPackages.map((entry) => entry.root)
  };
}

const actual = {
  layouts: {
    npmWorkspaces: layoutSnapshot('npm-workspaces'),
    npmWorkspacesObject: layoutSnapshot('npm-workspaces-object'),
    fallbackLayout: layoutSnapshot('npm-layout'),
    singlePackage: layoutSnapshot('node-project'),
    empty: layoutSnapshot('empty'),
    malformedPackage: layoutSnapshot('malformed-package')
  },
  checks: {
    node: checkSnapshot('node-project'),
    python: checkSnapshot('python-project'),
    mixed: checkSnapshot('mixed-project'),
    empty: checkSnapshot('empty'),
    malformedPython: checkSnapshot('malformed-python')
  },
  affectedPackages: affectedSnapshot()
};

const expected = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
assert.deepEqual(actual, expected, 'repository-intelligence snapshot mismatch');

console.log('repository intelligence snapshots passed');
console.log(`layoutSnapshots=${Object.keys(actual.layouts).length}`);
console.log(`checkSnapshots=${Object.keys(actual.checks).length}`);
