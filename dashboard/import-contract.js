export const DASHBOARD_LIMITS = Object.freeze({
  diffBytes: 20 * 1024 * 1024,
  diffLines: 200000,
  reportBytes: 10 * 1024 * 1024,
  reportDepth: 64,
  reportFiles: 10000,
  reportRules: 50000,
  reportChecks: 10000,
  reportComparisonFiles: 2
});

export class DashboardImportError extends Error {
  constructor(category, message) {
    super(message);
    this.name = 'DashboardImportError';
    this.category = category;
  }
}

function fail(category, name, detail) {
  throw new DashboardImportError(category, `${name}: ${detail}`);
}

function extension(name) {
  const index = name.lastIndexOf('.');
  return index < 0 ? '' : name.slice(index).toLowerCase();
}

function requireName(name) {
  if (typeof name !== 'string' || !name || name.length > 255 || /[\0/\\]/.test(name)) {
    fail('unsupported-type', 'selected file', 'use a plain filename no longer than 255 characters');
  }
}

function decode(name, bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail('invalid-encoding', name, 'must be valid UTF-8');
  }
}

function objectDepth(value, depth = 0) {
  if (value === null || typeof value !== 'object') return depth;
  let maximum = depth;
  for (const item of Object.values(value)) maximum = Math.max(maximum, objectDepth(item, depth + 1));
  return maximum;
}

function requiredReport(report, name) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) fail('malformed-input', name, 'report root must be an object');
  if (report.tool !== 'merge-guard') fail('incompatible-schema', name, 'report tool must be merge-guard');
  if (report.schemaVersion !== 1) fail('incompatible-schema', name, 'only report schema version 1 is supported');
  for (const field of ['version', 'riskLevel', 'mergeReadiness']) {
    if (typeof report[field] !== 'string' || !report[field]) fail('malformed-input', name, `report.${field} must be a non-empty string`);
  }
  if (!Number.isFinite(report.riskScore) || typeof report.docsOnly !== 'boolean') fail('malformed-input', name, 'report risk score and docs-only fields are invalid');
  for (const field of ['config', 'summary']) if (!report[field] || typeof report[field] !== 'object' || Array.isArray(report[field])) fail('malformed-input', name, `report.${field} must be an object`);
  for (const field of ['files', 'rules', 'suggestedChecks', 'flags', 'configDiagnostics']) if (!Array.isArray(report[field])) fail('malformed-input', name, `report.${field} must be an array`);
}

export function validateDashboardImport({ name, bytes }) {
  requireName(name);
  if (!(bytes instanceof Uint8Array)) fail('malformed-input', name, 'file bytes are required');
  const kind = extension(name);
  if (!['.diff', '.patch', '.json'].includes(kind)) fail('unsupported-type', name, 'only .diff, .patch, and .json files are supported');
  const maxBytes = kind === '.json' ? DASHBOARD_LIMITS.reportBytes : DASHBOARD_LIMITS.diffBytes;
  if (bytes.byteLength > maxBytes) fail('too-large', name, `exceeds the ${maxBytes}-byte limit`);
  const source = decode(name, bytes);
  if (source.includes('\0')) fail('malformed-input', name, 'NUL bytes are not supported');

  if (kind !== '.json') {
    const lines = source.split(/\r?\n/);
    if (lines.length > DASHBOARD_LIMITS.diffLines) fail('too-large', name, `exceeds the ${DASHBOARD_LIMITS.diffLines}-line limit`);
    if (!source.includes('diff --git ') || !/^diff --git .+/m.test(source) || !/^--- .+/m.test(source) || !/^\+\+\+ .+/m.test(source)) fail('malformed-input', name, 'must be a unified diff with diff --git, --- and +++ markers');
    if (/^GIT binary patch$/m.test(source) || /^Binary files .+ differ$/m.test(source)) fail('unsupported-type', name, 'binary patches are not supported');
    return Object.freeze({ kind: 'diff', name, text: source });
  }

  let report;
  try { report = JSON.parse(source); } catch { fail('malformed-input', name, 'must contain valid JSON'); }
  if (objectDepth(report) > DASHBOARD_LIMITS.reportDepth) fail('too-large', name, `exceeds JSON depth ${DASHBOARD_LIMITS.reportDepth}`);
  requiredReport(report, name);
  if (report.files.length > DASHBOARD_LIMITS.reportFiles || report.rules.length > DASHBOARD_LIMITS.reportRules || report.suggestedChecks.length > DASHBOARD_LIMITS.reportChecks) fail('too-large', name, 'report collection limit exceeded');
  return Object.freeze({ kind: 'report', name, report: Object.freeze(report) });
}

export function validateDashboardImportBatch(items) {
  if (!Array.isArray(items) || !items.length) fail('unsupported-type', 'selected input', 'select at least one file');
  const imports = items.map(validateDashboardImport);
  if (imports.filter((item) => item.kind === 'report').length > DASHBOARD_LIMITS.reportComparisonFiles) fail('unsupported-type', 'selected input', 'at most two report files can be compared');
  if (imports.filter((item) => item.kind === 'diff').length > 1) fail('unsupported-type', 'selected input', 'select one diff at a time');
  return Object.freeze(imports);
}
