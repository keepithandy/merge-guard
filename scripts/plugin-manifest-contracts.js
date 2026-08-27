#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validatePluginManifest } from '../src/pluginManifest.js';
import { MERGE_GUARD_VERSION } from '../src/version.js';

const valid = JSON.parse(fs.readFileSync('test/fixtures/plugins/valid-manifest.json', 'utf8'));
const malformed = JSON.parse(fs.readFileSync('test/fixtures/plugins/malformed-manifest.json', 'utf8'));
const future = JSON.parse(fs.readFileSync('test/fixtures/plugins/future-manifest.json', 'utf8'));
assert.equal(validatePluginManifest(valid).valid, true);
assert.equal(validatePluginManifest(valid, { mergeGuardVersion: MERGE_GUARD_VERSION }).valid, true);
assert.equal(validatePluginManifest(valid, { mergeGuardVersion: '0.1.0' }).valid, false);
assert.equal(validatePluginManifest(malformed).valid, false);
assert(validatePluginManifest(malformed).diagnostics.some((item) => item.code === 'invalid-entry-point'));
assert.equal(validatePluginManifest(future).valid, false);
assert(validatePluginManifest(future).diagnostics.some((item) => item.code === 'future-schema'));
assert.equal(validatePluginManifest({ ...valid, explicitInstallation: false }).valid, false);
assert.equal(validatePluginManifest({ ...valid, permissions: ['read-diff', 'network'] }).valid, false);
assert.equal(validatePluginManifest({ ...valid, entryPoint: './dir/../plugin.js' }).valid, false);
console.log('plugin manifest contracts passed');
console.log('schemaVersion=1');
console.log('automaticDiscovery=false');
