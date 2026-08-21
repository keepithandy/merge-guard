import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const root = process.cwd();
const cliPath = path.join(root, 'src', 'cli.js');
const sampleDiffPath = path.join(root, 'examples', 'sample.diff');
const docsOnlyDiffPath = path.join(root, 'examples', 'docs-only.diff');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runCli(args, input = '') {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: root,
    encoding: 'utf8',
    input
  });

  assert(result.error === undefined, `CLI process should start: ${result.error?.message || 'unknown error'}`);
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function parseJson(result, label) {
  assert(result.status === 0, `${label} should exit successfully: ${result.stderr}`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${label} should print valid JSON: ${error.message}`);
  }
}

const help = runCli(['--help']);
assert(help.status === 0, '--help should exit successfully');
assert(help.stdout.includes('Usage:'), '--help should print usage');
assert(help.stdout.includes('--preset <preset>'), '--help should document preset values');
assert(help.stdout.includes('--pr-body <path>'), '--help should document PR body input');

const unknownOption = runCli(['--unknown-option', sampleDiffPath]);
assert(unknownOption.status === 1, 'unknown options should fail');
assert(unknownOption.stderr.includes('unknown option(s): --unknown-option'), 'unknown option error should name the option');

const missingValue = runCli(['--preset', sampleDiffPath]);
assert(missingValue.status === 1, 'value options without a value should fail');
assert(missingValue.stderr.includes('--preset requires a value'), 'missing value error should name the option');

const invalidPreset = runCli(['--preset', 'aggressive', sampleDiffPath]);
assert(invalidPreset.status === 1, 'invalid presets should fail');
assert(invalidPreset.stderr.includes('invalid preset: aggressive'), 'invalid preset error should explain valid values');

const invalidThreshold = runCli(['--fail-threshold', '0', sampleDiffPath]);
assert(invalidThreshold.status === 1, 'non-positive thresholds should fail');
assert(invalidThreshold.stderr.includes('invalid fail threshold: 0'), 'invalid threshold error should name the value');

const configured = parseJson(
  runCli([
    '--json',
    '--preset',
    'strict',
    '--fail-threshold',
    '8',
    sampleDiffPath
  ]),
  'combined config options'
);
assert(configured.config.preset === 'strict', 'preset value should be consumed before the file argument');
assert(configured.config.failThreshold === 8, 'fail threshold value should be consumed before the file argument');

const bodyPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-cli-')), 'pr-body.md');
try {
  fs.writeFileSync(bodyPath, 'Preserves the existing save format.\\n\\nAdds focused smoke coverage.', 'utf8');

  const contextual = parseJson(
    runCli([
      '--json',
      '--pr-title',
      'Harden save migration boundaries',
      '--pr-body',
      bodyPath,
      sampleDiffPath
    ]),
    'PR context options'
  );
  assert(contextual.prContext?.title === 'Harden save migration boundaries', 'PR title should reach the report');
  assert(contextual.prContext?.body.includes('Preserves the existing save format.'), 'PR body should reach the report');
} finally {
  fs.rmSync(path.dirname(bodyPath), { recursive: true, force: true });
}

const stdinReport = parseJson(
  runCli(['--json'], fs.readFileSync(docsOnlyDiffPath, 'utf8')),
  'stdin mode'
);
assert(stdinReport.docsOnly === true, 'stdin input should be analyzed as a diff');
assert(stdinReport.summary.changedFiles === 1, 'stdin mode should preserve changed-file counts');

const missingFile = runCli(['does-not-exist.diff']);
assert(missingFile.status === 1, 'missing diff files should fail');
assert(missingFile.stderr.includes('file not found: does-not-exist.diff'), 'missing file error should name the path');

const ciFailure = runCli(['--ci', '--fail-threshold', '1', sampleDiffPath]);
assert(ciFailure.status === 1, 'CI mode should fail when the configured score is reached');
assert(ciFailure.stdout.includes('# merge-guard report'), 'CI mode should emit the Markdown report');

console.log('CLI argument smoke passed');
