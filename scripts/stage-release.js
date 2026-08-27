#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const output = path.resolve(root, process.argv[2] || path.join('release', `v${packageJson.version}`));
const relativeOutput = path.relative(root, output).replaceAll('\\', '/');

if (relativeOutput.startsWith('../') || path.isAbsolute(relativeOutput) || !relativeOutput.startsWith('release/')) {
  throw new Error('release output must be a new directory inside release/');
}
if (fs.existsSync(output)) throw new Error(`release output already exists: ${output}`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd || root, env: options.env || process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `:\n${detail}` : ''}`);
  }
  return result.stdout.trim();
}

function runNpm(args, cwd, env) {
  if (process.env.npm_execpath) return run(process.execPath, [process.env.npm_execpath, ...args], { cwd, env });
  return run(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd, env });
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const status = run('git', ['status', '--porcelain', '--untracked-files=all']);
const changesOutsideRelease = status.split(/\r?\n/).filter(Boolean).filter((line) => !line.slice(3).replaceAll('\\', '/').startsWith('release/'));
if (changesOutsideRelease.length) throw new Error(`commit all non-release changes before staging:\n${changesOutsideRelease.join('\n')}`);

const sourceCommit = run('git', ['rev-parse', 'HEAD']);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-release-'));
const checkout = path.join(temp, 'source');
const packOne = path.join(temp, 'pack-one');
const packTwo = path.join(temp, 'pack-two');
const npmCache = path.join(temp, 'npm-cache');
let worktreeAdded = false;
let staging;

try {
  fs.mkdirSync(packOne); fs.mkdirSync(packTwo);
  run('git', ['worktree', 'add', '--detach', checkout, sourceCommit]);
  worktreeAdded = true;
  const env = { ...process.env, npm_config_audit: 'false', npm_config_cache: npmCache, npm_config_fund: 'false', npm_config_update_notifier: 'false' };
  const readinessOutput = runNpm(['run', 'release:check'], checkout, env).replaceAll('\r\n', '\n');
  const readiness = readinessOutput.match(/Checks:\s+(\d+)\/(\d+) passed/);
  if (!readiness || readiness[1] !== readiness[2]) throw new Error('release readiness output did not report a complete passing gate');

  const firstPack = JSON.parse(runNpm(['pack', '--ignore-scripts', '--json', '--pack-destination', packOne], checkout, env))[0];
  const secondPack = JSON.parse(runNpm(['pack', '--ignore-scripts', '--json', '--pack-destination', packTwo], checkout, env))[0];
  const firstPath = path.join(packOne, firstPack.filename);
  const secondPath = path.join(packTwo, secondPack.filename);
  const firstBytes = fs.readFileSync(firstPath);
  const secondBytes = fs.readFileSync(secondPath);
  const firstDigest = crypto.createHash('sha256').update(firstBytes).digest('hex');
  const secondDigest = crypto.createHash('sha256').update(secondBytes).digest('hex');
  if (!firstBytes.equals(secondBytes)) throw new Error(`clean package rebuilds differ: ${firstDigest} != ${secondDigest}`);

  fs.mkdirSync(path.dirname(output), { recursive: true });
  staging = fs.mkdtempSync(path.join(path.dirname(output), '.merge-guard-release-'));
  const artifactPath = path.join(staging, firstPack.filename);
  const sbomPath = path.join(staging, 'SBOM.cdx.json');
  const notesPath = path.join(staging, 'RELEASE_NOTES.md');
  const decisionPath = path.join(staging, 'RELEASE_DECISION.md');
  const checksPath = path.join(staging, 'RELEASE_CHECKS.txt');
  const packetPath = path.join(staging, 'OWNER_DECISION_PACKET.md');
  const provenancePath = path.join(staging, 'PROVENANCE.json');
  fs.copyFileSync(firstPath, artifactPath);
  fs.copyFileSync(path.join(checkout, 'docs', 'security', 'sbom.json'), sbomPath);
  fs.copyFileSync(path.join(checkout, 'docs', 'releases', `V${packageJson.version}_RELEASE_NOTES.md`), notesPath);
  fs.copyFileSync(path.join(checkout, 'docs', 'releases', `V${packageJson.version}_RELEASE_DECISION.md`), decisionPath);
  const npmVersion = runNpm(['--version'], checkout, env);
  fs.writeFileSync(checksPath, [`sourceCommit=${sourceCommit}`, `node=${process.version}`, `npm=${npmVersion}`, `platform=${process.platform}`, `arch=${process.arch}`, '', readinessOutput, ''].join('\n'), 'utf8');
  fs.writeFileSync(packetPath, [
    `# Merge Guard v${packageJson.version} owner decision packet`, '',
    'Status: **PREPARED — APPROVAL, SIGNING, PUBLICATION, AND VERIFICATION PENDING**', '',
    'This packet is non-publishing evidence. Passing checks do not authorize any external action.', '',
    '## Candidate identity', '',
    `- Source commit: \`${sourceCommit}\``, `- Package: \`${packageJson.name}@${packageJson.version}\``, `- Artifact: \`${firstPack.filename}\``, `- Artifact SHA-256: \`${firstDigest}\``, `- Reproducible rebuild SHA-256: \`${secondDigest}\``, `- Toolchain: Node \`${process.version}\`, npm \`${npmVersion}\`, \`${process.platform}/${process.arch}\``, '',
    '## Validation', '',
    `- Local release readiness: **${readiness[1]}/${readiness[2]} passed** (full output: \`RELEASE_CHECKS.txt\`)`, '- Package and SBOM version consistency, archive installation, security, performance, public contract, artifact, distribution, and support gates are included in that result.', '- Reproducibility scope: two byte-identical clean builds from the same detached checkout and recorded toolchain.', '- Supported Node/OS matrix evidence must be linked separately to immutable workflow runs for this exact source commit before approval.', '',
    '## Known limitations', '',
    '- Merge Guard is decision support, does not execute suggested project commands, and does not replace testing or review.', '- Repository impact is explicit-metadata based; SARIF is not uploaded; the dashboard is local and non-persistent; plugin workers are not a hostile-code sandbox.', '',
    '## Owner decision and external mutations', '',
    '- Prepared: **yes**', '- Approved: **pending explicit owner record**', '- Published: **no**', '- Verified: **no**', '- Signature: **unsigned**', '- Authorized mutations: **none**', '',
    'An owner must separately authorize signing, tag creation, npm publication, GitHub release creation, stable Action-reference changes, and Marketplace actions. Follow RELEASE_DECISION.md for publication, abort, rollback, revocation, and support handoff.'
  ].join('\n'), 'utf8');

  const subjects = [artifactPath, sbomPath, notesPath, decisionPath, checksPath, packetPath].map((file) => ({ name: path.basename(file), digest: { sha256: sha256(file) } }));
  writeJson(provenancePath, {
    schemaVersion: 1,
    schema: `https://raw.githubusercontent.com/keepithandy/merge-guard/${sourceCommit}/schemas/release-provenance-v1.schema.json`,
    package: { name: packageJson.name, version: packageJson.version },
    source: { repository: 'https://github.com/keepithandy/merge-guard', commit: sourceCommit, trackedChanges: 'clean' },
    subjects,
    build: { command: 'npm pack --ignore-scripts', checkout: 'detached git worktree', environment: { node: process.version, npm: npmVersion, platform: process.platform, arch: process.arch }, textPolicy: '* text=auto eol=lf' },
    reproducibility: { verified: true, scope: 'two clean package builds from the same immutable checkout and toolchain', firstSha256: firstDigest, secondSha256: secondDigest },
    releaseReadiness: { command: 'npm run release:check', passed: Number(readiness[1]), total: Number(readiness[2]), evidence: 'RELEASE_CHECKS.txt' },
    signature: { status: 'unsigned', signer: null, signatureFile: null },
    approval: { required: true, status: 'pending', owner: null },
    publication: { status: 'blocked-pending-owner-approval-and-registry-authentication' }
  });
  const checksumFiles = [artifactPath, sbomPath, notesPath, decisionPath, checksPath, packetPath, provenancePath];
  fs.writeFileSync(path.join(staging, 'SHA256SUMS'), `${checksumFiles.map((file) => `${sha256(file)}  ${path.basename(file)}`).join('\n')}\n`, 'utf8');
  fs.renameSync(staging, output); staging = null;
  console.log(JSON.stringify({ output, sourceCommit, artifact: firstPack.filename, sha256: firstDigest, releaseReadiness: `${readiness[1]}/${readiness[2]}`, publication: 'blocked-pending-owner-approval' }, null, 2));
} finally {
  if (worktreeAdded) spawnSync('git', ['worktree', 'remove', '--force', checkout], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if (staging && fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
  fs.rmSync(temp, { recursive: true, force: true });
}
