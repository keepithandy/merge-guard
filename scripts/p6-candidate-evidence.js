#!/usr/bin/env node
// P6A: nonpublishing evidence for the actual checked-out source identity.
// This emits metadata to CI logs; it is not a release authorization.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-p6-candidate-'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
function command(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    cwd: options.cwd || root, encoding: 'utf8',
    env: options.env || process.env, maxBuffer: 3 * 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    throw new Error('Candidate evidence command failed: ' + binary + ' (status ' + result.status + ')');
  }
  return result.stdout.trim();
}
function npmPack() {
  const args = ['pack', '--json', '--ignore-scripts', '--offline',
    '--pack-destination', temp];
  const env = {
    ...process.env, npm_config_cache: path.join(temp, 'npm-cache'),
    npm_config_audit: 'false', npm_config_fund: 'false',
    npm_config_update_notifier: 'false'
  };
  if (process.env.npm_execpath) {
    return command(process.execPath, [process.env.npm_execpath, ...args], { env });
  }
  if (process.platform === 'win32') {
    // Avoid constructing a shell command from a temporary path (spaces and
    // shell metacharacters are valid in Windows profile/temp paths).
    const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    if (!fs.existsSync(npmCli)) throw new Error('Run via npm run p6:candidate-evidence.');
    return command(process.execPath, [npmCli, ...args], { env });
  }
  return command('npm', args, { env });
}

try {
  const repositoryRoot = command('git', ['rev-parse', '--show-toplevel']);
  // Windows may spell the same directory with different casing or aliases.
  // Compare filesystem identities instead of case-sensitive path strings.
  const gitRootStat = fs.statSync(repositoryRoot);
  const cwdStat = fs.statSync(root);
  if (gitRootStat.dev !== cwdStat.dev || gitRootStat.ino !== cwdStat.ino) {
    throw new Error('Run candidate evidence from the repository root.');
  }
  const gitSha = command('git', ['rev-parse', '--verify', 'HEAD']);
  assert.match(gitSha, /^[0-9a-f]{40}$/);
  function assertCleanSource() {
    if (command('git', ['status', '--porcelain=v1', '--untracked-files=all']) !== '') {
      throw new Error('Candidate evidence requires clean tracked and untracked source.');
    }
    assert.equal(command('git', ['rev-parse', '--verify', 'HEAD']), gitSha,
      'Candidate commit changed while packaging.');
  }
  assertCleanSource();
  const packageBytes = fs.readFileSync(path.join(root, 'package.json'));
  const metadata = JSON.parse(packageBytes.toString('utf8'));
  const packResult = JSON.parse(npmPack());
  assert(Array.isArray(packResult) && packResult.length === 1);
  const packed = packResult[0];
  assert.match(packed.filename, /^[a-zA-Z0-9._-]+\.tgz$/);
  assert.equal(packed.name, metadata.name);
  assert.equal(packed.version, metadata.version);
  const artifact = fs.readFileSync(path.join(temp, packed.filename));
  assert.equal(artifact.length, packed.size);
  assert.equal(createHash('sha1').update(artifact).digest('hex'), packed.shasum,
    'npm metadata must match the byte-identical tarball');
  assert(Array.isArray(packed.files) && packed.files.length > 0);
  const tracked = new Set(command('git', ['ls-files', '-z', '--cached']).split('\0'));
  for (const entry of packed.files) {
    assert(tracked.has(entry.path), 'Package includes a file outside the recorded commit.');
  }
  assertCleanSource();
  // Never emit customer/local state, file contents, keys or raw paths.
  const evidence = {
    schemaVersion: 1,
    kind: 'source-only-p6-candidate-evidence',
    checkedOutCommit: gitSha,
    sourceTreeClean: true,
    packagedFilesTracked: true,
    sourceVersion: metadata.version,
    packageJsonSha256: sha256(packageBytes),
    tarball: {
      name: packed.filename,
      sha256: sha256(artifact),
      bytes: artifact.length,
      entryCount: packed.files.length
    },
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    publicationAuthorized: false,
    livePolarSandboxVerified: false,
    operationallyReady: false
  };
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
