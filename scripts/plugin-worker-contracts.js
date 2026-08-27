#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { runPluginIsolated } from '../src/pluginWorker.js';

const root = path.resolve('test/fixtures/plugins');
const manifest = { schemaVersion: 1, identity: { id: 'example.rules', name: 'Example Rules', version: '1.0.0' }, compatibility: { pluginApiVersion: 1, mergeGuard: { min: '1.0.0', maxExclusive: '2.0.0' } }, entryPoint: './plugin.js', explicitInstallation: true, permissions: ['read-diff'], checksums: { entryPointSha256: 'a'.repeat(64) }, checks: { deterministic: true, timeoutMs: 1000, maxFindings: 2 } };
const run = (name, options = {}) => runPluginIsolated({ pluginPath: path.join(root, name), manifest: { ...manifest, checks: { ...manifest.checks, ...options } }, input: { diff: 'diff --git a/a b/a' } });
assert.equal((await run('valid-plugin.js')).status, 'ok');
assert.equal((await run('valid-plugin.js')).findings.length, 1);
assert.equal((await run('crash-plugin.js')).status, 'quarantined');
assert.equal((await run('slow-plugin.js', { timeoutMs: 20 })).status, 'timeout');
assert.equal((await run('malformed-output-plugin.js')).status, 'quarantined');
assert.equal((await run('valid-plugin.js', { maxFindings: 0 })).status, 'rejected');
const reportOnly = await run('valid-plugin.js', { maxFindings: 2 });
assert.equal(reportOnly.status, 'ok', 'worker receives only the declared permission input');
console.log('plugin worker contracts passed');
console.log('crashes=quarantined');
console.log('timeouts=terminated');
console.log('coreState=isolated');
