#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
for (const file of ['examples/release-candidate/README.md', 'examples/release-candidate/.github/workflows/merge-guard.yml', 'docs/release-candidate.md', 'docs/migrations.md']) assert(fs.existsSync(path.join(root, file)), `${file} must exist`);
const gate = read('docs/release-candidate.md');
assert(gate.includes('RELEASE_OWNER_APPROVED=true') && gate.includes('owner approval'), 'release gate must require owner approval');
assert(gate.includes('never tag') && gate.includes('publish'), 'validation must not publish or tag');
assert(read('docs/migrations.md').includes('rollback') && read('docs/migrations.md').includes('Known limitations'), 'migration docs must cover rollback and limitations');
console.log('release-candidate contracts passed');
