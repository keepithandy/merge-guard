#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { normalizeCustomRules } from '../src/customRules.js';
import { validatePolicyPack } from '../src/policyPacks.js';
import { validatePolicyManifest } from '../src/policyResolution.js';
import { compileSafeRegex, UnsafeRegexError } from '../src/safeRegex.js';
import { normalizeSuppressions } from '../src/suppressions.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const packageJson = JSON.parse(read('package.json'));
const sbom = JSON.parse(read('docs/security/sbom.json'));
assert.equal(Object.keys(packageJson.dependencies || {}).length, 0, 'runtime dependencies must remain empty');
assert.equal(Object.keys(packageJson.devDependencies || {}).length, 0, 'development dependencies must remain empty');
assert.equal(sbom.bomFormat, 'CycloneDX');
assert.equal(sbom.specVersion, '1.5');
assert(sbom.components.some((component) => component.name === packageJson.name), 'SBOM must identify the package');
for (const file of ['docs/security/threat-model.md', 'docs/security/release-provenance.md', 'docs/security/vulnerability-response.md']) assert(fs.existsSync(path.join(root, file)), `${file} must exist`);
const scan = execFileSync(process.execPath, ['src/cli.js', '--json', 'examples/sample.diff'], { cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_TOKEN: 'must-not-be-read' } });
assert(!scan.includes('must-not-be-read'), 'normal scanning must not expose secrets');
assert(read('docs/security/release-provenance.md').includes('SHA-256') && read('docs/security/release-provenance.md').includes('approval'), 'provenance flow must define checksums and approval');

const unsafePattern = '(a+)+$';
const safetyStart = performance.now();
assert.throws(
  () => compileSafeRegex(unsafePattern),
  (error) => error instanceof UnsafeRegexError && error.code === 'unsafe-pattern'
);
assert.throws(
  () => compileSafeRegex('.*missing-suffix'),
  (error) => error instanceof UnsafeRegexError && error.code === 'unsafe-pattern'
);
assert.throws(
  () => compileSafeRegex('a'.repeat(501)),
  (error) => error instanceof UnsafeRegexError && error.code === 'pattern-too-long'
);
assert(performance.now() - safetyStart < 1000, 'unsafe regular expressions must be rejected without evaluating hostile input');
assert.equal(compileSafeRegex('^src/(storage|state)/', 'i').test('src/storage/cache.js'), true);
assert.equal(compileSafeRegex('^src/.*\\.js$', 'i').test('src/storage/cache.js'), true);

const unsafeCustomRules = normalizeCustomRules([{
  id: 'redos',
  label: 'Unsafe expression',
  weight: 1,
  pathPattern: unsafePattern
}]);
assert.equal(unsafeCustomRules.rules.length, 0);
assert(unsafeCustomRules.warnings.some((warning) => warning.includes('unsafe or invalid pathPattern')));

const unsafeSuppressions = normalizeSuppressions([{
  ruleId: 'routing-or-entry',
  reason: 'security regression fixture',
  owner: 'security',
  expires: '2027-12-31',
  pathPattern: unsafePattern
}]);
assert.equal(unsafeSuppressions.suppressions.length, 0);
assert(unsafeSuppressions.warnings.some((warning) => warning.message.includes('unsafe regular expression')));

const unsafePolicyPack = JSON.parse(read('test/fixtures/policy-packs/valid.json'));
unsafePolicyPack.rules[0].pathPattern = unsafePattern;
assert(validatePolicyPack(unsafePolicyPack).fatal.some((item) => item.code === 'unsafe-pattern'));

const unsafePolicyManifest = JSON.parse(read('test/fixtures/policy-resolution/valid.json'));
unsafePolicyManifest.root.exceptions[0].pathPattern = unsafePattern;
assert(validatePolicyManifest(unsafePolicyManifest, {
  today: new Date('2026-08-24T00:00:00.000Z')
}).fatal.some((item) => item.code === 'unsafe-pattern'));
console.log('security and provenance contracts passed');
