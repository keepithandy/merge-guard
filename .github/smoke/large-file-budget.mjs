import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);
const LIMIT = 90 * 1024 * 1024;
const failures = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    const size = (await stat(full)).size;
    if (size > LIMIT) failures.push(`${full.slice(ROOT.length + 1)} (${(size / 1024 / 1024).toFixed(1)} MiB)`);
  }
}

await walk(ROOT);
if (failures.length) {
  console.error(`Files exceed the 90 MiB repository smoke budget:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('smoke:large-file-budget passed');
