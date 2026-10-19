// Evaluation-only calibration preflight. Never imports or runs the scanner.
import { SUPPORTED_RULE_FAMILIES } from './historicalPrEvaluation.js';

export const CALIBRATION_PREFLIGHT_MINIMUMS = Object.freeze({
  supportedConcerns: 15,
  lowRiskControls: 15,
  highSeveritySupportedConcerns: 5
});

const REQUIRED_MANUAL_REVIEWS = Object.freeze([
  'Confirm each of two label decisions was made independently before adjudication.',
  'Verify every included case has permitted, outcome-grounded provenance; a declared label is not proof.',
  'Verify original PR ancestry and source identities do not overlap any held-out corpus.',
  'Record excluded, disputed, duplicate, and unsupported cases in the private intake ledger.',
  'Freeze calibration membership and identity before the official Phase 1 validation run.'
]);

function includedByBoth(record) {
  const decisions = record.labels?.labelers;
  return Array.isArray(decisions) && decisions.length === 2
    && new Set(decisions.map((labeler) => labeler?.alias)).size === 2
    && decisions.every((labeler) => labeler?.decision === 'include');
}

function permitted(record) {
  return includedByBoth(record)
    && ['agreed', 'resolved'].includes(record.labels?.adjudication?.status);
}

function supported(concern) {
  return Array.isArray(concern?.ruleFamilies)
    && concern.ruleFamilies.some((family) => SUPPORTED_RULE_FAMILIES.has(family));
}

function duplicateDiffCounts(records) {
  const occurrences = new Map();
  for (const record of records) {
    if (typeof record.inputHash !== 'string' || !/^[a-f0-9]{64}$/.test(record.inputHash)) continue;
    occurrences.set(record.inputHash, (occurrences.get(record.inputHash) || 0) + 1);
  }
  const duplicates = [...occurrences.values()].filter((count) => count > 1);
  return {
    groups: duplicates.length,
    cases: duplicates.reduce((count, size) => count + size, 0)
  };
}

// Only summary counts and generic blocker codes are returned. No diff, labels,
// paths, hashes, repo aliases or per-case information may leave caller storage.
export function assessCalibrationPreflight(corpus) {
  const records = Array.isArray(corpus?.records) ? corpus.records : [];
  const calibration = records.filter((record) => record.entry?.partition === 'calibration');
  const otherPartitions = records.length - calibration.length;
  const duplicates = duplicateDiffCounts(calibration);
  const included = calibration.filter(permitted);
  const concerns = included.flatMap((record) => record.labels.concerns || []);
  const qualifyingConcerns = concerns.filter((concern) =>
    supported(concern) && concern.provenance !== 'synthetic-control'
  );
  const counts = {
    calibrationCases: calibration.length,
    includedCases: included.length,
    lowRiskControls: included.filter((record) => record.labels.lowRisk === true).length,
    supportedConcerns: qualifyingConcerns.length,
    highSeveritySupportedConcerns: qualifyingConcerns.filter((concern) => concern.severity === 'high').length,
    unsupportedConcerns: concerns.filter((concern) => !supported(concern)).length,
    syntheticProvenanceConcerns: concerns.filter((concern) => concern.provenance === 'synthetic-control').length,
    unresolvedDisputes: calibration.filter((record) => record.labels.adjudication?.status === 'disputed').length,
    excludedOrUnresolvedCases: calibration.length - included.length,
    duplicateDiffGroups: duplicates.groups,
    duplicateDiffCases: duplicates.cases
  };
  const blockers = [];
  if (!calibration.length) blockers.push('no-calibration-cases');
  if (otherPartitions) blockers.push('non-calibration-records');
  if (counts.supportedConcerns < CALIBRATION_PREFLIGHT_MINIMUMS.supportedConcerns) blockers.push('insufficient-supported-concerns');
  if (counts.lowRiskControls < CALIBRATION_PREFLIGHT_MINIMUMS.lowRiskControls) blockers.push('insufficient-low-risk-controls');
  if (counts.highSeveritySupportedConcerns < CALIBRATION_PREFLIGHT_MINIMUMS.highSeveritySupportedConcerns) blockers.push('insufficient-high-severity-concerns');
  if (counts.unresolvedDisputes) blockers.push('unresolved-disputes');
  if (counts.excludedOrUnresolvedCases) blockers.push('cases-require-independent-adjudication');
  if (counts.duplicateDiffCases) blockers.push('duplicate-calibration-diffs');
  if (calibration.some((record) => !/^[a-f0-9]{64}$/.test(record.inputHash || ''))) blockers.push('missing-input-hashes');

  return {
    schemaVersion: 1,
    assessment: 'calibration-preflight',
    status: blockers.length ? 'blocked' : 'human-verification-required',
    minimums: { ...CALIBRATION_PREFLIGHT_MINIMUMS },
    counts,
    blockers,
    manualVerificationRequired: [...REQUIRED_MANUAL_REVIEWS],
    semantics: 'Automated counts are provisional. Independent labeling, authentic provenance, ancestry separation, and a frozen official Phase 1 authorization cannot be established from this preflight. This report never grants Phase 1 PASS or authorizes Phase 2 repair.'
  };
}
