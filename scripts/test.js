#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

// Keep the detailed contract files close to their implementation, but give
// contributors one predictable command for the complete local suite.
const suites = [
  'scripts/cli-contracts.js',
  'scripts/snapshot-contracts.js',
  'scripts/repository-intelligence-contracts.js',
  'scripts/repository-intelligence-snapshots.js',
  'scripts/impact-metadata-contracts.js',
  'scripts/impact-compatibility-performance-contracts.js',
  'scripts/policy-pack-contracts.js',
  'scripts/review-guidance-contracts.js',
  'scripts/policy-resolution-contracts.js',
  'scripts/pr-summary-contracts.js',
  'scripts/github-review-contracts.js',
  'scripts/finding-comparison-contracts.js',
  'scripts/review-experience-e2e.js',
  'scripts/review-projection-contracts.js',
  'scripts/evidence-reproducibility-contracts.js',
  'scripts/evaluation-design-contracts.js',
  'scripts/historical-pr-evaluation-contracts.js',
  'scripts/dashboard-architecture-contracts.js',
  'scripts/dashboard-import-contracts.js',
  'scripts/dashboard-explorer-contracts.js',
  'scripts/dashboard-accessibility-contracts.js',
  'scripts/artifact-manifest-contracts.js',
  'scripts/evidence-handoff-contracts.js',
  'scripts/legacy-risk-contracts.js',
  'scripts/report-trends-contracts.js',
  'scripts/plugin-manifest-contracts.js',
  'scripts/plugin-worker-contracts.js',
  'scripts/plugin-attestation-contracts.js',
  'scripts/plugin-conformance-contracts.js',
  'scripts/installation-contracts.js',
  'scripts/security-contracts.js',
  'scripts/performance-contracts.js',
  'scripts/release-candidate-contracts.js',
  'scripts/public-contracts.js',
  'scripts/artifact-release-contracts.js',
  'scripts/distribution-contracts.js',
  'scripts/support-contracts.js',
  'scripts/version-contracts.js',
  'scripts/doctor-contracts.js',
  'scripts/consumer-conformance-contracts.js',
  'scripts/smoke.js'
];

let failed = false;

for (const suite of suites) {
  const result = spawnSync(process.execPath, [suite], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.status === 0) {
    console.log(`PASS ${suite}`);
    continue;
  }

  failed = true;
  console.error(`FAIL ${suite}`);
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (output) console.error(output.split(/\r?\n/).slice(-20).join('\n'));
}

if (failed) process.exitCode = 1;
else console.log(`merge-guard test suite passed (${suites.length} suites)`);
