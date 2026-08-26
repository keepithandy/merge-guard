#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
const text = fs.readFileSync('docs/release-artifacts.md', 'utf8');
for (const token of ['npm pack', 'SHA-256', 'CycloneDX', 'sign', 'Verification', 'RELEASE_OWNER_APPROVED=true', 'revoke', 'roll back']) assert(text.includes(token), `artifact flow must define ${token}`);
assert(fs.existsSync('docs/security/sbom.json'), 'SBOM must be available');
assert(fs.existsSync('docs/migrations.md'), 'rollback documentation must be available');
console.log('release artifact contracts passed');
