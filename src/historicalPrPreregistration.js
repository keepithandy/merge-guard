import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, sha256 } from './artifactManifest.js';
import {
  HistoricalPrEvaluationError,
  SUPPORTED_RULE_FAMILIES
} from './historicalPrEvaluation.js';
import { MERGE_GUARD_VERSION } from './version.js';

export const PILOT_PREREGISTRATION_SCHEMA_VERSION = 1;
export const PILOT_THRESHOLDS = Object.freeze({
  minimumHeldOutCases: 50,
  minimumRepositoryAliases: 5,
  minimumSupportedConcerns: 15,
  minimumLowRiskControls: 15,
  actionablePrecisionMinimum: 0.7,
  criticalSupportedScopeRecallMinimum: 0.8,
  criticalSupportedScopeRecallMinimumDenominator: 5,
  medianUnmatchedFindingsMaximum: 1,
  cleanPrSpecificityMinimum: 0.7,
  medianSetupMinutesMaximum: 5,
  runtimeP95MillisecondsMaximum: 3000
});

const HASH = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const diagnostic = (pathValue, code, message) => ({ path: pathValue, code, message });

function sourceImplementationHash() {
  const sourceRoot = path.dirname(fileURLToPath(import.meta.url));
  const files = [
    'analyzeDiff.js',
    'artifactManifest.js',
    'findingComparison.js',
    'historicalPrEvaluation.js',
    'historicalPrPreregistration.js',
    'version.js'
  ];
  const contents = files.map((file) => ({
    file,
    content: fs.readFileSync(path.join(sourceRoot, file), 'utf8')
  }));
  return sha256(contents);
}

function heldOutRecords(corpus) {
  return (Array.isArray(corpus?.records) ? corpus.records : [])
    .filter((record) => record?.entry?.partition === 'held-out');
}

function supportedConcernCount(records) {
  return records.reduce((total, record) => total + (record.labels?.concerns || [])
    .filter((concern) => (concern.ruleFamilies || []).some((family) => SUPPORTED_RULE_FAMILIES.has(family))).length, 0);
}

export function pilotCorpusContentHash(corpus) {
  const cases = (Array.isArray(corpus?.records) ? corpus.records : [])
    .map((record) => ({
      id: record.entry.id,
      repositoryAlias: record.entry.repositoryAlias,
      partition: record.entry.partition,
      descriptor: record.entry,
      inputHash: record.inputHash,
      labelsHash: sha256(record.labels),
      configurationHash: sha256(record.config || {})
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return sha256({ manifestHash: corpus?.manifestHash, cases });
}

export function pilotCorpusProfile(corpus) {
  const records = heldOutRecords(corpus);
  return {
    id: corpus?.manifest?.corpusId || null,
    manifestHash: corpus?.manifestHash || null,
    contentHash: pilotCorpusContentHash(corpus),
    heldOutCaseCount: records.length,
    repositoryAliasCount: new Set(records.map((record) => record.entry.repositoryAlias)).size,
    supportedConcernCount: supportedConcernCount(records),
    lowRiskControlCount: records.filter((record) => record.labels?.lowRisk === true).length,
    independentlyLabeledCaseCount: records.filter((record) =>
      Array.isArray(record.labels?.labelers)
      && record.labels.labelers.length === 2
      && new Set(record.labels.labelers.map((labeler) => labeler.alias)).size === 2
    ).length
  };
}

function prerequisiteDiagnostics(profile) {
  const diagnostics = [];
  const checks = [
    ['heldOutCaseCount', PILOT_THRESHOLDS.minimumHeldOutCases, 'held-out-cases'],
    ['repositoryAliasCount', PILOT_THRESHOLDS.minimumRepositoryAliases, 'repository-aliases'],
    ['supportedConcernCount', PILOT_THRESHOLDS.minimumSupportedConcerns, 'supported-concerns'],
    ['lowRiskControlCount', PILOT_THRESHOLDS.minimumLowRiskControls, 'low-risk-controls']
  ];
  for (const [field, minimum, code] of checks) {
    if (profile[field] < minimum) diagnostics.push(diagnostic(`$.corpus.${field}`, `insufficient-${code}`, `${field} must be at least ${minimum}; received ${profile[field]}`));
  }
  if (profile.independentlyLabeledCaseCount !== profile.heldOutCaseCount) {
    diagnostics.push(diagnostic('$.corpus.independentlyLabeledCaseCount', 'incomplete-independent-labeling', 'every held-out case must retain two distinct label decisions'));
  }
  return diagnostics;
}

function identityPayload(record) {
  const { preregistrationId, ...payload } = record;
  return payload;
}

function validTimestamp(value) {
  return typeof value === 'string' && value.endsWith('Z') && !Number.isNaN(Date.parse(value));
}

export function createPilotPreregistration(corpus, { productCommit, recordedAt }) {
  const profile = pilotCorpusProfile(corpus);
  const diagnostics = prerequisiteDiagnostics(profile);
  if (!COMMIT.test(productCommit || '')) diagnostics.push(diagnostic('$.product.commit', 'invalid-product-commit', 'product commit must be a full 40-character lowercase Git commit SHA'));
  if (!validTimestamp(recordedAt)) diagnostics.push(diagnostic('$.recordedAt', 'invalid-recorded-at', 'recordedAt must be an explicit UTC ISO timestamp'));
  if (diagnostics.length) throw new HistoricalPrEvaluationError('pilot corpus is not ready for preregistration', diagnostics);

  const draft = {
    schemaVersion: PILOT_PREREGISTRATION_SCHEMA_VERSION,
    recordedAt,
    tool: 'merge-guard',
    product: { commit: productCommit, version: MERGE_GUARD_VERSION },
    metricImplementationHash: sourceImplementationHash(),
    corpus: profile,
    thresholds: { ...PILOT_THRESHOLDS },
    semantics: 'This content-free record freezes caller-asserted product identity, metric source, corpus content, and thresholds before held-out evaluation.'
  };
  return { ...draft, preregistrationId: sha256(draft) };
}

export function validatePilotPreregistration(record, corpus, { productCommit }) {
  const diagnostics = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { valid: false, diagnostics: [diagnostic('$', 'invalid-preregistration', 'preregistration must be an object')] };
  if (record.schemaVersion !== PILOT_PREREGISTRATION_SCHEMA_VERSION) diagnostics.push(diagnostic('$.schemaVersion', 'unsupported-schema', 'only preregistration schema version 1 is supported'));
  if (!HASH.test(record.preregistrationId || '')) diagnostics.push(diagnostic('$.preregistrationId', 'invalid-preregistration-id', 'preregistrationId must be a SHA-256 digest'));
  if (!validTimestamp(record.recordedAt)) diagnostics.push(diagnostic('$.recordedAt', 'invalid-recorded-at', 'recordedAt must be a UTC ISO timestamp'));
  if (record.tool !== 'merge-guard') diagnostics.push(diagnostic('$.tool', 'invalid-tool', 'tool must be merge-guard'));
  if (record.product?.version !== MERGE_GUARD_VERSION) diagnostics.push(diagnostic('$.product.version', 'product-version-mismatch', 'preregistered product version does not match this runtime'));
  if (!COMMIT.test(productCommit || '') || record.product?.commit !== productCommit) diagnostics.push(diagnostic('$.product.commit', 'product-commit-mismatch', 'supplied product commit must match the preregistered commit'));
  if (record.metricImplementationHash !== sourceImplementationHash()) diagnostics.push(diagnostic('$.metricImplementationHash', 'metric-implementation-mismatch', 'metric implementation changed after preregistration'));
  const profile = pilotCorpusProfile(corpus);
  diagnostics.push(...prerequisiteDiagnostics(profile));
  if (canonicalJson(record.corpus) !== canonicalJson(profile)) diagnostics.push(diagnostic('$.corpus', 'corpus-mismatch', 'corpus content or prerequisite counts changed after preregistration'));
  if (canonicalJson(record.thresholds) !== canonicalJson(PILOT_THRESHOLDS)) diagnostics.push(diagnostic('$.thresholds', 'threshold-mismatch', 'pilot thresholds changed after preregistration'));
  if (sha256(identityPayload(record)) !== record.preregistrationId) diagnostics.push(diagnostic('$.preregistrationId', 'identity-mismatch', 'preregistrationId does not match record content'));
  return { valid: diagnostics.length === 0, diagnostics };
}
