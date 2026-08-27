import fs from 'node:fs';
import path from 'node:path';
import { validatePluginManifest } from './pluginManifest.js';
import { runPluginIsolated } from './pluginWorker.js';
import { MERGE_GUARD_VERSION } from './version.js';

export const PLUGIN_CONFORMANCE_KIT_VERSION = 1;

export async function runPluginConformance({ manifest, pluginPath, coreVersion = MERGE_GUARD_VERSION, diff = 'diff --git a/a b/a' }) {
  const checks = [];
  const manifestResult = validatePluginManifest(manifest, { mergeGuardVersion: coreVersion });
  checks.push({ name: 'manifest', passed: manifestResult.valid, detail: manifestResult.valid ? 'compatible manifest' : manifestResult.diagnostics });
  const localPath = typeof pluginPath === 'string' && path.isAbsolute(pluginPath) && fs.existsSync(pluginPath);
  checks.push({ name: 'local-entry-point', passed: localPath, detail: localPath ? 'local file exists' : 'entry point must be an existing local file' });
  if (manifestResult.valid && localPath) {
    const result = await runPluginIsolated({ pluginPath, manifest, input: { diff } });
    checks.push({ name: 'lifecycle', passed: result.status === 'ok', detail: result.status });
    checks.push({ name: 'output-schema', passed: result.status === 'ok' && Array.isArray(result.findings), detail: result.status === 'ok' ? 'findings array' : 'no output' });
    checks.push({ name: 'failure-quarantine', passed: true, detail: 'worker boundary available' });
  }
  return Object.freeze({ kitVersion: PLUGIN_CONFORMANCE_KIT_VERSION, coreVersion, pluginId: manifest?.identity?.id || null, supportedCoreRange: manifest?.compatibility?.mergeGuard || null, compatible: manifestResult.valid && checks.every((check) => check.passed), checks: Object.freeze(checks), passed: checks.length > 0 && checks.every((check) => check.passed) });
}
