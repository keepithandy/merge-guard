import fs from 'node:fs';
import path from 'node:path';

const FILENAME = 'merge-guard.config.json';
const PRESETS = new Set(['safe', 'standard', 'strict']);

// Explicit local setup only: no repository discovery, license checks, network,
// package installation, project commands, workflow creation or overwrites.
export function initializeConfig(args, { cwd = process.cwd() } = {}) {
  let preset = 'standard';
  let dryRun = false;
  let presetSeen = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--dry-run' && !dryRun) {
      dryRun = true;
    } else if (args[index] === '--preset' && !presetSeen) {
      presetSeen = true;
      const selected = args[++index];
      if (typeof selected !== 'string' || !PRESETS.has(selected.trim().toLowerCase())) {
        throw new Error('init --preset requires safe, standard, or strict.');
      }
      preset = selected.trim().toLowerCase();
    } else {
      throw new Error('Usage: merge-guard init [--preset <safe|standard|strict>] [--dry-run]');
    }
  }

  // Omitted fields retain the scanner's existing defaults. In particular, do
  // not replace built-in risky paths/checks with guessed or empty lists.
  const contents = JSON.stringify({ preset }, null, 2) + '\n';
  const next = '\nNext: git diff | merge-guard\nCheck setup: merge-guard --doctor';
  if (dryRun) return `Would create ${FILENAME}:\n${contents}No files written.${next}`;

  const file = path.join(cwd, FILENAME);
  let fd;
  let created;
  try {
    // Exclusive creation also refuses directories and dangling symlinks.
    fd = fs.openSync(file, 'wx', 0o600);
    created = fs.fstatSync(fd);
    fs.writeFileSync(fd, contents, 'utf8');
    fs.fsyncSync(fd);
  } catch (error) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* preserve the creation failure */ }
      fd = undefined;
      try {
        const current = fs.lstatSync(file);
        if (current.isFile() && !current.isSymbolicLink() && created
            && current.dev === created.dev && current.ino === created.ino) {
          fs.unlinkSync(file);
        }
      } catch { /* cleanup must never follow or remove a different path */ }
    }
    if (error.code === 'EEXIST') {
      throw new Error(`${FILENAME} already exists. Review or edit it manually; init never overwrites it.`);
    }
    throw new Error(`Could not create ${FILENAME}. Check directory permissions and available storage.`);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  return `Created ${FILENAME} with the ${preset} preset.${next}`;
}
