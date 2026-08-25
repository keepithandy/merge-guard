import { DashboardImportError, validateDashboardImportBatch } from './import-contract.js';

self.addEventListener('message', ({ data }) => {
  try {
    const imports = validateDashboardImportBatch(data.items.map((item) => ({ name: item.name, bytes: new Uint8Array(item.bytes) })));
    self.postMessage({ ok: true, imports });
  } catch (error) {
    const category = error instanceof DashboardImportError ? error.category : 'malformed-input';
    self.postMessage({ ok: false, error: { category, message: error.message } });
  }
});
