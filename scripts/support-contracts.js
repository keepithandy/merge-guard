#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
const text = fs.readFileSync('docs/support-process.md', 'utf8');
for (const token of ['supported', '3 business days', 'security reports', 'compatibility/conformance', 'Deprecated', 'migration', 'post-release checklist', 'revoked', 'postmortem']) assert(text.includes(token), `support process must define ${token}`);
console.log('support process contracts passed');
