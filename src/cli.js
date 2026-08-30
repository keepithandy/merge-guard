#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';
import { analyzeDiff, formatMarkdownReport, formatReport } from './analyzeDiff.js';
import { createAiReviewSummary } from './aiReview.js';
import { appendCustomRuleWarnings, applyCustomRules } from './customRules.js';
import { appendPrContext, appendPrContextToAiReview, applyPrContext, normalizePrContext } from './prContext.js';
import { applyRepositoryIntelligence, inspectRepository } from './repositoryIntelligence.js';
import { applySuppressions } from './suppressions.js';
import { ConfigurationError, formatDiagnostics, validateConfig } from './configDiagnostics.js';
import { applyPolicyPack, loadStarterPolicyPack } from './starterPolicies.js';
import { applyReviewGuidance, inspectReviewGuidance } from './reviewGuidance.js';
import {
  applyPolicyExceptions,
  applyResolvedPolicies,
  loadAndResolvePolicyManifest,
  PolicyManifestError
} from './policyResolution.js';
import { formatPullRequestSummary } from './pullRequestSummary.js';
import { createGithubAnnotationBundle, createSarifLog } from './githubReviewOutputs.js';
import { formatDoctor, inspectDoctor } from './doctor.js';
import { selectPrimaryChecks } from './projectChecks.js';

const KNOWN_OPTIONS = new Set([
  '--json',
  '--markdown',
  '--ci',
  '--ai',
  '--preset',
  '--fail-threshold',
  '--pr-title',
  '--pr-body',
  '--policy',
  '--policy-config',
  '--pr-summary',
  '--annotations',
  '--sarif',
  '--report-json',
  '--doctor',
  '--plugin-manifest',
  '--action-inputs',
  '--impact-metadata',
  '--help',
  '-h'
]);
const VALUE_OPTIONS = new Set([
  '--preset',
  '--fail-threshold',
  '--pr-title',
  '--pr-body',
  '--policy',
  '--policy-config',
  '--report-json',
  '--plugin-manifest',
  '--action-inputs',
  '--impact-metadata'
]);
const VALID_PRESETS = new Set(['safe', 'standard', 'strict']);

function printHelp() {
  console.log(`merge-guard

Usage:
  merge-guard <path-to-diff>
  git diff | merge-guard
  node src/cli.js examples/sample.diff

Options:
  --json                    Print the report as JSON
  --markdown                Print the report as Markdown
  --ci                      Print Markdown, write to GITHUB_STEP_SUMMARY when available, and fail on configured high risk
  --ai                      Add an optional AI-ready review summary to the report
  --preset <preset>         Use risk preset: safe, standard, or strict
  --fail-threshold <score>  Override the configured CI failure score with a positive integer
  --pr-title <text>         Include pull request title as report context
  --pr-body <path>          Include pull request body from a UTF-8 text or Markdown file
  --policy <starter-id>     Apply frontend, backend, library, browser-game, or infrastructure explicitly
  --policy-config <path>    Apply an explicit root/package policy manifest
  --pr-summary              Print a compact GitHub pull-request summary with expandable details
  --annotations             Print a versioned changed-line annotation bundle as JSON
  --sarif                   Print optional SARIF 2.1.0 output for eligible changed-line findings
  --report-json <path>      Also write the complete JSON report to a file
  --doctor                  Inspect the local runtime and setup without analyzing a diff
  --plugin-manifest <path>  Validate one explicit local plugin manifest in doctor mode
  --action-inputs <path>    Validate one JSON Action-input file in doctor mode
  --impact-metadata <path>  Load one explicit local impact-metadata JSON file
  --help                    Show this help message

Config:
  merge-guard reads merge-guard.config.json when it exists in the current directory.
  The optional customRules array adds project-specific path and added-line rules.
  Suggested checks are enriched from JavaScript/Python metadata, root checks, and README commands.
  Workspace ownership and potential shared impact are reported without dependency inference.
  Impact metadata is only read from an explicit local file; it never executes project code.
  Starter policies are never selected unless --policy is supplied.
  CODEOWNERS and protected-path matches are guidance only and never prove approval.

Diagnostics:
  merge-guard --doctor
  merge-guard --doctor --json --policy-config merge-guard.policy.json
  merge-guard --doctor --json --plugin-manifest plugin.json --action-inputs action-inputs.json
  merge-guard examples/sample.diff --impact-metadata .merge-guard/impact.json --json
`);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function loadConfig() {
  const configFile = 'merge-guard.config.json';

  if (!fs.existsSync(configFile)) {
    return {};
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch (error) {
    throw new ConfigurationError('invalid merge-guard.config.json', [{
      severity: 'fatal',
      path: '$',
      code: 'invalid-json',
      message: error.message,
      receivedType: 'invalid-json',
      expected: 'valid JSON object'
    }]);
  }

  const diagnostics = validateConfig(parsed);
  if (diagnostics.fatal.length) {
    throw new ConfigurationError('invalid merge-guard.config.json', diagnostics.fatal);
  }

  parsed.__configWarnings = diagnostics.warnings;
  return parsed;
}

function getOptionValue(args, optionName) {
  const optionIndex = args.indexOf(optionName);
  if (optionIndex === -1) return null;

  const value = args[optionIndex + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value`);
  }

  return value;
}

function findFileArg(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (VALUE_OPTIONS.has(arg)) {
      index += 1;
      continue;
    }

    if (!arg.startsWith('--')) {
      return arg;
    }
  }

  return null;
}

function validateOptions(args) {
  const unknown = args.filter((arg) => arg.startsWith('--') && !KNOWN_OPTIONS.has(arg));
  if (unknown.length) {
    throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  }
}

function runDoctor(args) {
  const allowed = new Set(['--doctor', '--json', '--policy-config', '--plugin-manifest', '--action-inputs']);
  const incompatible = args.filter((arg) => arg.startsWith('--') && !allowed.has(arg));
  if (incompatible.length) {
    throw new Error(`--doctor cannot be combined with: ${incompatible.join(', ')}`);
  }
  if (findFileArg(args)) {
    throw new Error('--doctor does not accept a diff file; run it from the repository you want to inspect.');
  }
  const result = inspectDoctor({
    policyConfigPath: getOptionValue(args, '--policy-config'),
    pluginManifestPath: getOptionValue(args, '--plugin-manifest'),
    actionInputsPath: getOptionValue(args, '--action-inputs')
  });
  console.log(args.includes('--json') ? JSON.stringify(result, null, 2) : formatDoctor(result));
  if (!result.healthy) process.exitCode = 1;
}

function resolveConfig(args) {
  const config = loadConfig();
  const preset = getOptionValue(args, '--preset');
  const failThreshold = getOptionValue(args, '--fail-threshold');

  if (preset) {
    const normalizedPreset = preset.trim().toLowerCase();
    if (!VALID_PRESETS.has(normalizedPreset)) {
      throw new Error(`invalid preset: ${preset}. Use safe, standard, or strict.`);
    }

    config.preset = normalizedPreset;
  }

  if (failThreshold) {
    const parsedThreshold = Number(failThreshold);
    if (!Number.isInteger(parsedThreshold) || parsedThreshold < 1) {
      throw new Error(`invalid fail threshold: ${failThreshold}. Use a positive integer.`);
    }

    config.failThreshold = parsedThreshold;
  }

  return config;
}

function resolvePrContext(args) {
  const title = getOptionValue(args, '--pr-title');
  const bodyPath = getOptionValue(args, '--pr-body');
  let body = null;

  if (bodyPath) {
    if (!fs.existsSync(bodyPath)) {
      throw new Error(`PR body file not found: ${bodyPath}`);
    }

    body = fs.readFileSync(bodyPath, 'utf8');
  }

  return normalizePrContext({ title, body });
}

function writeGitHubStepSummary(markdown) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  fs.appendFileSync(summaryFile, `${markdown}\n`, 'utf8');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  validateOptions(args);

  if (args.includes('--doctor')) {
    runDoctor(args);
    return;
  }

  const jsonMode = args.includes('--json');
  const markdownMode = args.includes('--markdown');
  const ciMode = args.includes('--ci');
  const aiMode = args.includes('--ai');
  const prSummaryMode = args.includes('--pr-summary');
  const annotationMode = args.includes('--annotations');
  const sarifMode = args.includes('--sarif');
  const reportJsonPath = getOptionValue(args, '--report-json');
  const selectedOutputModes = [jsonMode, markdownMode, prSummaryMode, annotationMode, sarifMode]
    .filter(Boolean).length;
  if (selectedOutputModes > 1) {
    throw new Error('--json, --markdown, --pr-summary, --annotations, and --sarif are mutually exclusive output modes.');
  }
  const policyId = getOptionValue(args, '--policy');
  const policyConfigPath = getOptionValue(args, '--policy-config');
  if (policyId && policyConfigPath) {
    throw new Error('--policy and --policy-config conflict; select one policy source.');
  }
  const fileArg = findFileArg(args);

  let diffText = '';

  if (fileArg) {
    if (!fs.existsSync(fileArg)) {
      console.error(`merge-guard error: file not found: ${fileArg}`);
      process.exitCode = 1;
      return;
    }

    diffText = fs.readFileSync(fileArg, 'utf8');
  } else if (!process.stdin.isTTY) {
    diffText = await readStdin();
  } else {
    printHelp();
    return;
  }

  if (!diffText.trim()) {
    console.error('merge-guard error: no diff content provided');
    process.exitCode = 1;
    return;
  }

  const config = resolveConfig(args);
  const prContext = resolvePrContext(args);
  const repositoryIntelligence = inspectRepository(
    diffText,
    process.cwd(),
    getOptionValue(args, '--impact-metadata')
  );
  let report = applyPrContext(
    applyRepositoryIntelligence(
      applySuppressions(
        applyCustomRules(analyzeDiff(diffText, config), diffText, config.customRules),
        config.suppressions
      ),
      repositoryIntelligence
    ),
    prContext
  );
  const selectedPolicies = [];
  let policyResolution = null;
  if (policyId) {
    const policy = loadStarterPolicyPack(policyId);
    selectedPolicies.push(policy);
    report = applyPolicyPack(report, diffText, policy);
  } else if (policyConfigPath) {
    policyResolution = loadAndResolvePolicyManifest(policyConfigPath, diffText);
    const applied = applyResolvedPolicies(report, diffText, policyResolution);
    report = applied.report;
    selectedPolicies.push(...applied.policyScopes);
  }
  report = applyReviewGuidance(
    report,
    inspectReviewGuidance(diffText, selectedPolicies)
  );
  if (policyResolution) {
    report = applyPolicyExceptions(report, policyResolution);
  }
  report.schemaVersion = 1;
  report.configDiagnostics = Array.isArray(config.__configWarnings) ? config.__configWarnings : [];
  report.primaryChecks = selectPrimaryChecks(report);

  if (aiMode) {
    report.aiReview = appendPrContextToAiReview(
      createAiReviewSummary(report, diffText),
      prContext
    );
  }

  if (reportJsonPath) {
    if (fs.existsSync(reportJsonPath) && fs.lstatSync(reportJsonPath).isSymbolicLink()) {
      throw new Error(`refusing to write JSON report through symbolic link: ${reportJsonPath}`);
    }
    fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  const markdown = appendCustomRuleWarnings(
    appendPrContext(formatMarkdownReport(report), prContext, 'markdown'),
    report.customRuleWarnings,
    'markdown'
  );
  const prSummary = formatPullRequestSummary(report);
  const annotationBundle = annotationMode || sarifMode
    ? createGithubAnnotationBundle(report, diffText)
    : null;

  if (ciMode) {
    writeGitHubStepSummary(prSummary);
  }

  if (annotationMode) {
    console.log(JSON.stringify(annotationBundle, null, 2));
  } else if (sarifMode) {
    console.log(JSON.stringify(createSarifLog(report, annotationBundle), null, 2));
  } else if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else if (prSummaryMode) {
    console.log(prSummary);
  } else if (markdownMode || ciMode) {
    console.log(markdown);
  } else {
    const text = appendPrContext(formatReport(report), prContext);
    console.log(appendCustomRuleWarnings(text, report.customRuleWarnings));
  }

  if (ciMode && report.riskScore >= report.config.failThreshold) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  if (error instanceof ConfigurationError) {
    const output = {
      error: error.message,
      code: 'INVALID_CONFIGURATION',
      diagnostics: error.diagnostics
    };

    if (process.argv.includes('--json')) {
      console.error(JSON.stringify(output, null, 2));
    } else {
      console.error(`merge-guard configuration error: ${error.message}`);
      console.error(formatDiagnostics(error.diagnostics));
    }
  } else if (error instanceof PolicyManifestError) {
    const output = {
      error: error.message,
      code: 'INVALID_POLICY_MANIFEST',
      diagnostics: error.diagnostics
    };
    if (process.argv.includes('--json')) {
      console.error(JSON.stringify(output, null, 2));
    } else {
      console.error(`merge-guard policy manifest error: ${error.message}`);
      console.error(formatDiagnostics(error.diagnostics));
    }
  } else {
    console.error('merge-guard error:', error.message);
  }

  process.exitCode = 1;
});
