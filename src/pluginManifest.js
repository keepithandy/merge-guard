export const PLUGIN_MANIFEST_SCHEMA_VERSION = 1;
export const PLUGIN_API_VERSION = 1;
const HASH = /^[a-f0-9]{64}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const PERMISSIONS = new Set(['read-diff', 'read-report']);

function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function issue(path, code, message) { return { path, code, message }; }
function compare(left, right) { const a = left.split('.').map(Number); const b = right.split('.').map(Number); return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; }

export function validatePluginManifest(manifest, { mergeGuardVersion = '0.1.0', pluginApiVersion = PLUGIN_API_VERSION } = {}) {
  const diagnostics = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return { valid: false, diagnostics: [issue('$', 'malformed-manifest', 'manifest must be an object')] };
  if (manifest.schemaVersion !== PLUGIN_MANIFEST_SCHEMA_VERSION) diagnostics.push(issue('$.schemaVersion', manifest.schemaVersion > PLUGIN_MANIFEST_SCHEMA_VERSION ? 'future-schema' : 'unsupported-schema', 'only plugin manifest schema version 1 is supported'));
  const identity = manifest.identity;
  if (!identity || !text(identity.id) || !text(identity.name) || !VERSION.test(identity.version || '')) diagnostics.push(issue('$.identity', 'incomplete-identity', 'id, name, and semantic version are required'));
  const compatibility = manifest.compatibility;
  if (!compatibility || compatibility.pluginApiVersion !== pluginApiVersion || !compatibility.mergeGuard || !VERSION.test(compatibility.mergeGuard.min || '') || !VERSION.test(compatibility.mergeGuard.maxExclusive || '')) diagnostics.push(issue('$.compatibility', 'incompatible-plugin', 'plugin API and Merge Guard compatibility range are required'));
  else if (compare(mergeGuardVersion, compatibility.mergeGuard.min) < 0 || compare(mergeGuardVersion, compatibility.mergeGuard.maxExclusive) >= 0) diagnostics.push(issue('$.compatibility.mergeGuard', 'incompatible-plugin', 'plugin is not compatible with this Merge Guard version'));
  const entryPoint = text(manifest.entryPoint);
  if (!entryPoint || !entryPoint.startsWith('./') || entryPoint.includes('..') || /https?:\/\//i.test(entryPoint)) diagnostics.push(issue('$.entryPoint', 'invalid-entry-point', 'entryPoint must be a relative local path and cannot be a URL'));
  if (manifest.explicitInstallation !== true) diagnostics.push(issue('$.explicitInstallation', 'explicit-install-required', 'plugins must be explicitly installed by the user'));
  if (!Array.isArray(manifest.permissions) || manifest.permissions.some((permission) => !PERMISSIONS.has(permission))) diagnostics.push(issue('$.permissions', 'invalid-permissions', 'permissions must be a list of supported read capabilities'));
  if (!manifest.checksums || !HASH.test(manifest.checksums.entryPointSha256 || '')) diagnostics.push(issue('$.checksums.entryPointSha256', 'missing-checksum', 'entry point SHA-256 checksum is required'));
  if (!manifest.checks || manifest.checks.deterministic !== true || !Number.isInteger(manifest.checks.timeoutMs) || manifest.checks.timeoutMs < 1 || !Number.isInteger(manifest.checks.maxFindings) || manifest.checks.maxFindings < 1) diagnostics.push(issue('$.checks', 'invalid-checks', 'deterministic checks, timeout, and finding limits are required'));
  return { valid: diagnostics.length === 0, diagnostics };
}
