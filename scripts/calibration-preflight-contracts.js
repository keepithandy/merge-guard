#!/usr/bin/env node
// Synthetic unit fixtures exercise structural checks, not independent evidence.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assessCalibrationPreflight, CALIBRATION_PREFLIGHT_MINIMUMS } from '../src/calibrationPreflight.js';

assert.deepEqual(CALIBRATION_PREFLIGHT_MINIMUMS, {
  supportedConcerns: 15,
  lowRiskControls: 15,
  highSeveritySupportedConcerns: 5
});

function syntheticCase(index, { lowRisk = false, severity = 'medium', provenance = 'incident', status = 'agreed', decisions = ['include', 'include'], partition = 'calibration' } = {}) {
  return {
    entry: { id: `synthetic-${index}`, partition },
    inputHash: createHash('sha256').update(`synthetic-${index}`).digest('hex'),
    labels: {
      lowRisk,
      labelers: decisions.map((decision, i) => ({ alias: `labeler-${i}`, decision })),
      adjudication: { status },
      concerns: lowRisk ? [] : [{
        id: `concern-${index}`,
        ruleFamilies: ['routing-or-entry'],
        severity,
        provenance
      }]
    }
  };
}

const sufficient = {
  records: [
    ...Array.from({ length: 15 }, (_, i) => syntheticCase(i, { severity: i < 5 ? 'high' : 'medium' })),
    ...Array.from({ length: 15 }, (_, i) => syntheticCase(i + 15, { lowRisk: true }))
  ]
};
const counted = assessCalibrationPreflight(sufficient);
assert.equal(counted.status, 'human-verification-required', 'synthetic fixture counts never authorize official Phase 1 PASS');
assert.deepEqual(counted.blockers, []);
assert.equal(counted.counts.supportedConcerns, 15);
assert.equal(counted.counts.highSeveritySupportedConcerns, 5);
assert.equal(counted.counts.lowRiskControls, 15);
assert(counted.manualVerificationRequired.some((note) => note.includes('independently')));
assert(!JSON.stringify(counted).includes('synthetic-0'), 'no per-case identifiers in public summary');
assert(!JSON.stringify(counted).includes('labeler-0'), 'no labeler aliases in public summary');

const duplicate = structuredClone(sufficient);
duplicate.records[1].inputHash = duplicate.records[0].inputHash;
const duplicated = assessCalibrationPreflight(duplicate);
assert.equal(duplicated.status, 'blocked');
assert(duplicated.blockers.includes('duplicate-calibration-diffs'));
assert.equal(duplicated.counts.duplicateDiffGroups, 1);
assert.equal(duplicated.counts.duplicateDiffCases, 2);
assert(!JSON.stringify(duplicated).includes(duplicate.records[0].inputHash), 'no private hashes in preflight output');

const disputed = structuredClone(sufficient);
disputed.records[0].labels.adjudication.status = 'disputed';
const disputedResult = assessCalibrationPreflight(disputed);
assert(disputedResult.blockers.includes('unresolved-disputes'));
assert(disputedResult.blockers.includes('insufficient-high-severity-concerns'));
assert.equal(disputedResult.counts.unresolvedDisputes, 1);

const syntheticEvidence = structuredClone(sufficient);
syntheticEvidence.records[0].labels.concerns[0].provenance = 'synthetic-control';
const syntheticResult = assessCalibrationPreflight(syntheticEvidence);
assert.equal(syntheticResult.counts.syntheticProvenanceConcerns, 1);
assert(syntheticResult.blockers.includes('insufficient-supported-concerns'));
assert(syntheticResult.blockers.includes('insufficient-high-severity-concerns'));

const excluded = structuredClone(sufficient);
excluded.records[0].labels.labelers[1].decision = 'exclude';
const excludedResult = assessCalibrationPreflight(excluded);
assert(excludedResult.blockers.includes('cases-require-independent-adjudication'));
assert.equal(excludedResult.counts.excludedOrUnresolvedCases, 1);

const mixed = structuredClone(sufficient);
mixed.records[0].entry.partition = 'held-out';
assert(assessCalibrationPreflight(mixed).blockers.includes('non-calibration-records'));
assert(assessCalibrationPreflight({ records: [] }).blockers.includes('no-calibration-cases'));

const root = process.cwd();
const fixtureRoot = path.join(root, 'test', 'fixtures', 'historical-pr-evaluation');
const runCli = (corpusPath) => spawnSync(process.execPath, ['scripts/calibration-preflight.js', '--corpus', corpusPath], {
  cwd: root, encoding: 'utf8'
});
const mixedCli = runCli(fixtureRoot);
assert.equal(mixedCli.status, 2, mixedCli.stderr);
assert.deepEqual(JSON.parse(mixedCli.stdout).blockers, ['calibration-only-corpus-required']);

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-calibration-preflight-'));
try {
  const corpusPath = path.join(scratch, 'corpus');
  fs.cpSync(fixtureRoot, corpusPath, { recursive: true });
  const manifestPath = path.join(corpusPath, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.cases = manifest.cases.filter((entry) => entry.partition === 'calibration');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest) + '\n');
  const result = runCli(corpusPath);
  assert.equal(result.status, 2, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.assessment, 'calibration-preflight');
  assert.equal(output.status, 'blocked');
  assert(output.blockers.includes('insufficient-supported-concerns'));
  assert(!result.stdout.includes(corpusPath));
  assert(!result.stdout.includes('case-routing'), 'opaque per-case identifiers should not be emitted');
  const safeSample = JSON.stringify(output);
  assert(!safeSample.includes('src/router.js'));

  // A source error must not echo a private rationale, absolute filename or URL.
  const labelPath = path.join(corpusPath, manifest.cases[0].directory, 'labels.json');
  const label = JSON.parse(fs.readFileSync(labelPath, 'utf8'));
  label.concerns[0].rationale = 'https://private.example/secret';
  fs.writeFileSync(labelPath, JSON.stringify(label));
  const privateFailure = runCli(corpusPath);
  assert.equal(privateFailure.status, 2);
  assert.equal(JSON.parse(privateFailure.stdout).status, 'blocked');
  assert(!privateFailure.stdout.includes('private.example'));
  assert(!privateFailure.stdout.includes(corpusPath));
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

const cliHelp = spawnSync(process.execPath, ['scripts/calibration-preflight.js', '--help'], { cwd: root, encoding: 'utf8' });
assert.equal(cliHelp.status, 0);
assert.match(cliHelp.stdout, /calibration-only-local-directory/);
console.log('calibration preflight contracts passed');
console.log('scope=calibration-only; independent-evidence=manual; held-out-not-evaluated');
