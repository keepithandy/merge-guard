import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validatePluginManifest } from './pluginManifest.js';

const MAX_OUTPUT_BYTES = 1024 * 1024;

export function runPluginIsolated({ pluginPath, manifest, input }) {
  const validation = validatePluginManifest(manifest);
  if (!validation.valid) return Promise.resolve({ status: 'rejected', reason: 'invalid-manifest', diagnostics: validation.diagnostics });
  if (typeof pluginPath !== 'string' || !path.isAbsolute(pluginPath)) return Promise.resolve({ status: 'rejected', reason: 'explicit-local-path-required', diagnostics: [] });
  const permittedInput = {};
  if (manifest.permissions.includes('read-diff') && typeof input?.diff === 'string') permittedInput.diff = input.diff;
  if (manifest.permissions.includes('read-report') && input?.report && typeof input.report === 'object') permittedInput.report = structuredClone(input.report);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => { if (!settled) { settled = true; resolve(result); } };
    const worker = new Worker(new URL('./pluginWorkerThread.js', import.meta.url), {
      workerData: { pluginUrl: pathToFileURL(pluginPath).href, input: permittedInput },
      resourceLimits: { maxOldGenerationSizeMb: 16, maxYoungGenerationSizeMb: 4, codeRangeSizeMb: 8 }
    });
    const timeout = setTimeout(() => { worker.terminate(); finish({ status: 'timeout', reason: 'plugin exceeded declared timeout' }); }, manifest.checks.timeoutMs);
    worker.on('message', (message) => {
      clearTimeout(timeout);
      if (!message || message.status !== 'ok' || !Array.isArray(message.findings)) return finish({ status: 'quarantined', reason: 'malformed-output' });
      if (message.findings.length > manifest.checks.maxFindings) return finish({ status: 'quarantined', reason: 'finding-limit-exceeded' });
      let outputBytes;
      try { outputBytes = Buffer.byteLength(JSON.stringify(message.findings), 'utf8'); } catch { return finish({ status: 'quarantined', reason: 'unserializable-output' }); }
      if (outputBytes > MAX_OUTPUT_BYTES) return finish({ status: 'quarantined', reason: 'output-size-limit-exceeded' });
      finish({ status: 'ok', findings: Object.freeze(message.findings) });
    });
    worker.on('error', (error) => { clearTimeout(timeout); finish({ status: 'crashed', reason: error.message }); });
    worker.on('exit', (code) => { clearTimeout(timeout); if (code !== 0) finish({ status: 'crashed', reason: `plugin worker exited with code ${code}` }); });
  });
}
