import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { analyzeDiff } from '../src/analyzeDiff.js';
import { parseDiffFileChanges, parseGitDiffHeaderPath } from '../src/affectedPackages.js';
import { applyCustomRules } from '../src/customRules.js';

const quotedPath = 'src/feature handler.js';
const quotedDiff = [
  'diff --git "a/src/feature handler.js" "b/src/feature handler.js"',
  'index 1111111..2222222 100644',
  '--- "a/src/feature handler.js"',
  '+++ "b/src/feature handler.js"',
  '@@ -1 +1 @@',
  '-export const load = () => 0;',
  '+export const load = () => fetch("/api/state");',
  ''
].join('\n');

assert.equal(
  parseGitDiffHeaderPath('diff --git "a/src/feature handler.js" "b/src/feature handler.js"'),
  quotedPath
);
assert.equal(parseGitDiffHeaderPath('diff --git a/src/index.js b/src/index.js'), 'src/index.js');
assert.equal(parseGitDiffHeaderPath('diff --git a/src/foo.js b/../outside.js'), null);
assert.equal(parseGitDiffHeaderPath('diff --git a/one b/two extra'), null);
assert.equal(parseGitDiffHeaderPath('not a diff'), null);

const quotedImpact = parseDiffFileChanges(quotedDiff);
assert.deepEqual(quotedImpact.map((change) => change.path), [quotedPath]);
const quoted = analyzeDiff(quotedDiff);
assert.equal(quoted.summary.changedFiles, 1, 'quoted Git paths must not disappear from the report');
assert.deepEqual(quoted.summary.files, [quotedPath]);
assert.equal(quoted.summary.addedLines, 1);
assert.equal(quoted.summary.removedLines, 1);
assert(quoted.files.some((file) => file.path === quotedPath));
assert(
  quoted.rules.some((rule) => rule.id === 'async-or-network' && rule.matchedLineCount === 1),
  'quoted path with a real fetch call must keep the corresponding detection'
);
assert(quoted.rules.some((rule) => rule.id === 'implementation-without-tests'));

const customRule = {
  id: 'specific-feature',
  label: 'Feature fetch review',
  weight: 3,
  pathPattern: '^src/feature handler\\.js$',
  linePattern: 'fetch\\(',
  check: 'Verify API error handling.'
};
const customReport = applyCustomRules(analyzeDiff(quotedDiff), quotedDiff, [customRule]);
assert.deepEqual(customReport.customRuleWarnings, []);
const customHit = customReport.rules.find((rule) => rule.id === 'custom:specific-feature');
assert(customHit, 'custom line+path rule must match the same quoted file');
assert.deepEqual(customHit.matchedFiles, [quotedPath]);
assert.equal(customHit.matchedLineCount, 1);
assert.equal(customReport.summary.changedFiles, 1);

const benignDiff = [
  'diff --git "a/src/feature handler.js" "b/src/feature handler.js"',
  '--- "a/src/feature handler.js"',
  '+++ "b/src/feature handler.js"',
  '@@ -1 +1 @@',
  '-export const feature = 1;',
  '+export const feature = 2;',
  ''
].join('\n');
const benign = applyCustomRules(analyzeDiff(benignDiff), benignDiff, [customRule]);
assert(!benign.rules.some((rule) => rule.id === 'custom:specific-feature'),
  'a matching filename with no matching line must not fabricate a custom hit');
assert(!benign.rules.some((rule) => rule.id === 'async-or-network'),
  'benign added code must not fabricate an async finding');

const docsDiff = [
  'diff --git "a/docs/getting started.md" "b/docs/getting started.md"',
  '--- "a/docs/getting started.md"',
  '+++ "b/docs/getting started.md"',
  '@@ -1 +1 @@',
  '-Old instructions',
  '+Use fetch() in your example',
  ''
].join('\n');
const docs = applyCustomRules(analyzeDiff(docsDiff), docsDiff, [customRule]);
assert.equal(docs.docsOnly, true);
assert.equal(docs.summary.changedFiles, 1);
assert.deepEqual(docs.summary.files, ['docs/getting started.md']);
assert(!docs.rules.some((rule) => rule.id === 'async-or-network'));
assert(!docs.rules.some((rule) => rule.id === 'custom:specific-feature'));

const escapedDiff = [
  'diff --git "a/src/name\\040with\\040spaces.js" "b/src/name\\040with\\040spaces.js"',
  '--- "a/src/name\\040with\\040spaces.js"',
  '+++ "b/src/name\\040with\\040spaces.js"',
  '@@ -0,0 +1 @@',
  '+const value = 1;',
  ''
].join('\n');
assert.deepEqual(analyzeDiff(escapedDiff).summary.files, ['src/name with spaces.js']);
assert.deepEqual(parseDiffFileChanges(escapedDiff).map((change) => change.path), ['src/name with spaces.js']);

const unquotedDiff = [
  'diff --git a/src/index.js b/src/index.js',
  '--- a/src/index.js',
  '+++ b/src/index.js',
  '@@ -0,0 +1 @@',
  '+export const main = 1;',
  ''
].join('\n');
assert.deepEqual(analyzeDiff(unquotedDiff).summary.files, ['src/index.js']);
assert.equal(analyzeDiff(unquotedDiff).summary.addedLines, 1);

const cli = spawnSync(process.execPath, ['src/cli.js', '--json'], {
  input: quotedDiff,
  encoding: 'utf8'
});
assert.equal(cli.status, 0, cli.stderr || 'quoted diff must work through CLI stdin');
const cliReport = JSON.parse(cli.stdout);
assert.equal(cliReport.schemaVersion, 1);
assert.deepEqual(cliReport.summary.files, [quotedPath]);
assert(cliReport.rules.some((rule) => rule.id === 'async-or-network'));

console.log('Free quoted Git diff path contracts passed');
