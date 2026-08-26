const HASH = /^[a-f0-9]{64}$/;

export const LEGACY_RISK_SCHEMA_VERSION = 1;

function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function warning(path, code, message) { return { path, code, message }; }

export function validateLegacyBaseline(baseline, { today = new Date() } = {}) {
  const warnings = [];
  const accepted = [];
  if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline)) return { accepted, warnings: [warning('$', 'malformed-baseline', 'baseline must be an object')] };
  if (baseline.schemaVersion !== LEGACY_RISK_SCHEMA_VERSION) warnings.push(warning('$.schemaVersion', 'unsupported-schema', 'only baseline schema version 1 is supported'));
  if (!Array.isArray(baseline.entries)) return { accepted, warnings: [...warnings, warning('$.entries', 'malformed-entries', 'entries must be an array')] };
  const seen = new Set();
  for (const [index, entry] of baseline.entries.entries()) {
    const path = `$.entries[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !HASH.test(entry.findingIdentity || '') || !text(entry.reason) || !text(entry.owner) || !text(entry.expiresOn)) {
      warnings.push(warning(path, 'malformed-entry', 'findingIdentity, reason, owner, and expiresOn are required')); continue;
    }
    if (seen.has(entry.findingIdentity)) { warnings.push(warning(path, 'duplicate-entry', 'duplicate findingIdentity ignored')); continue; }
    seen.add(entry.findingIdentity);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresOn) || Number.isNaN(Date.parse(`${entry.expiresOn}T00:00:00Z`))) {
      warnings.push(warning(path, 'invalid-expiry', 'expiresOn must be a real UTC date')); continue;
    }
    if (Date.parse(`${entry.expiresOn}T23:59:59Z`) < today.getTime()) { warnings.push(warning(path, 'expired-entry', 'expired baseline entry ignored')); continue; }
    accepted.push(Object.freeze({ findingIdentity: entry.findingIdentity, reason: entry.reason.trim(), owner: entry.owner.trim(), expiresOn: entry.expiresOn }));
  }
  return { accepted: Object.freeze(accepted), warnings: Object.freeze(warnings) };
}

export function annotateLegacyRisk(findings, baseline, options = {}) {
  const validation = validateLegacyBaseline(baseline, options);
  const byIdentity = new Map(validation.accepted.map((entry) => [entry.findingIdentity, entry]));
  const annotated = (Array.isArray(findings) ? findings : []).map((finding) => {
    const entry = byIdentity.get(finding?.identity);
    return Object.freeze({ ...finding, legacyRisk: entry ? { accepted: true, reason: entry.reason, owner: entry.owner, expiresOn: entry.expiresOn } : null });
  });
  return Object.freeze({ findings: Object.freeze(annotated), acceptedCount: annotated.filter((finding) => finding.legacyRisk).length, warnings: validation.warnings });
}
