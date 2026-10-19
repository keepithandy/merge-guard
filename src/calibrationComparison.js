// Content-free calibration before/after comparison. No product analyzer imports.
import { CALIBRATION_DIAGNOSIS_PATH_CLASSES } from './historicalPrEvaluation.js';

const HASH = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const PATH_CLASSES = new Set(CALIBRATION_DIAGNOSIS_PATH_CLASSES);
const IDENTIFIER = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const METRICS = Object.freeze([
  'actionablePrecision', 'supportedScopeRecall',
  'criticalSupportedScopeRecall', 'cleanPrSpecificity'
]);

function reject(code) { throw new Error(code); }
function nonNegative(value) { return Number.isSafeInteger(value) && value >= 0; }
function validRatio(value) {
  if (!value || !nonNegative(value.numerator) || !nonNegative(value.denominator)
    || value.numerator > value.denominator) return false;
  if (value.denominator === 0) return value.numerator === 0 && value.value === null;
  return typeof value.value === 'number' && Number.isFinite(value.value)
    && Math.abs(value.value - value.numerator / value.denominator) < 1e-12;
}
function snapshot(value, context) {
  const metadata = value?.metadata;
  const aggregate = value?.aggregate;
  const cases = value?.cases;
  if (!metadata || !aggregate || !cases
    || metadata.kind !== 'calibration-measurement' || metadata.schemaVersion !== 1
    || metadata.evidenceStatus !== 'provisional-human-verification-required'
    || !COMMIT.test(metadata.productCommit || '')
    || !HASH.test(metadata.metricImplementationHash || '')
    || !HASH.test(metadata.corpusContentHash || '')
    || !HASH.test(metadata.corpusManifestHash || '')
    || !nonNegative(metadata.calibrationCaseCount)
    || aggregate.schemaVersion !== 1 || aggregate.tool !== 'merge-guard'
    || aggregate.corpus?.partition !== 'calibration'
    || aggregate.corpus.manifestHash !== metadata.corpusManifestHash
    || aggregate.corpus.caseCount !== metadata.calibrationCaseCount
    || cases.schemaVersion !== 1 || cases.partition !== 'calibration'
    || !Array.isArray(cases.cases) || cases.cases.length !== aggregate.corpus.caseCount
    || !aggregate.metrics?.calibrationDiagnosis || aggregate.excludedCases?.length) {
    reject(`invalid-${context}-calibration-snapshot`);
  }

  const byId = new Map();
  for (const item of cases.cases) {
    if (!IDENTIFIER.test(item.caseId || '') || byId.has(item.caseId)
      || !IDENTIFIER.test(item.repositoryAlias || '')
      || item.partition !== 'calibration' || !HASH.test(item.inputHash || '')
      || !HASH.test(item.configurationHash || '')
      || !nonNegative(item.findingCount) || !nonNegative(item.matchedFindingCount)
      || !nonNegative(item.unmatchedPositiveFindingCount)
      || item.matchedFindingCount + item.unmatchedPositiveFindingCount !== item.findingCount
      || !nonNegative(item.supportedConcernCount) || !nonNegative(item.concernCount)
      || item.supportedConcernCount > item.concernCount
      || !Number.isFinite(item.setupMinutes) || item.setupMinutes < 0
      || !item.coverage || typeof item.coverage !== 'object') {
      reject(`invalid-${context}-case-result`);
    }
    byId.set(item.caseId, item);
  }
  for (const metric of METRICS) {
    if (!validRatio(aggregate.metrics[metric])) reject(`invalid-${context}-metric`);
  }
  const totalFindings = cases.cases.reduce((sum, item) => sum + item.findingCount, 0);
  const matchedFindings = cases.cases.reduce((sum, item) => sum + item.matchedFindingCount, 0);
  const supportedCount = cases.cases.reduce((sum, item) => sum + item.supportedConcernCount, 0);
  if (aggregate.metrics.actionablePrecision.denominator !== totalFindings
    || aggregate.metrics.actionablePrecision.numerator !== matchedFindings
    || aggregate.metrics.supportedScopeRecall.denominator !== supportedCount) {
    reject(`inconsistent-${context}-aggregate`);
  }
  const diag = aggregate.metrics.calibrationDiagnosis;
  for (const field of ['unmatchedPositiveFindings', 'missedSupportedConcerns']) {
    if (!Array.isArray(diag[field])) reject(`invalid-${context}-diagnosis`);
    const seen = new Set();
    for (const item of diag[field]) {
      const key = `${item.ruleFamily}\0${item.pathClass}`;
      if (!IDENTIFIER.test(item.ruleFamily || '') || !PATH_CLASSES.has(item.pathClass)
        || !Number.isSafeInteger(item.count) || item.count < 1
        || !Number.isSafeInteger(item.caseCount) || item.caseCount < 1
        || item.caseCount > item.count || seen.has(key)) reject(`invalid-${context}-diagnosis`);
      seen.add(key);
    }
  }
  return { metadata, aggregate, byId };
}

function metricDelta(before, after) {
  return {
    before: { numerator: before.numerator, denominator: before.denominator, value: before.value },
    after: { numerator: after.numerator, denominator: after.denominator, value: after.value },
    percentagePointChange: before.value === null || after.value === null ? null : Math.round((after.value - before.value) * 10000) / 100
  };
}
function inventoryDelta(before, after) {
  const left = new Map(before.map((item) => [`${item.ruleFamily}\0${item.pathClass}`, item]));
  const right = new Map(after.map((item) => [`${item.ruleFamily}\0${item.pathClass}`, item]));
  return [...new Set([...left.keys(), ...right.keys()])].sort().map((key) => {
    const a = left.get(key); const b = right.get(key);
    const [ruleFamily, pathClass] = key.split('\0');
    return {
      ruleFamily, pathClass,
      beforeCount: a?.count || 0,
      afterCount: b?.count || 0,
      countChange: (b?.count || 0) - (a?.count || 0),
      beforeCaseCount: a?.caseCount || 0,
      afterCaseCount: b?.caseCount || 0
    };
  });
}

export function compareCalibrationMeasurements(baseline, candidate) {
  const left = snapshot(baseline, 'baseline');
  const right = snapshot(candidate, 'candidate');
  if (left.metadata.corpusContentHash !== right.metadata.corpusContentHash
    || left.metadata.corpusManifestHash !== right.metadata.corpusManifestHash
    || left.aggregate.corpus.id !== right.aggregate.corpus.id
    || left.metadata.calibrationCaseCount !== right.metadata.calibrationCaseCount) reject('corpus-or-label-identity-drift');
  if (left.metadata.metricImplementationHash !== right.metadata.metricImplementationHash) reject('metric-implementation-drift');
  if (left.byId.size !== right.byId.size) reject('case-membership-drift');
  for (const [id, prev] of left.byId) {
    const next = right.byId.get(id);
    if (!next
      || prev.repositoryAlias !== next.repositoryAlias
      || prev.inputHash !== next.inputHash
      || prev.configurationHash !== next.configurationHash
      || prev.concernCount !== next.concernCount
      || prev.supportedConcernCount !== next.supportedConcernCount
      || prev.setupMinutes !== next.setupMinutes
      || JSON.stringify(prev.coverage) !== JSON.stringify(next.coverage)) reject('case-input-or-label-drift');
  }
  for (const metric of ['supportedScopeRecall', 'criticalSupportedScopeRecall', 'cleanPrSpecificity']) {
    if (left.aggregate.metrics[metric].denominator !== right.aggregate.metrics[metric].denominator) reject('metric-denominator-drift');
  }
  if (left.aggregate.metrics.criticalSupportedScopeRecall.status !== right.aggregate.metrics.criticalSupportedScopeRecall.status) reject('critical-evidence-status-drift');
  const measured = Object.fromEntries(METRICS.map((key) => [key, metricDelta(left.aggregate.metrics[key], right.aggregate.metrics[key])]));
  const noise = (result) => result.aggregate.metrics.noisePerPr?.median;
  if (![noise(left), noise(right)].every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)) reject('invalid-noise-metric');

  return {
    schemaVersion: 1,
    kind: 'calibration-before-after',
    status: 'provisional-human-verification-required',
    evidence: 'Same calibration corpus and metric implementation claimed by both local measurements; independent reviews and source ancestry must still be verified.',
    caseCount: left.metadata.calibrationCaseCount,
    corpusManifestHash: left.metadata.corpusManifestHash,
    corpusContentHash: left.metadata.corpusContentHash,
    metricImplementationHash: left.metadata.metricImplementationHash,
    baselineProductCommit: left.metadata.productCommit,
    candidateProductCommit: right.metadata.productCommit,
    metrics: measured,
    medianUnmatchedFindings: {
      before: noise(left), after: noise(right), change: noise(right) - noise(left)
    },
    diagnosis: {
      unmatchedPositiveFindings: inventoryDelta(left.aggregate.metrics.calibrationDiagnosis.unmatchedPositiveFindings, right.aggregate.metrics.calibrationDiagnosis.unmatchedPositiveFindings),
      missedSupportedConcerns: inventoryDelta(left.aggregate.metrics.calibrationDiagnosis.missedSupportedConcerns, right.aggregate.metrics.calibrationDiagnosis.missedSupportedConcerns)
    },
    limitations: 'Changes in metrics are not proof of generalization. No held-out data was read; no Phase 1 or Phase 2 gate is declared PASS.'
  };
}
