import { canonicalJson, sha256, validateArtifactManifest } from './artifactManifest.js';

export function summarizeReportHistory(records) {
  const points = [];
  const warnings = [];
  let previous = null;
  for (const [index, record] of (Array.isArray(records) ? records : []).entries()) {
    if (!record?.manifest || !record?.report) { warnings.push({ code: 'missing-history-record', index }); continue; }
    const manifestResult = validateArtifactManifest(record.manifest, { report: record.report });
    if (!manifestResult.valid) { warnings.push({ code: 'invalid-manifest', index, diagnostics: manifestResult.diagnostics }); continue; }
    if (record.report.schemaVersion !== 1) { warnings.push({ code: 'incompatible-schema', index }); continue; }
    const configHash = sha256(record.report.config);
    const point = Object.freeze({ artifactId: record.manifest.artifactId, generatedAt: record.manifest.generated.at, riskScore: record.report.riskScore, findingCount: Array.isArray(record.report.rules) ? record.report.rules.length : null, schemaVersion: record.report.schemaVersion, configurationHash: configHash });
    if (previous) {
      const elapsed = Date.parse(point.generatedAt) - Date.parse(previous.generatedAt);
      if (!Number.isFinite(elapsed) || elapsed < 0) warnings.push({ code: 'history-order-gap', from: previous.artifactId, to: point.artifactId });
      if (point.schemaVersion !== previous.schemaVersion) warnings.push({ code: 'incompatible-schema', from: previous.artifactId, to: point.artifactId });
      if (point.configurationHash !== previous.configurationHash) warnings.push({ code: 'configuration-changed', from: previous.artifactId, to: point.artifactId });
    }
    points.push(point); previous = point;
  }
  return Object.freeze({ points: Object.freeze(points), warnings: Object.freeze(warnings), semantics: 'descriptive-history; gaps and incompatible records are not interpolated' });
}

export function planLocalRetention(records, { now = new Date(), retentionDays = 90, maxArtifacts = 100, protectedArtifactIds = [] } = {}) {
  const protectedIds = new Set(protectedArtifactIds);
  const cutoff = now.getTime() - retentionDays * 86400000;
  const ordered = (Array.isArray(records) ? records : []).filter((record) => record?.manifest?.artifactId).sort((left, right) => Date.parse(right.manifest.generated.at) - Date.parse(left.manifest.generated.at));
  const retain = []; const remove = [];
  for (const [index, record] of ordered.entries()) {
    const id = record.manifest.artifactId;
    if (protectedIds.has(id) || (Date.parse(record.manifest.generated.at) >= cutoff && index < maxArtifacts)) retain.push(id);
    else remove.push(id);
  }
  return Object.freeze({ retain: Object.freeze(retain), remove: Object.freeze(remove), protected: Object.freeze([...protectedIds]), compaction: 'none; immutable artifacts are never merged or rewritten', deletion: 'explicit-user-action-only' });
}
