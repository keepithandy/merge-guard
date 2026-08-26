import { createHash } from 'node:crypto';

export const ARTIFACT_MANIFEST_SCHEMA_VERSION = 1;
const HASH = /^[a-f0-9]{64}$/;

export class ArtifactManifestError extends Error {
  constructor(code, message, diagnostics = []) { super(message); this.name = 'ArtifactManifestError'; this.code = code; this.diagnostics = diagnostics; }
}

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function sha256(value) { return createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value), 'utf8').digest('hex'); }

function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function diagnostic(path, code, message) { return { path, code, message }; }

function validateInputs(input) {
  const diagnostics = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [diagnostic('$', 'invalid-manifest', 'manifest must be an object')];
  if (input.schemaVersion !== ARTIFACT_MANIFEST_SCHEMA_VERSION) diagnostics.push(diagnostic('$.schemaVersion', 'unsupported-schema', 'only manifest schema version 1 is supported'));
  if (!HASH.test(input.artifactId || '')) diagnostics.push(diagnostic('$.artifactId', 'invalid-artifact-id', 'artifactId must be a SHA-256 hex digest'));
  const generated = input.generated;
  if (!generated || !text(generated.at) || !text(generated.tool) || !text(generated.toolVersion)) diagnostics.push(diagnostic('$.generated', 'incomplete-generated-metadata', 'generated.at, generated.tool, and generated.toolVersion are required'));
  if (generated && Number.isNaN(Date.parse(generated.at))) diagnostics.push(diagnostic('$.generated.at', 'invalid-timestamp', 'generated.at must be an ISO timestamp'));
  const evidence = input.evidence;
  if (!evidence || !text(evidence.commit) || !text(evidence.repository) || !text(evidence.inputType) || !evidence.configuration || typeof evidence.configuration !== 'object' || Array.isArray(evidence.configuration)) diagnostics.push(diagnostic('$.evidence', 'incomplete-evidence', 'repository, commit, inputType, and configuration are required evidence'));
  if (evidence && !['diff', 'report'].includes(evidence.inputType)) diagnostics.push(diagnostic('$.evidence.inputType', 'invalid-input-type', 'inputType must be diff or report'));
  const hashes = input.contentHashes;
  for (const field of ['report', 'configuration', 'evidence']) if (!HASH.test(hashes?.[field] || '')) diagnostics.push(diagnostic(`$.contentHashes.${field}`, 'invalid-content-hash', `${field} must be a SHA-256 hex digest`));
  if (!input.report || input.report.schemaVersion !== 1 || !HASH.test(input.report.contentHash || '')) diagnostics.push(diagnostic('$.report', 'invalid-report-reference', 'report schemaVersion 1 and contentHash are required'));
  return diagnostics;
}

function identityPayload(manifest) {
  const { artifactId, ...withoutId } = manifest;
  return withoutId;
}

export function createArtifactManifest({ report, evidence, generatedAt, toolVersion = report?.version }) {
  if (!report || report.tool !== 'merge-guard' || report.schemaVersion !== 1) throw new ArtifactManifestError('INVALID_REPORT', 'a schema-version 1 Merge Guard report is required');
  const generated = { at: generatedAt, tool: 'merge-guard', toolVersion };
  const contentHashes = { report: sha256(report), configuration: sha256(evidence.configuration), evidence: sha256(evidence) };
  const draft = { schemaVersion: ARTIFACT_MANIFEST_SCHEMA_VERSION, generated, evidence, contentHashes, report: { schemaVersion: report.schemaVersion, contentHash: contentHashes.report } };
  const manifest = { ...draft, artifactId: sha256(draft) };
  const diagnostics = validateInputs(manifest);
  if (diagnostics.length) throw new ArtifactManifestError('INVALID_MANIFEST_INPUT', 'manifest inputs are incomplete or invalid', diagnostics);
  return Object.freeze(manifest);
}

export function validateArtifactManifest(manifest, { report = null } = {}) {
  const diagnostics = validateInputs(manifest);
  if (diagnostics.length) return { valid: false, diagnostics };
  const expectedHashes = {
    report: manifest.contentHashes.report,
    configuration: sha256(manifest.evidence.configuration),
    evidence: sha256(manifest.evidence)
  };
  if (expectedHashes.configuration !== manifest.contentHashes.configuration) diagnostics.push(diagnostic('$.contentHashes.configuration', 'hash-mismatch', 'configuration hash does not match evidence'));
  if (expectedHashes.evidence !== manifest.contentHashes.evidence) diagnostics.push(diagnostic('$.contentHashes.evidence', 'hash-mismatch', 'evidence hash does not match evidence'));
  if (report !== null && sha256(report) !== manifest.contentHashes.report) diagnostics.push(diagnostic('$.contentHashes.report', 'hash-mismatch', 'report hash does not match supplied report'));
  if (sha256(identityPayload(manifest)) !== manifest.artifactId) diagnostics.push(diagnostic('$.artifactId', 'identity-mismatch', 'artifactId does not match manifest content'));
  return { valid: diagnostics.length === 0, diagnostics };
}
