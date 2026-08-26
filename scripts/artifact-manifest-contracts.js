#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ARTIFACT_MANIFEST_SCHEMA_VERSION, ArtifactManifestError, createArtifactManifest, sha256, validateArtifactManifest } from '../src/artifactManifest.js';

const report = JSON.parse(fs.readFileSync('test/fixtures/finding-comparison/current.json', 'utf8'));
const evidence = { repository: 'example/project', commit: 'abc123', inputType: 'report', branch: 'main', configuration: { preset: 'standard', failThreshold: 7 } };
const manifest = createArtifactManifest({ report, evidence, generatedAt: '2026-08-25T00:00:00.000Z' });
assert.equal(manifest.schemaVersion, ARTIFACT_MANIFEST_SCHEMA_VERSION);
assert.equal(manifest.contentHashes.report, sha256(report));
assert.equal(validateArtifactManifest(manifest, { report }).valid, true);
assert.deepEqual(manifest, JSON.parse(fs.readFileSync('test/fixtures/artifact-manifest/valid.json', 'utf8')));
assert.equal(validateArtifactManifest({ ...manifest, artifactId: '0'.repeat(64) }).valid, false);
assert.equal(validateArtifactManifest({ ...manifest, evidence: { ...manifest.evidence, commit: '' } }).valid, false);
assert.equal(validateArtifactManifest(manifest, { report: { ...report, riskScore: 999 } }).valid, false);
assert.equal(validateArtifactManifest(JSON.parse(fs.readFileSync('test/fixtures/artifact-manifest/malformed.json', 'utf8'))).valid, false);
assert.throws(() => createArtifactManifest({ report, evidence: { ...evidence, commit: '' }, generatedAt: '2026-08-25T00:00:00.000Z' }), (error) => error instanceof ArtifactManifestError);
assert(!JSON.stringify(manifest).includes('C:/') && !JSON.stringify(manifest).includes('\\\\'));
console.log('artifact manifest contracts passed');
console.log(`artifactId=${manifest.artifactId}`);
console.log(`reportHash=${manifest.contentHashes.report}`);
