import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateConfig } from './configDiagnostics.js';
import { validatePluginManifest } from './pluginManifest.js';
import { validatePolicyManifest } from './policyResolution.js';
import { MERGE_GUARD_VERSION } from './version.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ACTION_INPUTS = [
  'annotations',
  'comment',
  'comment-dry-run',
  'compare',
  'diff-path',
  'fail-threshold',
  'markdown',
  'policy',
  'policy-config',
  'previous-report',
  'preset',
  'sarif'
];
const BOOLEAN_ACTION_INPUTS = new Set(['annotations', 'comment', 'comment-dry-run', 'compare', 'markdown', 'sarif']);
const PRESETS = new Set(['safe', 'standard', 'strict']);
const STARTER_POLICIES = new Set(['frontend', 'backend', 'library', 'browser-game', 'infrastructure']);

function check(id, status, message, nextAction = null) {
  return { id, status, message, nextAction };
}

function readJson(file) {
  try {
    return { value: JSON.parse(fs.readFileSync(file, 'utf8')), error: null };
  } catch {
    return { value: null, error: 'invalid-json' };
  }
}

function semverMajor(version) {
  const match = /(?:^|>=\s*)v?(\d+)(?:\.|$)/.exec(version || '');
  return match ? Number(match[1]) : null;
}

function safePathLabel(file, cwd) {
  const relative = path.relative(cwd, path.resolve(cwd, file)).replaceAll('\\', '/');
  if (!relative || relative === '.') return 'current directory';
  return relative.startsWith('../') || path.isAbsolute(relative) ? 'an external file' : 'the selected file';
}

function isSafeRepositoryPath(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const normalized = value.replaceAll('\\', '/');
  return !normalized.startsWith('/')
    && !/^[a-z]:\//i.test(normalized)
    && !normalized.includes('..')
    && !/^[a-z][a-z+.-]*:/i.test(normalized);
}

function declaredActionInputs() {
  try {
    const action = fs.readFileSync(path.join(root, 'action.yml'), 'utf8');
    const block = /^inputs:\s*\r?\n([\s\S]*?)^outputs:/m.exec(action)?.[1];
    if (!block) return null;
    return [...block.matchAll(/^  ([a-z][a-z-]*):\s*$/gm)].map((match) => match[1]).sort();
  } catch {
    return null;
  }
}

function inspectRuntimeAndPackage() {
  const packageFile = path.join(root, 'package.json');
  const sbomFile = path.join(root, 'docs', 'security', 'sbom.json');
  const packageResult = readJson(packageFile);
  const sbomResult = readJson(sbomFile);
  const nodeMajor = semverMajor(process.version);
  const packageVersion = packageResult.value?.version;
  const packageName = packageResult.value?.name;
  const requiredNodeMajor = semverMajor(packageResult.value?.engines?.node);
  const runtimePass = Number.isInteger(nodeMajor) && Number.isInteger(requiredNodeMajor) && nodeMajor >= requiredNodeMajor;
  const packagePass = Boolean(
    packageName
    && packageVersion
    && packageVersion === MERGE_GUARD_VERSION
    && sbomResult.value?.metadata?.component?.name === packageName
    && sbomResult.value?.metadata?.component?.version === packageVersion
    && sbomResult.value?.components?.[0]?.purl === `pkg:npm/${packageName}@${packageVersion}`
  );

  return [
    runtimePass
      ? check('runtime', 'pass', `Node ${process.version} satisfies the package runtime requirement.`)
      : check('runtime', 'error', 'The current Node runtime does not satisfy the package runtime requirement.', 'Use a supported Node.js release before running Merge Guard.'),
    packagePass
      ? check('package-identity', 'pass', `Runtime, package, and SBOM identify ${packageName}@${packageVersion}.`)
      : check('package-identity', 'error', 'Runtime, package, and SBOM identity are inconsistent or unreadable.', 'Install a complete, matching Merge Guard package and rerun the version contract.'),
  ];
}

function inspectConfiguration(cwd) {
  const file = path.join(cwd, 'merge-guard.config.json');
  if (!fs.existsSync(file)) {
    return check('configuration', 'not-configured', 'No merge-guard.config.json was found in the current directory.', 'Add a configuration file only when project-specific settings are needed.');
  }
  const parsed = readJson(file);
  if (parsed.error) {
    return check('configuration', 'error', 'The configuration file is not valid JSON.', 'Fix merge-guard.config.json and rerun doctor.');
  }
  const diagnostics = validateConfig(parsed.value);
  const issue = diagnostics.fatal[0] || diagnostics.warnings[0];
  if (diagnostics.fatal.length) {
    return check('configuration', 'error', `Configuration violates ${issue.path} (${issue.code}).`, 'Fix the named configuration field according to the configuration diagnostics guide.');
  }
  if (diagnostics.warnings.length) {
    return check('configuration', 'warning', `Configuration is usable with ${diagnostics.warnings.length} advisory diagnostic(s).`, 'Review the named configuration diagnostics before relying on custom rules.');
  }
  return check('configuration', 'pass', 'Configuration is valid.');
}

function inspectPolicyManifest(cwd, policyConfigPath) {
  if (!policyConfigPath) {
    return check('policy-manifest', 'not-configured', 'No policy manifest was selected.', 'Pass --policy-config <file> to validate an explicit policy manifest.');
  }
  const file = path.resolve(cwd, policyConfigPath);
  const label = safePathLabel(policyConfigPath, cwd);
  if (!fs.existsSync(file)) {
    return check('policy-manifest', 'error', `The selected policy manifest (${label}) does not exist.`, 'Provide a readable policy manifest path.');
  }
  const parsed = readJson(file);
  if (parsed.error) {
    return check('policy-manifest', 'error', `The selected policy manifest (${label}) is not valid JSON.`, 'Fix the policy manifest JSON and rerun doctor.');
  }
  const result = validatePolicyManifest(parsed.value);
  if (!result.valid) {
    const issue = result.fatal[0];
    return check('policy-manifest', 'error', `Policy manifest violates ${issue.path} (${issue.code}).`, 'Fix the named policy-manifest contract and rerun doctor.');
  }
  if (result.warnings.length) {
    return check('policy-manifest', 'warning', `Policy manifest is valid with ${result.warnings.length} advisory diagnostic(s).`, 'Review policy-manifest warnings before adoption.');
  }
  return check('policy-manifest', 'pass', 'Selected policy manifest is valid and compatible.');
}

function inspectPluginManifest(cwd, pluginManifestPath) {
  if (!pluginManifestPath) {
    return check('plugin-manifest', 'not-configured', 'No plugin manifest was selected.', 'Pass --plugin-manifest <file> to validate an explicit plugin manifest.');
  }
  const file = path.resolve(cwd, pluginManifestPath);
  const label = safePathLabel(pluginManifestPath, cwd);
  if (!fs.existsSync(file)) {
    return check('plugin-manifest', 'error', `The selected plugin manifest (${label}) does not exist.`, 'Provide a readable plugin manifest path.');
  }
  const parsed = readJson(file);
  if (parsed.error) {
    return check('plugin-manifest', 'error', `The selected plugin manifest (${label}) is not valid JSON.`, 'Fix the plugin manifest JSON and rerun doctor.');
  }
  const result = validatePluginManifest(parsed.value);
  if (!result.valid) {
    const issue = result.diagnostics[0];
    return check('plugin-manifest', 'error', `Plugin manifest violates ${issue.path} (${issue.code}).`, 'Fix the named plugin-manifest contract and rerun doctor.');
  }
  return check('plugin-manifest', 'pass', 'Selected plugin manifest is valid and compatible.');
}

function inspectRepositoryContext(cwd) {
  const markers = {
    git: fs.existsSync(path.join(cwd, '.git')),
    node: fs.existsSync(path.join(cwd, 'package.json')),
    python: fs.existsSync(path.join(cwd, 'pyproject.toml')) || fs.existsSync(path.join(cwd, 'setup.cfg'))
  };
  const kinds = [markers.node && 'Node', markers.python && 'Python', markers.git && 'Git'].filter(Boolean);
  if (!kinds.length) {
    return check('repository-context', 'warning', 'No Git, Node, or Python repository marker was found in the current directory.', 'Run doctor from a supported repository root; this command does not search parent directories.');
  }
  return check('repository-context', 'pass', `Detected ${kinds.join(', ')} repository context without executing project code.`);
}

function inspectActionContract() {
  const declared = declaredActionInputs();
  const expected = [...ACTION_INPUTS].sort();
  if (!declared || declared.length !== expected.length || declared.some((name, index) => name !== expected[index])) {
    return check('action-contract', 'error', 'The bundled composite Action input contract is unreadable or inconsistent.', 'Restore the documented Action inputs before distributing the package.');
  }
  return check('action-contract', 'pass', 'Bundled composite Action input contract is present.');
}

function inspectActionInputs(cwd, actionInputsPath) {
  if (!actionInputsPath) {
    return check('action-inputs', 'not-configured', 'No Action input file was selected.', 'Pass --action-inputs <json-file> to validate a caller Action configuration locally.');
  }
  const file = path.resolve(cwd, actionInputsPath);
  const label = safePathLabel(actionInputsPath, cwd);
  if (!fs.existsSync(file)) {
    return check('action-inputs', 'error', `The selected Action input file (${label}) does not exist.`, 'Provide a readable JSON object containing Action input values.');
  }
  const parsed = readJson(file);
  if (parsed.error || !parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
    return check('action-inputs', 'error', 'Action inputs must be a valid JSON object.', 'Create a JSON object with only documented composite Action inputs.');
  }
  const inputs = parsed.value;
  const unknown = Object.keys(inputs).filter((name) => !ACTION_INPUTS.includes(name));
  if (unknown.length) {
    return check('action-inputs', 'error', 'Action inputs contain unsupported input names.', 'Remove unsupported Action inputs; do not place tokens or secrets in an input fixture.');
  }
  for (const [name, value] of Object.entries(inputs)) {
    if (typeof value !== 'string') {
      return check('action-inputs', 'error', `Action input ${name} must be represented as a string.`, 'Use GitHub Actions input strings such as "true", "false", or a documented value.');
    }
  }
  for (const name of BOOLEAN_ACTION_INPUTS) {
    if (inputs[name] !== undefined && !['true', 'false', ''].includes(inputs[name])) {
      return check('action-inputs', 'error', `Action input ${name} must be "true" or "false".`, 'Use the documented boolean Action input value.');
    }
  }
  if (inputs.preset && !PRESETS.has(inputs.preset)) {
    return check('action-inputs', 'error', 'Action preset is not supported.', 'Use safe, standard, or strict.');
  }
  if (inputs['fail-threshold'] && (!/^\d+$/.test(inputs['fail-threshold']) || Number(inputs['fail-threshold']) < 1)) {
    return check('action-inputs', 'error', 'Action fail-threshold must be a positive integer.', 'Use a positive integer or leave fail-threshold empty.');
  }
  if (inputs.policy && !STARTER_POLICIES.has(inputs.policy)) {
    return check('action-inputs', 'error', 'Action policy is not a supported starter policy.', 'Use a documented starter policy or leave policy empty.');
  }
  if (inputs.policy && inputs['policy-config']) {
    return check('action-inputs', 'error', 'Action policy and policy-config cannot be selected together.', 'Select one policy source.');
  }
  for (const name of ['policy-config', 'previous-report', 'diff-path']) {
    if (inputs[name] && !isSafeRepositoryPath(inputs[name])) {
      return check('action-inputs', 'error', `Action input ${name} must be a repository-relative path.`, 'Use a relative path without URLs or parent-directory traversal.');
    }
  }
  if (inputs.comment === 'true') {
    return check('action-inputs', 'warning', 'Action inputs request a pull-request comment.', 'Grant pull-requests: write only for the intended workflow, or set comment to "false".');
  }
  if (inputs.compare === 'true' && !inputs['previous-report']) {
    return check('action-inputs', 'warning', 'Finding comparison is enabled without an explicit prior report.', 'Supply previous-report or expect an explicit history-unavailable result.');
  }
  return check('action-inputs', 'pass', 'Selected Action inputs are valid and contain no unsupported input names.');
}

export function inspectDoctor({ cwd = process.cwd(), policyConfigPath = null, pluginManifestPath = null, actionInputsPath = null } = {}) {
  const checks = [
    ...inspectRuntimeAndPackage(),
    inspectConfiguration(cwd),
    inspectPolicyManifest(cwd, policyConfigPath),
    inspectPluginManifest(cwd, pluginManifestPath),
    inspectRepositoryContext(cwd),
    inspectActionContract(),
    inspectActionInputs(cwd, actionInputsPath)
  ];
  return {
    schemaVersion: 1,
    tool: 'merge-guard',
    version: MERGE_GUARD_VERSION,
    command: 'doctor',
    healthy: !checks.some((entry) => entry.status === 'error'),
    checks
  };
}

export function formatDoctor(result) {
  const passed = result.checks.filter((entry) => entry.status === 'pass').length;
  const advisory = result.checks.filter((entry) => ['warning', 'not-configured'].includes(entry.status)).length;
  const lines = [
    'Merge Guard doctor',
    '',
    `Result: ${result.healthy ? 'HEALTHY' : 'ACTION REQUIRED'}`,
    `Checks: ${passed}/${result.checks.length} passing${advisory ? `, ${advisory} advisory` : ''}`,
    ''
  ];
  for (const entry of result.checks) {
    lines.push(`[${entry.status.toUpperCase()}] ${entry.id} — ${entry.message}`);
    if (entry.nextAction) lines.push(`  Next: ${entry.nextAction}`);
  }
  return lines.join('\n');
}
