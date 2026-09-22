import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);
const TEXT_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.html', '.css', '.md', '.yml', '.yaml', '.txt', '.py', '.sh', '.ps1']);
const failures = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!TEXT_EXTS.has(extname(entry.name).toLowerCase())) continue;
    const data = await readFile(full);
    if (data.includes(0)) failures.push(full.slice(ROOT.length + 1));
  }
}

await walk(ROOT);
if (failures.length) {
  console.error(`NUL bytes found in text files: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('smoke:no-nul-text passed');
