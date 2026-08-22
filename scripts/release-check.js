import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const checks = [];

function run(label, command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  const passed = result.status === 0 && !result.error;
  checks.push({ label, passed, detail: result.error?.message || result.stderr.trim() || result.stdout.trim() });
  return result;
}

function assert(label, condition, detail) {
  checks.push({ label, passed: Boolean(condition), detail: condition ? '' : detail });
}

run('smoke suite', 'npm', ['run', 'smoke']);
run('CLI help', process.execPath, ['src/cli.js', '--help']);
run('sample Markdown report', process.execPath, ['src/cli.js', '--markdown', 'examples/sample.diff']);
const jsonResult = run('sample JSON report', process.execPath, ['src/cli.js', '--json', 'examples/sample.diff']);
try {
  const report = JSON.parse(jsonResult.stdout);
  assert('JSON report contract', report.tool === 'merge-guard' && typeof report.schemaVersion === 'string', 'report is missing tool or schemaVersion');
} catch (error) {
  assert('JSON report contract', false, error.message);
}
run('package dry run', 'npm', ['pack', '--dry-run']);

const action = fs.readFileSync(path.join(root, 'action.yml'), 'utf8');
assert('action targets', action.includes('src/cli.js') && action.includes('scripts/pr-comment.js'), 'action.yml references missing runtime targets');
assert('package metadata', packageMetadata.name === 'merge-guard' && /^\d+\.\d+\.\d+$/.test(packageMetadata.version), 'package name or semantic version is invalid');

const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
assert('changelog alignment', changelog.includes('## Unreleased') || changelog.includes(packageMetadata.version), 'CHANGELOG.md has no current release section');

for (const check of checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.label}${check.detail ? `: ${check.detail}` : ''}`);
}

if (checks.some((check) => !check.passed)) process.exitCode = 1;
