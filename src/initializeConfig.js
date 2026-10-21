import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

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
  const temporary = path.join(cwd, `.merge-guard-init-${randomUUID()}.tmp`);
  let fd;
  let created;
  let published = false;
  let cleanupFailed = false;
  try {
    if (fs.lstatSync(file, { throwIfNoEntry: false })) {
      const exists = new Error('Existing configuration path.');
      exists.code = 'EEXIST';
      throw exists;
    }
    fd = fs.openSync(temporary, 'wx', 0o600);
    created = fs.fstatSync(fd);
    fs.writeFileSync(fd, contents, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    // link is an atomic no-replace publication on Windows and POSIX. Opening
    // the final name with wx alone can follow a dangling link on Windows.
    // Never fall back to rename (which overwrites) or a target-path write.
    fs.linkSync(temporary, file);
    published = true;
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(`${FILENAME} already exists. Review or edit it manually; init never overwrites it.`);
    }
    throw new Error(`Could not safely create ${FILENAME}. Check permissions/storage; use --dry-run for a manual setup.`);
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* preserve the original error */ }
    }
    if (created) {
      try {
        const current = fs.lstatSync(temporary);
        if (current.isFile() && !current.isSymbolicLink()
            && current.dev === created.dev && current.ino === created.ino) {
          fs.unlinkSync(temporary);
        } else cleanupFailed = true;
      } catch { cleanupFailed = true; }
    }
  }
  const warning = published && cleanupFailed ? '\nWarning: review the leftover .merge-guard-init-*.tmp setup file.' : '';
  return `Created ${FILENAME} with the ${preset} preset.${warning}${next}`;
}
