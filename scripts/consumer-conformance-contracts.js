#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateConfig } from '../src/configDiagnostics.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = path.join(root, 'test', 'fixtures', 'consumer-conformance');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(fixtures, relativePath), 'utf8'));
const readText = (relativePath) => fs.readFileSync(path.join(fixtures, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(fixtures, relativePath));

assert(exists('README.md'), 'consumer fixture guide must exist');
assert(exists('standalone-node/package.json'), 'standalone Node fixture must exist');
assert.equal(validateConfig(readJson('standalone-node/merge-guard.config.json')).fatal.length, 0, 'standalone Node fixture config must be valid');

const workspace = readJson('npm-workspace/package.json');
assert.equal(workspace.private, true, 'workspace fixture must be private');
assert.deepEqual(workspace.workspaces, ['packages/*'], 'workspace fixture must use an explicit, deterministic layout');
assert(exists('npm-workspace/packages/app/package.json'), 'workspace fixture must include a member package');

assert(exists('python/pyproject.toml'), 'Python fixture must contain pyproject.toml');
assert(readText('python/pyproject.toml').includes('[project]'), 'Python fixture must contain basic project metadata');
assert(exists('mixed/package.json') && exists('mixed/pyproject.toml'), 'mixed fixture must expose both Node and Python markers');

const forkEvent = readJson('forked-pull-request/event.json');
assert.equal(forkEvent.pull_request.head.repo.fork, true, 'forked pull-request fixture must remain a fork');
assert.equal(forkEvent.pull_request.base.repo.fork, false, 'forked pull-request base must remain the trusted repository');
assert(exists('forked-pull-request/changes.diff'), 'forked pull-request fixture must contain a prebuilt diff');

const workflow = readText('restricted-permission-action/workflow.yml');
assert(workflow.includes('contents: read'), 'restricted-permission Action fixture must use read-only contents permission');
assert(!workflow.includes('pull-requests: write'), 'restricted-permission Action fixture must not request pull request write access');
assert(workflow.includes('comment: "false"'), 'restricted-permission Action fixture must disable comments');
assert(!/token|secret/i.test(workflow), 'restricted-permission Action fixture must remain secret-free');

console.log('consumer conformance fixtures passed');
