#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
const text = fs.readFileSync('docs/public-contracts.md', 'utf8');
for (const token of ['JSON report schema v1', 'policy manifest v1', 'plugin manifest/API v1', 'artifact manifest v1', 'doctor JSON schema v1', 'Additive', 'Breaking', 'Deprecated', 'Unsupported behavior']) assert(text.includes(token), `contract freeze must define ${token}`);
assert(fs.existsSync('docs/REPORT_FORMAT.md') && fs.existsSync('test/snapshots/report-contracts.json'), 'report contract and snapshot must exist');
assert(fs.existsSync('schemas/policy-manifest-v1.schema.json'), 'policy schema must exist');
assert(fs.existsSync('schemas/plugin-manifest-v1.schema.json'), 'plugin schema must exist');
assert(fs.existsSync('schemas/artifact-manifest-v1.schema.json'), 'artifact schema must exist');
assert(fs.existsSync('schemas/impact-metadata-v1.schema.json'), 'impact metadata schema must exist');
assert(fs.existsSync('schemas/review-projection-v1.schema.json'), 'review projection schema must exist');
for (const schema of ['historical-pr-corpus-v1.schema.json', 'historical-pr-labels-v1.schema.json', 'historical-pr-case-result-v1.schema.json', 'historical-pr-evaluation-result-v1.schema.json']) assert(fs.existsSync(`schemas/${schema}`), `historical PR evaluation schema must exist: ${schema}`);
console.log('public contract freeze passed');
