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
const version = packageJson.version;
const releasePrefix = `V${version}`;
const historicalVersions = ['0.1.0', '0.2.0', '1.0.0'];

assert.match(version, /^\d+\.\d+\.\d+$/, 'package version must be semantic versioning');
assert.equal(MERGE_GUARD_VERSION, version, 'runtime version must match package.json');
assert.equal(analyzeDiff(read('examples/sample.diff')).version, version, 'report version must match package.json');
assert.equal(sbom.metadata?.component?.name, packageJson.name, 'SBOM package name must match package.json');
assert.equal(sbom.metadata?.component?.version, version, 'SBOM metadata version must match package.json');
assert.equal(sbom.components?.[0]?.version, version, 'SBOM component version must match package.json');
assert.equal(sbom.components?.[0]?.purl, `pkg:npm/${packageJson.name}@${version}`, 'SBOM purl must match package.json');

for (const name of fs.readdirSync(path.join(root, 'policies', 'starter')).filter((entry) => entry.endsWith('.json')).sort()) {
  const result = validatePolicyPack(json(path.join('policies', 'starter', name)));
  assert.equal(result.valid, true, `${name} must support Merge Guard ${version}: ${JSON.stringify(result.fatal)}`);
}

assert.equal(validatePluginManifest(json('test/fixtures/plugins/valid-manifest.json')).valid, true, 'reference plugin must support the current runtime');
for (const [file, expected] of [
  ['README.md', `\`${version}\``],
  ['docs/REPORT_FORMAT.md', `"version": "${version}"`],
  ['docs/adoption-and-diagnostics.md', `"version": "${version}"`],
  ['docs/migrations.md', `runtime as \`${version}\``],
  ['docs/release-artifacts.md', `v${version} release artifacts`],
  ['docs/package-and-action.md', `release/v${version}`],
  ['docs/versioning.md', `Current source version | \`${version}\``]
]) {
  assert(read(file).includes(expected), `${file} must identify the current source version`);
}

const changelog = read('CHANGELOG.md');
assert(changelog.includes(`## ${version} -`), 'changelog must contain the current package version');
for (const historicalVersion of historicalVersions) {
  assert(changelog.includes(`## ${historicalVersion} -`), `changelog must preserve ${historicalVersion} history`);
}
for (const file of [`docs/releases/${releasePrefix}_RELEASE_DECISION.md`, `docs/releases/${releasePrefix}_RELEASE_NOTES.md`]) {
  assert(fs.existsSync(path.join(root, file)), `${file} must exist for the current source version`);
}

const stageRelease = read('scripts/stage-release.js');
assert(stageRelease.includes('v${packageJson.version} owner decision packet'), 'release staging must derive its packet title from package.json');
assert(read('docs/releases/V1.0.0_RELEASE_DECISION.md').includes('merge-guard@1.0.0'), 'historical v1.0 evidence must retain its original package identity');
assert(read('docs/releases/V0.2.0_RELEASE_DECISION.md').includes('v0.2.0'), 'historical v0.2 evidence must remain available');

console.log(`version contracts passed (${packageJson.name}@${version}; history ${[...historicalVersions, version].join(', ')})`);
