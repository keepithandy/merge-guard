#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const docs = fs.readFileSync('docs/distribution-listings.md', 'utf8');
assert.equal(pkg.bin['merge-guard'], './src/cli.js'); assert.equal(pkg.engines.node, '>=18');
for (const token of ['contents: read', 'pull-requests: write', 'report-only', 'Security:', 'Privacy:']) assert(docs.includes(token), `listing must document ${token}`);
assert(fs.existsSync('examples/release-candidate/.github/workflows/merge-guard.yml'), 'example workflow must exist');
console.log('distribution listing contracts passed');
