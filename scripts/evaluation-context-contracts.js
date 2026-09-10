#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  createEvaluationContext,
  EvaluationContextError,
  loadEvaluationContext,
  sha256,
  validateEvaluationContext
} from '../src/evaluationContext.js';

const baseSha = 'a'.repeat(40);
const headSha = 'b'.repeat(40);
const testedSha = 'c'.repeat(40);
const digest = sha256('trusted policy bytes\n');

const context = createEvaluationContext({
  schemaVersion: 1,
  baseSha,
  headSha,
  testedSha,
  inputType: 'git-range',
  starterPolicyRevision: baseSha,
  policySource: {
    path: 'config/merge-guard.policies.json',
    revision: baseSha,
    sha256: digest
  },
  policyChanges: ['config/merge-guard.policies.json', 'policies/starter/frontend.json']
});
assert.deepEqual(context, {
  schemaVersion: 1,
  baseSha,
  headSha,
  testedSha,
  inputType: 'git-range',
  starterPolicyRevision: baseSha,
  policySource: {
    path: 'config/merge-guard.policies.json',
    revision: baseSha,
    sha256: digest
  },
  policyChanges: ['config/merge-guard.policies.json', 'policies/starter/frontend.json']
});
assert.equal(validateEvaluationContext({ ...context, policySource: { ...context.policySource, revision: headSha } }).valid, false);
assert.equal(validateEvaluationContext({ ...context, testedSha: 'short' }).valid, false);
assert.equal(validateEvaluationContext({ ...context, policyChanges: ['../escape'] }).valid, false);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-evaluation-context-'));
try {
  const snapshot = path.join(temporaryRoot, 'policy.json');
  const output = path.join(temporaryRoot, 'context.json');
  fs.writeFileSync(snapshot, 'trusted policy bytes\n', 'utf8');
  const created = spawnSync(process.execPath, [
    'scripts/create-evaluation-context.js',
    '--output', output,
    '--base-sha', baseSha,
    '--head-sha', headSha,
    '--tested-sha', testedSha,
    '--input-type', 'prebuilt-diff',
    '--starter-policy-revision', baseSha,
    '--policy-source', 'config/merge-guard.policies.json',
    '--policy-snapshot', snapshot,
    '--policy-changed', 'config/merge-guard.policies.json',
    '--policy-changed', 'policies/starter/frontend.json'
  ], { encoding: 'utf8' });
  assert.equal(created.status, 0, created.stderr);
  const loaded = loadEvaluationContext(output, { cwd: temporaryRoot });
  assert.equal(loaded.inputType, 'prebuilt-diff');
  assert.equal(loaded.policySource.sha256, digest);
  assert.deepEqual(loaded.policyChanges, ['config/merge-guard.policies.json', 'policies/starter/frontend.json']);
  fs.writeFileSync(output, '{not json', 'utf8');
  assert.throws(
    () => loadEvaluationContext(output, { cwd: temporaryRoot }),
    (error) => error instanceof EvaluationContextError && error.message.includes('Unable to parse')
  );
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

const action = fs.readFileSync('action.yml', 'utf8');
for (const required of [
  'Prepare trusted policy baseline',
  'git cat-file -e',
  'git show "${MERGE_GUARD_BASE_SHA}:${MERGE_GUARD_POLICY_CONFIG}"',
  'git diff "$MERGE_GUARD_BASE_SHA...$MERGE_GUARD_TESTED_SHA"',
  'create-evaluation-context.js',
  '--evaluation-context',
  'git rev-parse HEAD'
]) {
  assert(action.includes(required), `Action must include trusted evaluation contract: ${required}`);
}

console.log('evaluation-context contracts passed');
console.log(`policyDigest=${digest}`);
