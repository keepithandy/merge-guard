import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function run(args, input = '') {
  return spawnSync(process.execPath, ['src/cli.js', ...args], {
    input,
    encoding: 'utf8'
  });
}

assert.equal(run(['--help']).status, 0, 'help should succeed');
assert.equal(run(['--preset', 'strict', 'examples/sample.diff']).status, 0, 'value options should consume their value');
assert.equal(run(['--json', 'examples/sample.diff']).status, 0, 'JSON mode should succeed');
assert.equal(run(['--fail-threshold', '5', 'examples/sample.diff']).status, 0, 'threshold value should be consumed');
assert.equal(run(['--unknown']).status, 1, 'unknown options should fail');
assert.equal(run(['--preset']).status, 1, 'missing preset value should fail');
assert.equal(run(['--fail-threshold']).status, 1, 'missing threshold value should fail');
assert.equal(run(['--pr-title', 'Context', '--pr-body', 'missing.md', 'examples/sample.diff']).status, 1, 'missing PR body file should fail');
assert.equal(run([], 'diff --git a/src/example.js b/src/example.js\n+const value = 1;\n').status, 0, 'stdin diff mode should succeed');
console.log('merge-guard CLI contract tests passed');
