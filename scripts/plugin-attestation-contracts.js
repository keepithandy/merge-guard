#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createPluginAttestation, verifyPluginAttestation } from '../src/pluginAttestation.js';

const manifest = { schemaVersion: 1, identity: { id: 'example.rules', name: 'Example Rules', version: '1.0.0' }, compatibility: { pluginApiVersion: 1, mergeGuard: { min: '1.0.0', maxExclusive: '2.0.0' } }, entryPoint: './plugin.js', explicitInstallation: true, permissions: ['read-diff'], checksums: { entryPointSha256: 'a'.repeat(64) }, checks: { deterministic: true, timeoutMs: 1000, maxFindings: 100 } };
const source = 'export function analyze(input) { return { findings: [] }; }';
const configuration = { preset: 'standard', failThreshold: 7 };
const input = 'diff --git a/a b/a';
const findings = [{ id: 'example.rule', weight: 1 }];
const first = createPluginAttestation({ coreVersion: '1.0.0', manifest, source, configuration, input, findings, createdAt: '2026-08-25T00:00:00.000Z' });
const second = createPluginAttestation({ coreVersion: '1.0.0', manifest, source, configuration, input, findings, createdAt: '2026-08-25T00:00:00.000Z' });
assert.deepEqual(first, second, 'identical inputs must produce identical attestation identity');
assert.equal(verifyPluginAttestation(first, { manifest, source, configuration, input, findings }).valid, true);
assert.equal(verifyPluginAttestation(first, { manifest, source: `${source}\n`, configuration, input, findings }).valid, false);
assert.equal(verifyPluginAttestation(first, { manifest, source, configuration, input, findings: [] }).valid, false);
assert(first.plugin.manifestSha256 && first.plugin.sourceSha256 && first.configurationSha256 && first.input.sha256 && first.output.findingsSha256);
assert.equal(verifyPluginAttestation({ ...first, attestationId: '0'.repeat(64) }).valid, false);
console.log('plugin attestation contracts passed');
console.log(`attestationId=${first.attestationId}`);
console.log('identityDeterministic=true');
