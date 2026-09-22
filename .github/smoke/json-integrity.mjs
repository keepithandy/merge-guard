import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);
const failures = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (extname(entry.name).toLowerCase() !== '.json') continue;
    try {
      JSON.parse(await readFile(full, 'utf8'));
    } catch (error) {
      failures.push(`${full.slice(ROOT.length + 1)}: ${error.message}`);
    }
  }
}

await walk(ROOT);
if (failures.length) {
  console.error(`Invalid JSON found:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('smoke:json-integrity passed');
