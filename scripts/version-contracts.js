#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeDiff } from '../src/analyzeDiff.js';
import { validatePluginManifest } from '../src/pluginManifest.js';
import { MERGE_GUARD_VERSION, validatePolicyPack } from '../src/policyPacks.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const json = (relativePath) => JSON.parse(read(relativePath));
const packageJson = json('package.json');
const sbom = json('docs/security/sbom.json');

assert.equal(packageJson.version, '1.0.0', 'the v1 launch candidate must be package version 1.0.0');
assert.equal(MERGE_GUARD_VERSION, packageJson.version, 'runtime version must match package.json');
assert.equal(analyzeDiff(read('examples/sample.diff')).version, packageJson.version, 'report version must match package.json');
assert.equal(sbom.metadata?.component?.name, packageJson.name, 'SBOM package name must match package.json');
assert.equal(sbom.metadata?.component?.version, packageJson.version, 'SBOM metadata version must match package.json');
assert.equal(sbom.components?.[0]?.version, packageJson.version, 'SBOM component version must match package.json');
assert.equal(sbom.components?.[0]?.purl, `pkg:npm/${packageJson.name}@${packageJson.version}`, 'SBOM purl must match package.json');

for (const name of fs.readdirSync(path.join(root, 'policies', 'starter')).filter((entry) => entry.endsWith('.json')).sort()) {
  const result = validatePolicyPack(json(path.join('policies', 'starter', name)));
  assert.equal(result.valid, true, `${name} must support Merge Guard ${packageJson.version}: ${JSON.stringify(result.fatal)}`);
}

assert.equal(validatePluginManifest(json('test/fixtures/plugins/valid-manifest.json')).valid, true, 'reference plugin must support the release runtime');
assert(read('README.md').includes('`1.0.0`'), 'README must identify the v1.0.0 candidate');
assert(read('docs/REPORT_FORMAT.md').includes('"version": "1.0.0"'), 'report documentation must identify the v1.0.0 runtime');
assert(read('CHANGELOG.md').includes(`## ${packageJson.version}`), 'changelog must contain the package version');
for (const file of [`docs/releases/V${packageJson.version}_RELEASE_DECISION.md`, `docs/releases/V${packageJson.version}_RELEASE_NOTES.md`]) {
  assert(fs.existsSync(path.join(root, file)), `${file} must exist`);
}

console.log(`version contracts passed (${packageJson.name}@${packageJson.version})`);
