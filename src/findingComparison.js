import { createHash } from 'node:crypto';

export const FINDING_IDENTITY_VERSION = 1;
export const FINDING_COMPARISON_SCHEMA_VERSION = 1;
export const SUPPORTED_REPORT_SCHEMA_VERSION = 1;

function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) return 'null';
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item ?? null)).join(',')}]`;
  const fields = Object.keys(value).filter((key) => value[key] !== undefined).sort();
  return `{${fields.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function hash(parts) {
  const source = Array.isArray(parts) ? parts.join('\0') : canonicalJson(parts);
  return createHash('sha256').update(source, 'utf8').digest('hex');
}

function reportDiagnostics(report, label) {
  const diagnostics = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    diagnostics.push({ path: label, code: 'invalid-report', message: `${label} must be a JSON report object.` });
    return diagnostics;
  }
  if (!Number.isInteger(report.schemaVersion)) {
    diagnostics.push({ path: `${label}.schemaVersion`, code: 'missing-schema-version', message: `${label}.schemaVersion must be an integer.` });
  }
  if (report.tool !== 'merge-guard') {
    diagnostics.push({ path: `${label}.tool`, code: 'unexpected-tool', message: `${label}.tool must be merge-guard.` });
  }
  if (!text(report.version)) {
    diagnostics.push({ path: `${label}.version`, code: 'missing-version', message: `${label}.version must be a non-empty string.` });
  }
  if (!Number.isFinite(report.riskScore)) {
    diagnostics.push({ path: `${label}.riskScore`, code: 'missing-risk-score', message: `${label}.riskScore must be a finite number.` });
  }
  if (!text(report.riskLevel)) {
    diagnostics.push({ path: `${label}.riskLevel`, code: 'missing-risk-level', message: `${label}.riskLevel must be a non-empty string.` });
  }
  if (!text(report.mergeReadiness)) {
    diagnostics.push({ path: `${label}.mergeReadiness`, code: 'missing-readiness', message: `${label}.mergeReadiness must be a non-empty string.` });
  }
  if (typeof report.docsOnly !== 'boolean') {
    diagnostics.push({ path: `${label}.docsOnly`, code: 'missing-docs-only', message: `${label}.docsOnly must be boolean.` });
  }
  if (!report.config || typeof report.config !== 'object' || Array.isArray(report.config)) {
    diagnostics.push({ path: `${label}.config`, code: 'missing-config', message: `${label}.config must be an object.` });
  }
  if (!report.summary || typeof report.summary !== 'object' || Array.isArray(report.summary)) {
    diagnostics.push({ path: `${label}.summary`, code: 'missing-summary', message: `${label}.summary must be an object.` });
  }
  if (!Array.isArray(report.rules)) {
    diagnostics.push({ path: `${label}.rules`, code: 'missing-rules', message: `${label}.rules must be an array.` });
  }
  if (!Array.isArray(report.files)) {
    diagnostics.push({ path: `${label}.files`, code: 'missing-files', message: `${label}.files must be an array.` });
  }
  if (!Array.isArray(report.flags)) {
    diagnostics.push({ path: `${label}.flags`, code: 'missing-flags', message: `${label}.flags must be an array.` });
  }
  if (!Array.isArray(report.suggestedChecks)) {
    diagnostics.push({ path: `${label}.suggestedChecks`, code: 'missing-checks', message: `${label}.suggestedChecks must be an array.` });
  }
  if (!Array.isArray(report.configDiagnostics)) {
    diagnostics.push({ path: `${label}.configDiagnostics`, code: 'missing-config-diagnostics', message: `${label}.configDiagnostics must be an array.` });
  }
  return diagnostics;
}

function validateReport(report, label) {
  const diagnostics = reportDiagnostics(report, label);
  if (diagnostics.length) {
    throw new FindingComparisonError(
      `${label} is not a compatible merge-guard report.`,
      'INVALID_REPORT',
      diagnostics
    );
  }
  if (report.schemaVersion !== SUPPORTED_REPORT_SCHEMA_VERSION) {
    throw new FindingComparisonError(
      `${label} uses unsupported report schema version ${report.schemaVersion}.`,
      'INCOMPATIBLE_REPORT_SCHEMA',
      [{
        path: `${label}.schemaVersion`,
        code: 'unsupported-schema-version',
        message: `Only report schema version ${SUPPORTED_REPORT_SCHEMA_VERSION} is supported.`,
        value: report.schemaVersion
      }]
    );
  }
}

function normalizePath(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (
    !normalized
    || normalized.startsWith('/')
    || normalized.includes('\0')
    || normalized.split('/').some((part) => part === '..' || !part)
  ) {
    return null;
  }
  return normalized;
}

function findingSource(rule) {
  if (text(rule?.policyPackId)) return `policy:${text(rule.policyPackId)}`;
  if (rule?.custom === true) return 'custom';
  return 'builtin';
}

function findingPaths(rule, report) {
  const direct = [...new Set(list(rule?.matchedFiles).map(normalizePath).filter(Boolean))].sort();
  if (direct.length) return direct;

  const inferred = [];
  for (const file of list(report.files)) {
    if (!list(file?.rules).some((item) => item?.id === rule?.id)) continue;
    const filePath = normalizePath(file.path);
    if (filePath) inferred.push(filePath);
  }
  return [...new Set(inferred)].sort();
}

function exceptionIds(rule) {
  return list(rule?.policyExceptions)
    .map((item) => text(item?.id))
    .filter(Boolean)
    .sort();
}

function findingRecord(rule, filePath) {
  const ruleId = text(rule?.id, 'unknown-rule');
  const source = findingSource(rule);
  const identity = hash([
    `finding-identity-v${FINDING_IDENTITY_VERSION}`,
    source,
    ruleId,
    filePath || '<global>'
  ]);
  return {
    identity,
    identityVersion: FINDING_IDENTITY_VERSION,
    source,
    ruleId,
    path: filePath,
    label: text(rule?.label, ruleId),
    weight: Number.isInteger(rule?.weight) ? rule.weight : 0,
    reason: text(rule?.reason, 'No reason supplied.'),
    check: text(rule?.check) || null,
    matchedLineCount: Number.isInteger(rule?.matchedLineCount) ? rule.matchedLineCount : 0,
    policyPackId: text(rule?.policyPackId) || null,
    policyPackVersion: text(rule?.policyPackVersion) || null,
    exceptionIds: exceptionIds(rule)
  };
}

export function extractStableFindings(report) {
  validateReport(report, 'report');
  const findings = new Map();
  for (const rule of report.rules) {
    const paths = findingPaths(rule, report);
    for (const filePath of paths.length ? paths : [null]) {
      const record = findingRecord(rule, filePath);
      if (!findings.has(record.identity)) findings.set(record.identity, record);
    }
  }
  return [...findings.values()].sort((left, right) => left.identity.localeCompare(right.identity));
}

export function hashImmutableReport(report) {
  validateReport(report, 'report');
  return hash(report);
}

function reportRecord(report, findings) {
  return {
    schemaVersion: report.schemaVersion,
    toolVersion: text(report.version, '0.0.0'),
    contentHash: hashImmutableReport(report),
    findingCount: findings.length,
    riskScore: Number.isFinite(report.riskScore) ? report.riskScore : null,
    riskLevel: text(report.riskLevel) || null,
    mergeReadiness: text(report.mergeReadiness) || null
  };
}

function sorted(values) {
  return values.sort((left, right) => left.identity.localeCompare(right.identity));
}

export function compareFindingReports(previousReport, currentReport) {
  validateReport(currentReport, 'currentReport');
  const currentFindings = extractStableFindings(currentReport);

  if (previousReport === null || previousReport === undefined) {
    return {
      schemaVersion: FINDING_COMPARISON_SCHEMA_VERSION,
      findingIdentityVersion: FINDING_IDENTITY_VERSION,
      status: 'history-unavailable',
      historyAvailable: false,
      classificationAvailable: false,
      previous: null,
      current: reportRecord(currentReport, currentFindings),
      summary: { new: null, unchanged: null, resolved: null },
      findings: { new: [], unchanged: [], resolved: [] },
      warning: 'No previous immutable report was supplied; finding changes are unknown and must not be treated as a clean comparison.',
      semantics: 'comparison-only; classifications do not change report findings, scores, readiness, or CI thresholds'
    };
  }

  validateReport(previousReport, 'previousReport');
  if (previousReport.schemaVersion !== currentReport.schemaVersion) {
    throw new FindingComparisonError(
      `Report schema versions are incompatible: previous ${previousReport.schemaVersion}, current ${currentReport.schemaVersion}.`,
      'INCOMPATIBLE_REPORT_SCHEMA',
      [{
        path: '$.schemaVersion',
        code: 'schema-version-mismatch',
        message: 'Previous and current reports must use the same supported schema version.',
        previous: previousReport.schemaVersion,
        current: currentReport.schemaVersion
      }]
    );
  }

  const previousFindings = extractStableFindings(previousReport);
  const previousByIdentity = new Map(previousFindings.map((finding) => [finding.identity, finding]));
  const currentByIdentity = new Map(currentFindings.map((finding) => [finding.identity, finding]));
  const newFindings = [];
  const unchangedFindings = [];
  const resolvedFindings = [];

  for (const current of currentFindings) {
    const previous = previousByIdentity.get(current.identity);
    if (!previous) {
      newFindings.push(current);
      continue;
    }
    unchangedFindings.push({
      identity: current.identity,
      previous,
      current,
      detailsChanged: canonicalJson(previous) !== canonicalJson(current)
    });
  }
  for (const previous of previousFindings) {
    if (!currentByIdentity.has(previous.identity)) resolvedFindings.push(previous);
  }

  sorted(newFindings);
  unchangedFindings.sort((left, right) => left.identity.localeCompare(right.identity));
  sorted(resolvedFindings);
  return {
    schemaVersion: FINDING_COMPARISON_SCHEMA_VERSION,
    findingIdentityVersion: FINDING_IDENTITY_VERSION,
    status: 'compared',
    historyAvailable: true,
    classificationAvailable: true,
    previous: reportRecord(previousReport, previousFindings),
    current: reportRecord(currentReport, currentFindings),
    summary: {
      new: newFindings.length,
      unchanged: unchangedFindings.length,
      resolved: resolvedFindings.length
    },
    findings: {
      new: newFindings,
      unchanged: unchangedFindings,
      resolved: resolvedFindings
    },
    warning: null,
    semantics: 'comparison-only; resolved means absent from the current report and does not by itself prove remediation'
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function findingLine(finding) {
  const location = finding.path ? `<code>${escapeHtml(finding.path)}</code>` : 'global finding';
  return `**${escapeHtml(finding.label)}** (${location}, <code>${escapeHtml(finding.ruleId)}</code>)`;
}

export function formatFindingComparisonMarkdown(comparison) {
  if (!comparison || typeof comparison !== 'object') {
    throw new TypeError('formatFindingComparisonMarkdown requires a comparison object.');
  }
  const lines = ['## Merge Guard finding comparison', ''];
  if (comparison.status === 'history-unavailable') {
    lines.push('**History unavailable — finding changes are unknown.**');
    lines.push('');
    if (comparison.priorEvidence) {
      lines.push(`Prior evidence status: **${escapeHtml(comparison.priorEvidence.status)}**.`);
      lines.push('');
    }
    lines.push(comparison.warning);
    return lines.join('\n');
  }
  if (comparison.status !== 'compared') {
    throw new TypeError(`unsupported comparison status: ${comparison.status}`);
  }

  lines.push(`**New:** ${comparison.summary.new} · **Unchanged:** ${comparison.summary.unchanged} · **Resolved:** ${comparison.summary.resolved}`);
  lines.push('');
  lines.push(`Previous report: <code>${comparison.previous.contentHash}</code>`);
  lines.push(`Current report: <code>${comparison.current.contentHash}</code>`);
  if (comparison.priorEvidence?.status === 'verified') {
    lines.push(`Prior evidence: verified artifact <code>${escapeHtml(comparison.priorEvidence.artifactId)}</code>`);
  }

  for (const [label, findings] of [
    ['New findings', comparison.findings.new],
    ['Resolved findings', comparison.findings.resolved]
  ]) {
    lines.push('');
    lines.push(`<details><summary>${label} (${findings.length})</summary>`);
    lines.push('');
    if (findings.length) {
      for (const finding of findings) lines.push(`- ${findingLine(finding)}`);
    } else {
      lines.push(`No ${label.toLowerCase()}.`);
    }
    lines.push('');
    lines.push('</details>');
  }

  lines.push('');
  lines.push('<details><summary>Unchanged findings (' + comparison.findings.unchanged.length + ')</summary>');
  lines.push('');
  if (comparison.findings.unchanged.length) {
    for (const item of comparison.findings.unchanged) {
      lines.push(`- ${findingLine(item.current)}${item.detailsChanged ? ' — report details changed' : ''}`);
    }
  } else {
    lines.push('No unchanged findings.');
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');
  lines.push('Resolved means absent from the current report and does not by itself prove remediation; verify the diff before treating it as fixed. Comparison does not change score or threshold behavior.');
  return lines.join('\n');
}

export class FindingComparisonError extends Error {
  constructor(message, code, diagnostics = []) {
    super(message);
    this.name = 'FindingComparisonError';
    this.code = code;
    this.diagnostics = diagnostics;
  }
}
