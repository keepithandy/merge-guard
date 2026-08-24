import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyCustomRules } from './customRules.js';
import { formatPolicyDiagnostics, validatePolicyPack } from './policyPacks.js';

export const STARTER_POLICY_IDS = Object.freeze([
  'frontend',
  'backend',
  'library',
  'browser-game',
  'infrastructure'
]);

function starterPolicyPath(id) {
  return fileURLToPath(new URL(`../policies/starter/${id}.json`, import.meta.url));
}

function readStarterPolicy(id) {
  if (!STARTER_POLICY_IDS.includes(id)) {
    throw new PolicyPackSelectionError(
      `Unknown starter policy "${id}". Available packs: ${STARTER_POLICY_IDS.join(', ')}.`
    );
  }

  try {
    return JSON.parse(fs.readFileSync(starterPolicyPath(id), 'utf8'));
  } catch (error) {
    throw new PolicyPackSelectionError(`Unable to read starter policy "${id}": ${error.message}`);
  }
}

export function loadStarterPolicyPack(id) {
  const normalizedId = typeof id === 'string' ? id.trim() : '';
  const result = validatePolicyPack(readStarterPolicy(normalizedId));
  if (!result.valid) {
    throw new PolicyPackSelectionError(
      `Starter policy "${normalizedId}" failed validation.\n${formatPolicyDiagnostics(result.fatal)}`,
      result.fatal
    );
  }
  return result.policy;
}

export function listStarterPolicyPacks() {
  return STARTER_POLICY_IDS.map((id) => {
    const policy = loadStarterPolicyPack(id);
    return {
      id,
      policyId: policy.identity.id,
      name: policy.identity.name,
      version: policy.identity.version,
      description: policy.identity.description
    };
  });
}

function uniq(values) {
  return [...new Set(values)];
}

function selectedPackRecord(policy) {
  return {
    schemaVersion: policy.schemaVersion,
    id: policy.identity.id,
    name: policy.identity.name,
    version: policy.identity.version,
    description: policy.identity.description
  };
}

export function applyPolicyPack(report, diffText, policy) {
  if (!policy?.identity?.id || !Array.isArray(policy.rules) || !Array.isArray(policy.requiredChecks)) {
    throw new PolicyPackSelectionError('applyPolicyPack requires a validated policy pack.');
  }

  const selected = selectedPackRecord(policy);
  const existingPacks = Array.isArray(report.policyPacks) ? report.policyPacks : [];
  if (existingPacks.some((pack) => pack.id === selected.id)) {
    throw new PolicyPackSelectionError(`Policy pack "${selected.id}" was selected more than once.`);
  }

  report.policyPacks = [...existingPacks, selected];
  report.config.policyPacks = [...(report.config.policyPacks || []), {
    id: selected.id,
    version: selected.version,
    schemaVersion: selected.schemaVersion
  }];

  applyCustomRules(report, diffText, policy.rules, {
    idPrefix: `policy:${selected.id}:`,
    custom: false,
    configField: null,
    warningsField: 'policyRuleWarnings',
    hitMetadata: {
      policy: true,
      policyPackId: selected.id,
      policyPackVersion: selected.version
    },
    reasonContext: `policy pack ${selected.id}@${selected.version}`
  });

  const requiredChecks = policy.requiredChecks.map((check) => ({
    ...check,
    policyPackId: selected.id,
    policyPackVersion: selected.version
  }));
  report.policyRequiredChecks = [
    ...(report.policyRequiredChecks || []),
    ...requiredChecks
  ];
  report.suggestedChecks = uniq([
    ...requiredChecks.map((check) =>
      `Policy check (${selected.id}): ${check.command} — ${check.reason}`
    ),
    ...(report.suggestedChecks || [])
  ]);

  return report;
}

export class PolicyPackSelectionError extends Error {
  constructor(message, diagnostics = []) {
    super(message);
    this.name = 'PolicyPackSelectionError';
    this.diagnostics = diagnostics;
  }
}
