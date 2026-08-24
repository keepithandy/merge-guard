#!/usr/bin/env node

import fs from 'node:fs';
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

function run(label, command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  const detail = result.error?.message || (result.status === 0 ? 'completed successfully' : `exit code ${result.status}`);
  check(label, result.status === 0, detail);
}

function runNpmPack() {
  const args = ['pack', '--dry-run', '--json'];

  if (process.env.npm_execpath) {
    run('npm pack dry run', process.execPath, [process.env.npm_execpath, ...args]);
    return;
  }

  if (process.platform === 'win32') {
    run('npm pack dry run', process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`]);
    return;
  }

  run('npm pack dry run', 'npm', args);
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
  check('Action exposes release-relevant inputs', ['preset:', 'comment:', 'fail-threshold:', 'diff-path:'].every((item) => content.includes(item)));
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
check('Demo diff exists', Boolean(read('examples/sample.diff')));
check('README exists', Boolean(read('README.md')));
check('CHANGELOG exists', Boolean(read('CHANGELOG.md')));
check('LICENSE exists', Boolean(read('LICENSE')));

if (metadata) {
  check('release:check script is configured', metadata.scripts?.['release:check'] === 'node scripts/release-readiness.js');
  check('smoke script is configured', Boolean(metadata.scripts?.smoke));
  check('demo script is configured', Boolean(metadata.scripts?.demo));
  check('package exposes the CLI binary', metadata.bin?.['merge-guard'] === './src/cli.js');
  for (const entry of ['src/', 'scripts/', 'examples/', 'action.yml', 'README.md', 'CHANGELOG.md', 'LICENSE']) {
    check(`package includes ${entry}`, Array.isArray(metadata.files) && metadata.files.includes(entry));
  }
}

actionContract();
changelogContract(metadata);
run('CLI help command', process.execPath, ['src/cli.js', '--help']);
run('Smoke test suite', process.execPath, ['scripts/smoke.js']);
run('Demo report generation', process.execPath, ['src/cli.js', 'examples/sample.diff']);
run('Markdown report generation', process.execPath, ['src/cli.js', '--markdown', 'examples/sample.diff']);
run('JSON report generation', process.execPath, ['src/cli.js', '--json', 'examples/sample.diff']);
runNpmPack();
printReport();
process.exitCode = failed ? 1 : 0;
