#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const checks = [];
let failed = false;

function check(label, passed, detail = '') {
  const status = passed ? 'PASS' : 'FAIL';
  checks.push({ label, status, detail });
  if (!passed) failed = true;
}

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  return fs.readFileSync(absolutePath, 'utf8');
}

function run(label, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: options.env || process.env,
    stdio: 'pipe'
  });
  const detail = result.error?.message || (result.status === 0 ? 'completed successfully' : `exit code ${result.status}`);
  check(label, result.status === 0, detail);
}

function runNpmPack() {
  const args = ['pack', '--dry-run', '--json'];
  const npmCache = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-npm-cache-'));
  const env = {
    ...process.env,
    npm_config_audit: 'false',
    npm_config_cache: npmCache,
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false'
  };

  try {
    if (process.env.npm_execpath) {
      run('npm pack dry run', process.execPath, [process.env.npm_execpath, ...args], { env });
      return;
    }

    if (process.platform === 'win32') {
      run('npm pack dry run', process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], { env });
      return;
    }

    run('npm pack dry run', 'npm', args, { env });
  } finally {
    fs.rmSync(npmCache, { recursive: true, force: true });
  }
}

function packageMetadata() {
  const content = read('package.json');
  if (!content) {
    check('package.json is readable', false, 'file is missing');
    return null;
  }
  try {
    const metadata = JSON.parse(content);
    check('package.json is valid JSON', true);
    return metadata;
  } catch (error) {
    check('package.json is valid JSON', false, error.message);
    return null;
  }
}

function actionContract() {
  const content = read('action.yml');
  check('action.yml exists', Boolean(content), content ? '' : 'file is missing');
  if (!content) return;
  check('action.yml has a composite runtime', content.includes('using: composite'));
  check('Action targets the CLI', content.includes('src/cli.js'));
  check('Action targets the PR comment helper', content.includes('scripts/pr-comment.js'));
  check('Action exposes release-relevant inputs', ['preset:', 'comment:', 'comment-dry-run:', 'fail-threshold:', 'annotations:', 'sarif:', 'compare:', 'previous-report:', 'diff-path:'].every((item) => content.includes(item)));
}

function changelogContract(metadata) {
  const content = read('CHANGELOG.md');
  check('CHANGELOG.md exists', Boolean(content), content ? '' : 'file is missing');
  check('Unreleased changelog section exists', Boolean(content?.includes('## Unreleased')));
  check('Release checklist mentions this command', Boolean(content?.includes('npm run release:check')));
  check('Package version is present', Boolean(metadata?.version), metadata?.version || 'missing version');
}

function printReport() {
  const passed = checks.filter((item) => item.status === 'PASS').length;
  console.log('merge-guard release readiness');
  console.log('');
  console.log(`Result: ${failed ? 'NOT READY' : 'READY'}`);
  console.log(`Checks: ${passed}/${checks.length} passed`);
  console.log('');
  for (const item of checks) {
    console.log(`[${item.status}] ${item.label}${item.detail ? ` — ${item.detail}` : ''}`);
  }
}

const metadata = packageMetadata();
check('CLI entrypoint exists', Boolean(read('src/cli.js')));
check('Smoke script exists', Boolean(read('scripts/smoke.js')));
check('Dashboard architecture contract exists', Boolean(read('dashboard/architecture-boundary.v1.json')));
check('Dashboard architecture gate exists', Boolean(read('scripts/dashboard-architecture-contracts.js')));
check('Dashboard import gate exists', Boolean(read('scripts/dashboard-import-contracts.js')));
check('Dashboard explorer gate exists', Boolean(read('scripts/dashboard-explorer-contracts.js')));
check('Dashboard accessibility gate exists', Boolean(read('scripts/dashboard-accessibility-contracts.js')));
check('Artifact manifest gate exists', Boolean(read('scripts/artifact-manifest-contracts.js')));
check('Legacy risk gate exists', Boolean(read('scripts/legacy-risk-contracts.js')));
check('Report trends gate exists', Boolean(read('scripts/report-trends-contracts.js')));
check('Plugin manifest gate exists', Boolean(read('scripts/plugin-manifest-contracts.js')));
check('Plugin worker gate exists', Boolean(read('scripts/plugin-worker-contracts.js')));
check('Plugin attestation gate exists', Boolean(read('scripts/plugin-attestation-contracts.js')));
check('Plugin conformance gate exists', Boolean(read('scripts/plugin-conformance-contracts.js')));
check('Installation validation gate exists', Boolean(read('scripts/installation-contracts.js')));
check('Security validation gate exists', Boolean(read('scripts/security-contracts.js')));
check('Performance validation gate exists', Boolean(read('scripts/performance-contracts.js')));
check('Release-candidate validation gate exists', Boolean(read('scripts/release-candidate-contracts.js')));
check('Public contract gate exists', Boolean(read('scripts/public-contracts.js')));
check('Release artifact gate exists', Boolean(read('scripts/artifact-release-contracts.js')));
check('Distribution gate exists', Boolean(read('scripts/distribution-contracts.js')));
check('Support gate exists', Boolean(read('scripts/support-contracts.js')));
check('Version consistency gate exists', Boolean(read('scripts/version-contracts.js')));
check('Release staging script exists', Boolean(read('scripts/stage-release.js')));
check('Release provenance schema exists', Boolean(read('schemas/release-provenance-v1.schema.json')));
check('Demo diff exists', Boolean(read('examples/sample.diff')));
check('README exists', Boolean(read('README.md')));
check('CHANGELOG exists', Boolean(read('CHANGELOG.md')));
check('LICENSE exists', Boolean(read('LICENSE')));

if (metadata) {
  check('release:check script is configured', metadata.scripts?.['release:check'] === 'node scripts/release-readiness.js');
  check('smoke script is configured', Boolean(metadata.scripts?.smoke));
  check('demo script is configured', Boolean(metadata.scripts?.demo));
  check('dashboard architecture script is configured', Boolean(metadata.scripts?.['test:dashboard-architecture']));
  check('dashboard import script is configured', Boolean(metadata.scripts?.['test:dashboard-import']));
  check('dashboard explorer script is configured', Boolean(metadata.scripts?.['test:dashboard-explorer']));
  check('dashboard accessibility script is configured', Boolean(metadata.scripts?.['test:dashboard-accessibility']));
  check('artifact manifest script is configured', Boolean(metadata.scripts?.['test:artifact-manifest']));
  check('legacy risk script is configured', Boolean(metadata.scripts?.['test:legacy-risk']));
  check('report trends script is configured', Boolean(metadata.scripts?.['test:report-trends']));
  check('plugin manifest script is configured', Boolean(metadata.scripts?.['test:plugin-manifest']));
  check('plugin worker script is configured', Boolean(metadata.scripts?.['test:plugin-worker']));
  check('plugin attestation script is configured', Boolean(metadata.scripts?.['test:plugin-attestation']));
check('plugin conformance script is configured', Boolean(metadata.scripts?.['test:plugin-conformance']));
check('installation script is configured', Boolean(metadata.scripts?.['test:installation']));
check('security script is configured', Boolean(metadata.scripts?.['test:security']));
check('performance script is configured', Boolean(metadata.scripts?.['test:performance']));
check('release-candidate script is configured', Boolean(metadata.scripts?.['test:release-candidate']));
check('public-contract script is configured', Boolean(metadata.scripts?.['test:public-contracts']));
check('release-artifacts script is configured', Boolean(metadata.scripts?.['test:release-artifacts']));
check('distribution script is configured', Boolean(metadata.scripts?.['test:distribution']));
check('support script is configured', Boolean(metadata.scripts?.['test:support']));
check('version consistency script is configured', metadata.scripts?.['test:version'] === 'node scripts/version-contracts.js');
check('release staging script is configured', metadata.scripts?.['release:stage'] === 'node scripts/stage-release.js');
  check('package exposes the CLI binary', metadata.bin?.['merge-guard'] === './src/cli.js');
  for (const entry of ['src/', 'scripts/', 'examples/', 'action.yml', 'README.md', 'CHANGELOG.md', 'LICENSE']) {
    check(`package includes ${entry}`, Array.isArray(metadata.files) && metadata.files.includes(entry));
  }
}

actionContract();
changelogContract(metadata);
for (const [label, script] of [
  ['CLI contracts', 'scripts/cli-contracts.js'],
  ['Snapshot contracts', 'scripts/snapshot-contracts.js'],
  ['Repository intelligence contracts', 'scripts/repository-intelligence-contracts.js'],
  ['Repository intelligence snapshots', 'scripts/repository-intelligence-snapshots.js'],
  ['Policy-pack contracts', 'scripts/policy-pack-contracts.js'],
  ['Review-guidance contracts', 'scripts/review-guidance-contracts.js'],
  ['Policy-resolution contracts', 'scripts/policy-resolution-contracts.js'],
  ['Pull-request summary contracts', 'scripts/pr-summary-contracts.js'],
  ['GitHub review contracts', 'scripts/github-review-contracts.js'],
  ['Finding-comparison contracts', 'scripts/finding-comparison-contracts.js'],
  ['Review experience fixture', 'scripts/review-experience-e2e.js'],
  ['Dashboard architecture contracts', 'scripts/dashboard-architecture-contracts.js'],
  ['Dashboard import contracts', 'scripts/dashboard-import-contracts.js'],
  ['Dashboard explorer contracts', 'scripts/dashboard-explorer-contracts.js'],
  ['Dashboard accessibility contracts', 'scripts/dashboard-accessibility-contracts.js'],
  ['Artifact-manifest contracts', 'scripts/artifact-manifest-contracts.js'],
  ['Legacy-risk contracts', 'scripts/legacy-risk-contracts.js'],
  ['Report-trend contracts', 'scripts/report-trends-contracts.js'],
  ['Plugin-manifest contracts', 'scripts/plugin-manifest-contracts.js'],
  ['Plugin-worker contracts', 'scripts/plugin-worker-contracts.js'],
  ['Plugin-attestation contracts', 'scripts/plugin-attestation-contracts.js'],
  ['Plugin-conformance contracts', 'scripts/plugin-conformance-contracts.js'],
  ['Installation contracts', 'scripts/installation-contracts.js'],
  ['Security contracts', 'scripts/security-contracts.js'],
  ['Performance contracts', 'scripts/performance-contracts.js'],
  ['Release-candidate contracts', 'scripts/release-candidate-contracts.js'],
  ['Public-contract contracts', 'scripts/public-contracts.js'],
  ['Release-artifact contracts', 'scripts/artifact-release-contracts.js'],
  ['Distribution contracts', 'scripts/distribution-contracts.js'],
  ['Support contracts', 'scripts/support-contracts.js'],
  ['Version consistency contracts', 'scripts/version-contracts.js']
]) run(label, process.execPath, [script]);
run('CLI help command', process.execPath, ['src/cli.js', '--help']);
run('Smoke test suite', process.execPath, ['scripts/smoke.js']);
run('Demo report generation', process.execPath, ['src/cli.js', 'examples/sample.diff']);
run('Markdown report generation', process.execPath, ['src/cli.js', '--markdown', 'examples/sample.diff']);
run('JSON report generation', process.execPath, ['src/cli.js', '--json', 'examples/sample.diff']);
runNpmPack();
printReport();
process.exitCode = failed ? 1 : 0;
