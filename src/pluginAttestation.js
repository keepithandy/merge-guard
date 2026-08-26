import { canonicalJson, sha256 } from './artifactManifest.js';
import { validatePluginManifest } from './pluginManifest.js';

export const PLUGIN_ATTESTATION_SCHEMA_VERSION = 1;
const HASH = /^[a-f0-9]{64}$/;

export class PluginAttestationError extends Error {
  constructor(code, message) { super(message); this.name = 'PluginAttestationError'; this.code = code; }
}

function identityPayload(attestation) { const { attestationId, ...rest } = attestation; return rest; }

export function createPluginAttestation({ coreVersion, manifest, source, configuration, input, findings, createdAt }) {
  const validation = validatePluginManifest(manifest, { mergeGuardVersion: coreVersion });
  if (!validation.valid) throw new PluginAttestationError('INVALID_MANIFEST', 'cannot attest an invalid plugin manifest');
  if (typeof source !== 'string' || !source || !createdAt) throw new PluginAttestationError('INCOMPLETE_INPUT', 'source and createdAt are required');
  const attestation = {
    schemaVersion: PLUGIN_ATTESTATION_SCHEMA_VERSION,
    createdAt,
    core: { tool: 'merge-guard', version: coreVersion },
    plugin: { id: manifest.identity.id, version: manifest.identity.version, manifestSha256: sha256(manifest), sourceSha256: sha256(source) },
    configurationSha256: sha256(configuration),
    input: { kind: manifest.permissions.includes('read-diff') && typeof input === 'string' ? 'diff' : 'report', sha256: sha256(input) },
    output: { findingsSha256: sha256(findings), findingsCount: Array.isArray(findings) ? findings.length : null }
  };
  return Object.freeze({ ...attestation, attestationId: sha256(attestation) });
}

export function verifyPluginAttestation(attestation, { manifest, source, configuration, input, findings } = {}) {
  const errors = [];
  if (!attestation || attestation.schemaVersion !== PLUGIN_ATTESTATION_SCHEMA_VERSION) errors.push('unsupported or missing attestation schema');
  if (!HASH.test(attestation?.attestationId || '') || sha256(identityPayload(attestation)) !== attestation?.attestationId) errors.push('attestation identity mismatch');
  if (!attestation?.core || attestation.core.tool !== 'merge-guard' || typeof attestation.core.version !== 'string') errors.push('missing core identity');
  if (!attestation?.plugin || !HASH.test(attestation.plugin.manifestSha256 || '') || !HASH.test(attestation.plugin.sourceSha256 || '')) errors.push('missing plugin hashes');
  if (manifest && sha256(manifest) !== attestation.plugin.manifestSha256) errors.push('plugin manifest hash mismatch');
  if (typeof source === 'string' && sha256(source) !== attestation.plugin.sourceSha256) errors.push('plugin source hash mismatch');
  if (configuration !== undefined && sha256(configuration) !== attestation.configurationSha256) errors.push('configuration hash mismatch');
  if (input !== undefined && sha256(input) !== attestation.input?.sha256) errors.push('input hash mismatch');
  if (findings !== undefined && sha256(findings) !== attestation.output?.findingsSha256) errors.push('output hash mismatch');
  return { valid: errors.length === 0, errors };
}
