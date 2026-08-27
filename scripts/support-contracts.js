#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
const text = fs.readFileSync('docs/support-process.md', 'utf8');
for (const token of ['supported', '3 business days', 'security reports', 'compatibility/conformance', 'Deprecated', 'migration', 'post-release checklist', 'revoked', 'postmortem', 'telemetry', 'doctor', 'tokens']) assert(text.includes(token), `support process must define ${token}`);
for (const file of ['.github/ISSUE_TEMPLATE/adoption-feedback.yml', '.github/ISSUE_TEMPLATE/doctor-report.yml']) assert(fs.existsSync(file), `privacy-safe support template must exist: ${file}`);
console.log('support process contracts passed');
