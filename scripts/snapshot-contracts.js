#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { analyzeDiff } from '../src/analyzeDiff.js';
import { applyCustomRules } from '../src/customRules.js';
import { applyPrContext } from '../src/prContext.js';
import { applySuppressions } from '../src/suppressions.js';

const root = process.cwd();
const reportSnapshotPath = path.join(root, 'test/snapshots/report-contracts.json');
const suppressionSnapshotPath = path.join(root, 'test/snapshots/suppression-contracts.json');
const suppressionFixturePath = path.join(root, 'test/fixtures/suppressions/cases.json');
const requiredFields = [
  'tool',
  'version',
  'riskLevel',
  'mergeReadiness',
  'riskScore',
  'docsOnly',
  'config',
  'summary',
  'files',
  'rules',
  'flags',
  'suggestedChecks',
  'schemaVersion',
  'configDiagnostics'
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function buildReport(diffText, {
  config = {},
  customRules = [],
  suppressions = [],
  prContext = null,
  today = new Date('2026-08-24T00:00:00.000Z')
} = {}) {
  const report = applyPrContext(
    applySuppressions(
      applyCustomRules(analyzeDiff(diffText, config), diffText, customRules),
      suppressions,
      today
    ),
    prContext
  );

  report.schemaVersion = 1;
  report.configDiagnostics = [];
  return report;
}

function assertRequiredFields(report, label) {
  const missing = requiredFields.filter((field) => !Object.hasOwn(report, field));
  if (missing.length) {
    throw new Error(`${label} report is missing required field(s): ${missing.join(', ')}`);
  }

  if (report.schemaVersion !== 1) {
    throw new Error(`${label} report must use schemaVersion 1`);
  }
}

function snapshotRule(rule) {
  return {
    id: rule.id,
    custom: Boolean(rule.custom),
    label: rule.label,
    weight: rule.weight,
    reason: rule.reason,
    check: rule.check,
    matchedFiles: rule.matchedFiles || [],
    matchedLineCount: rule.matchedLineCount || 0
  };
}

function snapshotReport(report, label) {
  assertRequiredFields(report, label);

  return {
    schemaVersion: report.schemaVersion,
    tool: report.tool,
    version: report.version,
    riskLevel: report.riskLevel,
    mergeReadiness: report.mergeReadiness,
    riskScore: report.riskScore,
    docsOnly: report.docsOnly,
    config: {
      preset: report.config.preset,
      failThreshold: report.config.failThreshold,
      reviewThreshold: report.config.reviewThreshold,
      customRules: report.config.customRules || [],
      suppressions: report.config.suppressions || []
    },
    summary: report.summary,
    files: report.files.map((file) => ({
      path: file.path,
      riskLevel: file.riskLevel,
      riskScore: file.riskScore,
      addedLines: file.addedLines,
      removedLines: file.removedLines,
      reason: file.reason,
      flags: file.flags,
      rules: file.rules.map(snapshotRule)
    })),
    rules: report.rules.map(snapshotRule),
    flags: report.flags,
    suggestedChecks: report.suggestedChecks,
    customRuleWarnings: report.customRuleWarnings || [],
    suppressionWarnings: report.suppressionWarnings || [],
    suppressedFindings: (report.suppressedFindings || []).map((finding) => ({
      ...snapshotRule(finding),
      suppression: finding.suppression
    })),
    prContext: report.prContext,
    configDiagnostics: report.configDiagnostics
  };
}

function compareSnapshot(actual, snapshotPath, label) {
  const expected = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const actualText = JSON.stringify(actual, null, 2);
  const expectedText = JSON.stringify(expected, null, 2);

  if (actualText !== expectedText) {
    console.error(`${label} snapshot mismatch`);
    console.error('Expected:');
    console.error(expectedText);
    console.error('Actual:');
    console.error(actualText);
    process.exitCode = 1;
  }
}

const sampleDiff = read('examples/sample.diff');
const docsOnlyDiff = read('examples/docs-only.diff');
const suppressionFixtures = JSON.parse(fs.readFileSync(suppressionFixturePath, 'utf8'));
const today = new Date(suppressionFixtures.today);
const customRule = {
  id: 'app-readiness-guard',
  label: 'App readiness guard changed',
  pathPattern: 'src/app',
  linePattern: 'ready',
  weight: 3,
  check: 'Run the app startup smoke.'
};
const prContext = {
  title: 'Harden app startup readiness',
  body: 'Preserves startup behavior and adds focused verification.'
};

const reportSnapshots = {
  standard: snapshotReport(buildReport(sampleDiff), 'standard'),
  docsOnly: snapshotReport(buildReport(docsOnlyDiff), 'docs-only'),
  customRule: snapshotReport(buildReport(sampleDiff, { customRules: [customRule] }), 'custom-rule'),
  prContext: snapshotReport(buildReport(sampleDiff, { prContext }), 'PR-context')
};

const suppressionSnapshots = Object.fromEntries(
  ['active', 'expired', 'unmatched', 'malformed'].map((name) => [
    name,
    snapshotReport(
      buildReport(sampleDiff, {
        suppressions: suppressionFixtures[name],
        today
      }),
      `suppression-${name}`
    )
  ])
);

if (!fs.existsSync(reportSnapshotPath) || !fs.existsSync(suppressionSnapshotPath)) {
  console.log('REPORT_SNAPSHOTS_BEGIN');
  console.log(JSON.stringify(reportSnapshots, null, 2));
  console.log('REPORT_SNAPSHOTS_END');
  console.log('SUPPRESSION_SNAPSHOTS_BEGIN');
  console.log(JSON.stringify(suppressionSnapshots, null, 2));
  console.log('SUPPRESSION_SNAPSHOTS_END');
  console.log('Snapshot baselines are not committed yet.');
  process.exit(0);
}

compareSnapshot(reportSnapshots, reportSnapshotPath, 'report contracts');
compareSnapshot(suppressionSnapshots, suppressionSnapshotPath, 'suppression contracts');

if (!process.exitCode) {
  console.log('merge-guard contract snapshots passed');
}
