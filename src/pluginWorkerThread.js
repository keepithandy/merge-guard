import { workerData, parentPort } from 'node:worker_threads';

try {
  const plugin = await import(workerData.pluginUrl);
  const analyze = plugin.analyze || plugin.default;
  if (typeof analyze !== 'function') throw new Error('plugin must export analyze(input)');
  const result = await analyze(Object.freeze(workerData.input));
  parentPort.postMessage({ status: 'ok', findings: result?.findings });
} catch (error) {
  parentPort.postMessage({ status: 'error', reason: error instanceof Error ? error.message : 'plugin failed' });
}
