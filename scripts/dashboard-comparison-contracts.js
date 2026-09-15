#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compareFindingReports } from '../src/findingComparison.js';
import { compareDashboardReports, extractDashboardFindings } from '../dashboard/comparison.js';

const root = process.cwd();
function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'test', 'fixtures', 'finding-comparison', `${name}.json`), 'utf8'));
}

const previous = fixture('previous');
const current = fixture('current');
const core = compareFindingReports(previous, current);
const dashboard = compareDashboardReports(previous, current);
assert.deepEqual(dashboard.summary, core.summary, 'dashboard classifications must match the core comparator for compatible reports');
assert.equal(dashboard.configurationChanged, false);

const multiPathPrevious = {
  ...previous,
  rules: [{ id: 'routing-or-entry', label: 'Routing', weight: 2, matchedFiles: ['src/a.js', 'src/b.js'] }]
};
const multiPathCurrent = {
  ...current,
  rules: [{ id: 'routing-or-entry', label: 'Routing', weight: 2, matchedFiles: ['src/a.js', 'src/c.js'] }]
};
assert.deepEqual(compareDashboardReports(multiPathPrevious, multiPathCurrent).summary, { new: 1, unchanged: 1, resolved: 1 }, 'multi-file changes must classify per stable finding path');

const sourced = {
  ...current,
  rules: [
    { id: 'same-id', custom: true, label: 'Custom', weight: 1, matchedFiles: ['src/shared.js'] },
    { id: 'same-id', policyPackId: 'policy.example', label: 'Policy', weight: 1, matchedFiles: ['src/shared.js'] }
  ]
};
assert.equal(extractDashboardFindings(sourced).length, 2, 'custom and policy findings with the same rule ID must stay distinct');
assert.equal(compareDashboardReports(previous, { ...current, config: { ...current.config, preset: 'strict' } }).configurationChanged, true);

const app = fs.readFileSync(path.join(root, 'dashboard', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'dashboard', 'index.html'), 'utf8');
assert(app.includes("import { compareDashboardReports } from './comparison.js'"));
assert(app.includes('Choose report order'));
assert(app.includes('Swap reports'));
assert(app.includes('Configuration changed between reports'));
assert(app.includes('document.createElement(\'details\')'));
assert(html.includes('choose which report is earlier'));

console.log('dashboard comparison contracts passed');
console.log(`new=${dashboard.summary.new}`);
console.log(`unchanged=${dashboard.summary.unchanged}`);
console.log(`resolved=${dashboard.summary.resolved}`);
