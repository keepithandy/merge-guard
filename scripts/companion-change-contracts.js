#!/usr/bin/env node
import assert from 'node:assert/strict';
import { evaluateCompanionChanges } from '../src/companionChanges.js';

const contracts = [
  { id: 'save-migration', trigger: '(^|/)src/save/', companions: ['(^|/)migrations?/', '(^|/)test/'] },
  { id: 'client-change', trigger: '(^|/)src/client/', companions: ['(^|/)test/'] }
];
const diff = [
  'diff --git a/src/save/load.js b/src/save/load.js',
  'diff --git a/migrations/001-save.sql b/migrations/001-save.sql',
  'diff --git a/test/save.test.js b/test/save.test.js',
  'diff --git a/src/client/api.js b/src/client/api.js'
].join('\n');
const result = evaluateCompanionChanges(diff, contracts);
assert.deepEqual(result[0], { id: 'save-migration', status: 'satisfied', triggeredBy: ['src/save/load.js'], missing: [] });
assert.deepEqual(result[1], { id: 'client-change', status: 'satisfied', triggeredBy: ['src/client/api.js'], missing: [] });
assert.equal(evaluateCompanionChanges('diff --git a/src/client/api.js b/src/client/api.js', contracts)[0].status, 'missing');
assert.deepEqual(evaluateCompanionChanges(diff, [{ id: 'bad', trigger: '[', companions: ['test'] }]), []);
console.log('companion-change contracts passed');
