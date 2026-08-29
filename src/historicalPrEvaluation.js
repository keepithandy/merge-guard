import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { analyzeDiff } from './analyzeDiff.js';
import { canonicalJson } from './artifactManifest.js';
import { extractStableFindings } from './findingComparison.js';
import { MERGE_GUARD_VERSION } from './version.js';

export const EVALUATION_SCHEMA_VERSION = 1;
export const EVALUATION_MAX_MANIFEST_BYTES = 256 * 1024;
export const EVALUATION_MAX_LABEL_BYTES = 128 * 1024;
export const EVALUATION_MAX_DIFF_BYTES = 2_000_000;
export const EVALUATION_MAX_CASES = 500;
export const SUPPORTED_RULE_FAMILIES = new Set([
  'state-or-persistence', 'dependency-or-config', 'routing-or-entry',
  'async-or-network', 'large-change', 'test-change', 'implementation-without-tests',
  'configured-high-risk-path', 'docs-only'
]);

export class HistoricalPrEvaluationError extends Error {
  constructor(message, diagnostics = []) {
    super(message);
    this.name = 'HistoricalPrEvaluationError';
    this.diagnostics = diagnostics;
  }
}

const identifier = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const ordered = (values) => [...values].sort((left, right) => String(left).localeCompare(String(right)));

function diagnostic(pathValue, code, message) { return { path: pathValue, code, message }; }
function safeRelative(value) {
  if (typeof value !== 'string' || !value || value.includes('\0')) return null;
  const normalized = value.replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[a-z]:/i.test(normalized) || normalized.split('/').some((part) => !part || part === '.' || part === '..')) return null;
  return normalized;
}
function safeChild(root, relative, field, diagnostics) {
  const normalized = safeRelative(relative);
  if (!normalized) { diagnostics.push(diagnostic(field, 'unsafe-path', `${field} must be a safe relative path`)); return null; }
  const candidate = path.resolve(root, normalized);
  const resolvedRoot = path.resolve(root);
  if (!candidate.startsWith(`${resolvedRoot}${path.sep}`)) { diagnostics.push(diagnostic(field, 'path-escape', `${field} must stay inside the corpus root`)); return null; }
  return candidate;
}
function readRegularJson(filePath, maxBytes, field, diagnostics) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) throw new Error('symbolic links are not allowed');
    if (!stat.isFile()) throw new Error('path is not a regular file');
    if (stat.size > maxBytes) throw new Error(`file exceeds ${maxBytes} bytes`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    diagnostics.push(diagnostic(field, 'unreadable-json', error.message));
    return null;
  }
}
function readRegularText(filePath, maxBytes, field, diagnostics) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) throw new Error('symbolic links are not allowed');
    if (!stat.isFile()) throw new Error('path is not a regular file');
    if (stat.size > maxBytes) throw new Error(`file exceeds ${maxBytes} bytes`);
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    diagnostics.push(diagnostic(field, 'unreadable-diff', error.message));
    return null;
  }
}
function validateManifest(manifest, diagnostics) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) { diagnostics.push(diagnostic('manifest', 'invalid-manifest', 'manifest must be an object')); return; }
  if (manifest.schemaVersion !== EVALUATION_SCHEMA_VERSION) diagnostics.push(diagnostic('manifest.schemaVersion', 'unsupported-schema', 'only corpus schema version 1 is supported'));
  if (!identifier.test(manifest.corpusId || '')) diagnostics.push(diagnostic('manifest.corpusId', 'invalid-id', 'corpusId must be an opaque lowercase identifier'));
  if (!Array.isArray(manifest.cases) || !manifest.cases.length || manifest.cases.length > EVALUATION_MAX_CASES) diagnostics.push(diagnostic('manifest.cases', 'invalid-cases', `cases must contain 1-${EVALUATION_MAX_CASES} entries`));
}
function validateLabels(labels, entry, diagnostics) {
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) { diagnostics.push(diagnostic(`${entry.id}.labels`, 'invalid-labels', 'labels must be an object')); return; }
  if (labels.schemaVersion !== EVALUATION_SCHEMA_VERSION) diagnostics.push(diagnostic(`${entry.id}.labels.schemaVersion`, 'unsupported-schema', 'only label schema version 1 is supported'));
  if (labels.caseId !== entry.id || labels.repositoryAlias !== entry.repositoryAlias) diagnostics.push(diagnostic(`${entry.id}.labels`, 'identity-mismatch', 'labels must match manifest case and repository aliases'));
  if (typeof labels.lowRisk !== 'boolean') diagnostics.push(diagnostic(`${entry.id}.labels.lowRisk`, 'invalid-low-risk', 'lowRisk must be boolean'));
  if (!Array.isArray(labels.labelers) || labels.labelers.length !== 2 || new Set(labels.labelers.map((item) => item?.alias)).size !== 2 || labels.labelers.some((item) => !identifier.test(item?.alias || '') || !['include', 'exclude'].includes(item?.decision))) diagnostics.push(diagnostic(`${entry.id}.labels.labelers`, 'independent-labelers-required', 'exactly two distinct opaque labeler aliases and decisions are required'));
  if (!labels.adjudication || !['agreed', 'resolved', 'disputed'].includes(labels.adjudication.status)) diagnostics.push(diagnostic(`${entry.id}.labels.adjudication`, 'invalid-adjudication', 'adjudication status must be agreed, resolved, or disputed'));
  if (!Array.isArray(labels.concerns)) diagnostics.push(diagnostic(`${entry.id}.labels.concerns`, 'invalid-concerns', 'concerns must be an array'));
  const concernIds = new Set();
  for (const [index, concern] of (labels.concerns || []).entries()) {
    const prefix = `${entry.id}.labels.concerns[${index}]`;
    if (!identifier.test(concern?.id || '') || concernIds.has(concern?.id)) diagnostics.push(diagnostic(`${prefix}.id`, 'invalid-id', 'concern id must be unique, opaque, and lowercase')); else concernIds.add(concern.id);
    if (!['low', 'medium', 'high'].includes(concern?.severity)) diagnostics.push(diagnostic(`${prefix}.severity`, 'invalid-severity', 'severity must be low, medium, or high'));
    if (!Array.isArray(concern?.ruleFamilies) || !concern.ruleFamilies.length || concern.ruleFamilies.some((item) => !identifier.test(item))) diagnostics.push(diagnostic(`${prefix}.ruleFamilies`, 'invalid-rule-families', 'rule families must be stable lowercase identifiers'));
    if (!Array.isArray(concern?.paths) || concern.paths.some((item) => !safeRelative(item))) diagnostics.push(diagnostic(`${prefix}.paths`, 'invalid-paths', 'paths must be safe repository-relative paths'));
    if (!['incident', 'review-comment', 'maintainer-judgment', 'synthetic-control'].includes(concern?.provenance)) diagnostics.push(diagnostic(`${prefix}.provenance`, 'invalid-provenance', 'provenance must be declared'));
    if (typeof concern?.rationale !== 'string' || concern.rationale.length > 240 || /https?:\/\//i.test(concern.rationale)) diagnostics.push(diagnostic(`${prefix}.rationale`, 'unsafe-rationale', 'rationale must be content-free, short, and contain no URL'));
  }
  if (labels.lowRisk === true && labels.concerns?.length) diagnostics.push(diagnostic(`${entry.id}.labels`, 'low-risk-concerns', 'low-risk cases must not declare concerns'));
}
function validateDescriptor(value, field, diagnostics) {
  if (typeof value !== 'string' || !value.trim() || value.length > 80 || /https?:\/\//i.test(value)) diagnostics.push(diagnostic(field, 'invalid-descriptor', `${field} must be a short content-free descriptor`));
}

export function loadHistoricalPrCorpus(corpusRoot) {
  const diagnostics = [];
  const root = path.resolve(corpusRoot);
  try { if (!fs.lstatSync(root).isDirectory()) throw new Error('not a directory'); } catch (error) { throw new HistoricalPrEvaluationError('corpus root is unavailable', [diagnostic('corpus', 'unreadable-root', error.message)]); }
  const manifestPath = path.join(root, 'manifest.json');
  const manifest = readRegularJson(manifestPath, EVALUATION_MAX_MANIFEST_BYTES, 'manifest.json', diagnostics);
  validateManifest(manifest, diagnostics);
  const caseIds = new Set(); const aliases = new Map(); const records = [];
  for (const [index, entry] of (manifest?.cases || []).entries()) {
    const prefix = `manifest.cases[${index}]`;
    if (!entry || typeof entry !== 'object') { diagnostics.push(diagnostic(prefix, 'invalid-case', 'case must be an object')); continue; }
    if (!identifier.test(entry.id || '') || caseIds.has(entry.id)) diagnostics.push(diagnostic(`${prefix}.id`, 'duplicate-or-invalid-id', 'case id must be unique and opaque')); else caseIds.add(entry.id);
    if (!identifier.test(entry.repositoryAlias || '')) diagnostics.push(diagnostic(`${prefix}.repositoryAlias`, 'invalid-repository-alias', 'repositoryAlias must be opaque and lowercase'));
    if (!['calibration', 'held-out'].includes(entry.partition)) diagnostics.push(diagnostic(`${prefix}.partition`, 'invalid-partition', 'partition must be calibration or held-out'));
    if (typeof entry.setupMinutes !== 'number' || entry.setupMinutes < 0 || entry.setupMinutes > 240) diagnostics.push(diagnostic(`${prefix}.setupMinutes`, 'invalid-setup-minutes', 'setupMinutes must be 0-240'));
    for (const field of ['repositoryShape', 'ecosystem', 'changeCategory', 'diffSize']) validateDescriptor(entry[field], `${prefix}.${field}`, diagnostics);
    if (aliases.has(entry.repositoryAlias) && aliases.get(entry.repositoryAlias) !== entry.partition) diagnostics.push(diagnostic(`${prefix}.repositoryAlias`, 'partition-leakage', 'a repository alias may not appear in both calibration and held-out partitions')); else aliases.set(entry.repositoryAlias, entry.partition);
    const caseRoot = safeChild(root, entry.directory, `${prefix}.directory`, diagnostics);
    if (!caseRoot) continue;
    try { if (!fs.lstatSync(caseRoot).isDirectory()) throw new Error('not a directory'); } catch (error) { diagnostics.push(diagnostic(`${prefix}.directory`, 'unreadable-case-directory', error.message)); continue; }
    const diffPath = safeChild(caseRoot, entry.diff || 'change.diff', `${prefix}.diff`, diagnostics);
    const labelsPath = safeChild(caseRoot, entry.labels || 'labels.json', `${prefix}.labels`, diagnostics);
    const configPath = entry.config ? safeChild(caseRoot, entry.config, `${prefix}.config`, diagnostics) : null;
    const diff = diffPath && readRegularText(diffPath, EVALUATION_MAX_DIFF_BYTES, `${prefix}.diff`, diagnostics);
    const labels = labelsPath && readRegularJson(labelsPath, EVALUATION_MAX_LABEL_BYTES, `${prefix}.labels`, diagnostics);
    let config = {};
    if (configPath) { config = readRegularJson(configPath, EVALUATION_MAX_LABEL_BYTES, `${prefix}.config`, diagnostics); if (!config || Array.isArray(config) || typeof config !== 'object') diagnostics.push(diagnostic(`${prefix}.config`, 'invalid-config', 'config must be a JSON object')); }
    validateLabels(labels, entry, diagnostics);
    if (diff !== null && labels) records.push({ entry, diff, labels, config: config || {}, inputHash: sha256(diff) });
  }
  if (diagnostics.length) throw new HistoricalPrEvaluationError('historical PR corpus is invalid', diagnostics);
  return { root, manifest, records: records.sort((left, right) => left.entry.id.localeCompare(right.entry.id)), manifestHash: sha256(fs.readFileSync(manifestPath)) };
}

function percentile(values, ratio) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)]; }
function highestSeverity(concerns) { const rank = { low: 1, medium: 2, high: 3 }; return concerns.reduce((best, item) => rank[item.severity] > rank[best] ? item.severity : best, 'low'); }
function findingMatchesConcern(finding, concern) { return concern.ruleFamilies.includes(finding.ruleId) && (concern.paths.length === 0 ? finding.path === null : concern.paths.includes(finding.path)); }
function coverageCounts(caseResults, field) {
  return Object.fromEntries(ordered(new Set(caseResults.map((item) => item.coverage[field]))).map((value) => [value, caseResults.filter((item) => item.coverage[field] === value).length]));
}

export function evaluateHistoricalPrCorpus(corpus) {
  const started = performance.now();
  const caseResults = [];
  const allFindings = []; const supportedConcerns = []; const criticalConcerns = []; const matchedConcernIds = new Set();
  for (const record of corpus.records) {
    const caseStart = performance.now();
    const report = { ...analyzeDiff(record.diff, record.config), schemaVersion: 1, configDiagnostics: [] };
    const findings = extractStableFindings(report).filter((finding) => finding.weight > 0);
    const concerns = record.labels.concerns || [];
    const matches = concerns.map((concern) => ({ concernId: concern.id, findingIds: findings.filter((finding) => findingMatchesConcern(finding, concern)).map((finding) => finding.identity) }));
    for (const concern of concerns) {
      const supported = concern.ruleFamilies.some((family) => SUPPORTED_RULE_FAMILIES.has(family));
      if (supported) { supportedConcerns.push({ caseId: record.entry.id, concern }); if (concern.severity === 'high') criticalConcerns.push({ caseId: record.entry.id, concern }); }
      if (matches.find((match) => match.concernId === concern.id)?.findingIds.length) matchedConcernIds.add(`${record.entry.id}\0${concern.id}`);
    }
    const matchedFindingIds = new Set(matches.flatMap((match) => match.findingIds));
    const unmatched = findings.filter((finding) => !matchedFindingIds.has(finding.identity));
    allFindings.push(...findings.map((finding) => ({ caseId: record.entry.id, matched: matchedFindingIds.has(finding.identity) })));
    caseResults.push({
      schemaVersion: EVALUATION_SCHEMA_VERSION, caseId: record.entry.id, repositoryAlias: record.entry.repositoryAlias, partition: record.entry.partition,
      inputHash: record.inputHash, configurationHash: sha256(canonicalJson(record.config)), riskLevel: report.riskLevel, mergeReadiness: report.mergeReadiness,
      findingCount: findings.length, matchedFindingCount: matchedFindingIds.size, unmatchedPositiveFindingCount: unmatched.length,
      concernCount: concerns.length, supportedConcernCount: concerns.filter((concern) => concern.ruleFamilies.some((family) => SUPPORTED_RULE_FAMILIES.has(family))).length,
      matchedConcernIds: ordered(matches.filter((match) => match.findingIds.length).map((match) => match.concernId)),
      runtimeMs: Math.round(performance.now() - caseStart), setupMinutes: record.entry.setupMinutes,
      coverage: { repositoryShape: record.entry.repositoryShape, ecosystem: record.entry.ecosystem, changeCategory: record.entry.changeCategory, diffSize: record.entry.diffSize }
    });
  }
  const matchedFindings = allFindings.filter((item) => item.matched).length;
  const matchedSupported = supportedConcerns.filter((item) => matchedConcernIds.has(`${item.caseId}\0${item.concern.id}`)).length;
  const matchedCritical = criticalConcerns.filter((item) => matchedConcernIds.has(`${item.caseId}\0${item.concern.id}`)).length;
  const lowRisk = corpus.records.filter((record) => record.labels.lowRisk);
  const byCase = new Map(caseResults.map((result) => [result.caseId, result]));
  const readiness = { low: {}, medium: {}, high: {} };
  for (const record of corpus.records) { const severity = highestSeverity(record.labels.concerns || []); const state = byCase.get(record.entry.id).mergeReadiness; readiness[severity][state] = (readiness[severity][state] || 0) + 1; }
  const aggregate = {
    schemaVersion: EVALUATION_SCHEMA_VERSION, tool: 'merge-guard', toolVersion: MERGE_GUARD_VERSION,
    corpus: { id: corpus.manifest.corpusId, manifestHash: corpus.manifestHash, caseCount: caseResults.length },
    metrics: {
      actionablePrecision: { numerator: matchedFindings, denominator: allFindings.length, value: allFindings.length ? matchedFindings / allFindings.length : null },
      supportedScopeRecall: { numerator: matchedSupported, denominator: supportedConcerns.length, value: supportedConcerns.length ? matchedSupported / supportedConcerns.length : null },
      criticalSupportedScopeRecall: { numerator: matchedCritical, denominator: criticalConcerns.length, value: criticalConcerns.length ? matchedCritical / criticalConcerns.length : null, status: criticalConcerns.length >= 5 ? 'measured' : 'insufficient-evidence' },
      noisePerPr: { median: percentile(caseResults.map((item) => item.unmatchedPositiveFindingCount), 0.5), p90: percentile(caseResults.map((item) => item.unmatchedPositiveFindingCount), 0.9) },
      cleanPrSpecificity: { numerator: lowRisk.filter((record) => byCase.get(record.entry.id).findingCount === 0).length, denominator: lowRisk.length, value: lowRisk.length ? lowRisk.filter((record) => byCase.get(record.entry.id).findingCount === 0).length / lowRisk.length : null },
      setupEffortMinutes: { median: percentile(caseResults.map((item) => item.setupMinutes), 0.5) },
      runtimeMs: { median: percentile(caseResults.map((item) => item.runtimeMs), 0.5), p95: percentile(caseResults.map((item) => item.runtimeMs), 0.95) },
      readinessCalibration: readiness,
      coverage: { repositoryShape: coverageCounts(caseResults, 'repositoryShape'), ecosystem: coverageCounts(caseResults, 'ecosystem'), changeCategory: coverageCounts(caseResults, 'changeCategory'), diffSize: coverageCounts(caseResults, 'diffSize') },
      labelQuality: { agreed: corpus.records.filter((record) => record.labels.adjudication.status === 'agreed').length, resolved: corpus.records.filter((record) => record.labels.adjudication.status === 'resolved').length, disputed: corpus.records.filter((record) => record.labels.adjudication.status === 'disputed').length }
    },
    excludedCases: [], runtimeMs: Math.round(performance.now() - started), semantics: 'Aggregate results contain no diff text or source contents. Empty denominators are not-measured; these metrics do not alter Merge Guard scoring or readiness.'
  };
  return { aggregate, caseResults: caseResults.sort((left, right) => left.caseId.localeCompare(right.caseId)) };
}
