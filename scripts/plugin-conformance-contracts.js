#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { runPluginConformance } from '../src/pluginConformance.js';

const fixtureRoot = path.resolve('test/fixtures/plugins');
const manifest = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'valid-manifest.json'), 'utf8'));
const valid = await runPluginConformance({ manifest, pluginPath: path.join(fixtureRoot, 'valid-plugin.js') });
assert.equal(valid.passed, true);
assert.equal(valid.kitVersion, 1);
assert.equal(valid.supportedCoreRange.min, '0.1.0');
assert(valid.checks.some((check) => check.name === 'lifecycle' && check.passed));
const invalid = await runPluginConformance({ manifest: { ...manifest, schemaVersion: 2 }, pluginPath: path.join(fixtureRoot, 'valid-plugin.js') });
assert.equal(invalid.passed, false);
const missing = await runPluginConformance({ manifest, pluginPath: path.join(fixtureRoot, 'missing-plugin.js') });
assert.equal(missing.passed, false);
assert(missing.checks.some((check) => check.name === 'local-entry-point' && !check.passed));
const incompatible = await runPluginConformance({ manifest, pluginPath: path.join(fixtureRoot, 'valid-plugin.js'), coreVersion: '1.0.0' });
assert.equal(incompatible.compatible, false);
const output = JSON.stringify(valid);
assert(!output.includes('https://') && !output.includes('GITHUB_TOKEN'));
console.log(JSON.stringify(valid, null, 2));
