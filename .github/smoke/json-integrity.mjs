import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);
const INTENTIONAL_INVALID_JSON_DIRS = new Set(['test/fixtures']);
const failures = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    const repoPath = relative(ROOT, full).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      if (INTENTIONAL_INVALID_JSON_DIRS.has(repoPath)) continue;
      await walk(full);
      continue;
    }
    if (extname(entry.name).toLowerCase() !== '.json') continue;
    try {
      JSON.parse(await readFile(full, 'utf8'));
    } catch (error) {
      failures.push(`${repoPath}: ${error.message}`);
    }
  }
}

await walk(ROOT);
if (failures.length) {
  console.error(`Invalid JSON found:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('smoke:json-integrity passed');
