#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-install-'));
const env = { ...process.env, npm_config_update_notifier: 'false', npm_config_fund: 'false', npm_config_audit: 'false', npm_config_cache: path.join(temp, 'npm-cache') };
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const node = process.execPath;
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, env, shell: process.platform === 'win32', encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const json = (text) => JSON.parse(text);
const packageName = 'merge-guard';

try {
  const pack = json(run(npm, ['pack', '--json'], root));
  assert.equal(pack.length, 1, 'npm pack should produce one artifact');
  const tarball = path.resolve(root, pack[0].filename);
  assert(fs.existsSync(tarball), 'packed artifact should exist');
  const listed = new Set(pack[0].files.map((entry) => entry.path));
  for (const required of ['package.json', 'src/cli.js', 'README.md', 'examples/sample.diff']) assert(listed.has(required), `package should include ${required}`);
  assert(pack[0].files.every((entry) => !entry.path.startsWith('.git/')), 'package must exclude git metadata');

  const local = path.join(temp, 'local');
  const global = path.join(temp, 'global');
  fs.mkdirSync(local); fs.mkdirSync(global);
  run(npm, ['install', '--prefix', local, '--ignore-scripts', tarball]);
  const localBin = path.join(local, 'node_modules', '.bin', process.platform === 'win32' ? 'merge-guard.cmd' : 'merge-guard');
  assert(fs.existsSync(localBin), 'local install should expose the executable');
  const help = run(localBin, ['--help'], root);
  const sample = run(localBin, ['examples/sample.diff'], root);
  const report = run(localBin, ['--json', 'examples/sample.diff'], root);
  assert(help.includes('Usage:'), 'CLI help should be available after local install');
  assert(sample.includes('Merge readiness:'), 'sample scan should produce a report');
  assert.equal(json(report).schemaVersion, 1, 'JSON output should use schema version 1');

  run(npm, ['install', '--prefix', global, '--global', '--ignore-scripts', tarball]);
  const globalBin = path.join(global, process.platform === 'win32' ? 'merge-guard.cmd' : 'bin/merge-guard');
  assert(fs.existsSync(globalBin), 'global install should expose the executable');
  assert(run(globalBin, ['--help'], root).includes('Usage:'), 'global CLI help should work');
  run(npm, ['uninstall', '--prefix', global, '--global', packageName]);
  assert(!fs.existsSync(path.join(global, 'lib', 'node_modules', packageName)), 'global uninstall should remove the package');

  const npxStyle = run(npm, ['exec', '--yes', '--package', tarball, '--', 'merge-guard', '--help'], root);
  assert(npxStyle.includes('Usage:'), 'npx-style execution should work from the packed artifact');
  console.log(JSON.stringify({ platform: process.platform, arch: process.arch, node: process.version, package: pack[0].filename, local: true, global: true, npx: true, published: false }, null, 2));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
  for (const file of fs.readdirSync(root).filter((entry) => entry.startsWith(`${packageName}-`) && entry.endsWith('.tgz'))) fs.rmSync(path.join(root, file), { force: true });
}
