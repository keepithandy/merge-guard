#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createArtifactManifest } from '../src/artifactManifest.js';
import { planLocalRetention, summarizeReportHistory } from '../src/reportTrends.js';

const previous = JSON.parse(fs.readFileSync('test/fixtures/finding-comparison/previous.json', 'utf8'));
const current = JSON.parse(fs.readFileSync('test/fixtures/finding-comparison/current.json', 'utf8'));
const currentChanged = { ...current, config: { ...current.config, failThreshold: 8 } };
const record = (report, date, commit) => ({ report, manifest: createArtifactManifest({ report, generatedAt: date, evidence: { repository: 'example/project', commit, inputType: 'report', configuration: report.config } }) });
const history = summarizeReportHistory([record(previous, '2026-08-01T00:00:00.000Z', 'one'), record(currentChanged, '2026-08-02T00:00:00.000Z', 'two')]);
assert.equal(history.points.length, 2);
assert.equal(history.points[0].riskScore, 6);
assert.equal(history.points[1].riskScore, 5);
assert.equal(history.points[0].findingCount, 3);
assert(history.warnings.some((item) => item.code === 'configuration-changed'));
const gap = summarizeReportHistory([record(current, '2026-08-04T00:00:00.000Z', 'two'), record(previous, '2026-08-01T00:00:00.000Z', 'one')]);
assert(gap.warnings.some((item) => item.code === 'history-order-gap'));
const invalid = summarizeReportHistory([{ report: current, manifest: { schemaVersion: 1 } }]);
assert.equal(invalid.points.length, 0);
const retention = planLocalRetention([record(previous, '2025-01-01T00:00:00.000Z', 'one'), record(current, '2026-08-02T00:00:00.000Z', 'two')], { now: new Date('2026-08-25T00:00:00Z'), retentionDays: 30, protectedArtifactIds: [record(previous, '2025-01-01T00:00:00.000Z', 'one').manifest.artifactId] });
assert.equal(retention.retain.length, 2);
assert.equal(retention.remove.length, 0);
assert.equal(retention.compaction.startsWith('none'), true);
console.log('report trends contracts passed');
console.log(`points=${history.points.length}`);
console.log(`warnings=${history.warnings.length}`);
console.log(`retentionProtected=${retention.protected.length}`);
