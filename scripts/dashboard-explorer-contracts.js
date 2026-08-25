#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('dashboard/app.js', 'utf8');
const html = fs.readFileSync('dashboard/index.html', 'utf8');
const fixture = JSON.parse(fs.readFileSync('test/fixtures/finding-comparison/current.json', 'utf8'));
assert(app.includes('Files by reported risk'));
assert(app.includes('rule.reason'));
assert(app.includes('matchedLineCount'));
assert(app.includes('Suggested checks'));
assert(app.includes('customRuleWarnings'));
assert(app.includes('suppressedFindings'));
assert(app.includes('textContent'));
assert(!app.includes('innerHTML'));
assert(!app.includes('analyzeDiff'));
assert(!/riskScore\s*[+*/-]=?/.test(app));
assert(fixture.files.length > 0 && fixture.rules.length > 0 && fixture.suggestedChecks.length > 0);
assert(html.includes('role="status"'));
assert(html.includes('id="output"'));
console.log('dashboard explorer contracts passed');
console.log(`fixtureFiles=${fixture.files.length}`);
console.log(`fixtureRules=${fixture.rules.length}`);
