function uniq(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function parseDiffLines(diffText) {
  const lines = [];
  let currentPath = null;

  for (const line of (typeof diffText === 'string' ? diffText : '').split(/\r?\n/)) {
    const header = line.match(/^diff --git a\/(.*?) b\/(.*)$/);
    if (header) {
      currentPath = header[2];
      continue;
    }
    if (!currentPath || line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) lines.push({ path: currentPath, kind: 'added', text: line.slice(1) });
    if (line.startsWith('-')) lines.push({ path: currentPath, kind: 'removed', text: line.slice(1) });
  }

  return lines;
}

function collectMatches(lines, expression) {
  const result = { added: [], removed: [] };

  for (const line of lines) {
    expression.lastIndex = 0;
    let match;
    while ((match = expression.exec(line.text)) !== null) {
      result[line.kind].push(match[2]);
    }
  }

  return {
    added: uniq(result.added),
    removed: uniq(result.removed)
  };
}

function changedValues(values) {
  return values.removed.filter((value) => !values.added.includes(value));
}

function migrationPaths(lines) {
  return uniq(lines
    .map((line) => line.path)
    .filter((path) => /(^|\/)(?:migration|migrations)(?:\/|[._-])/i.test(path)));
}

function hasMigrationCall(lines) {
  return lines.some((line) => line.kind === 'added' && /\bmigrat(?:e|ion)\w*\s*\(/i.test(line.text));
}

export function inspectBrowserGameSaveCompatibility(diffText) {
  const lines = parseDiffLines(diffText);
  const storageKeys = collectMatches(
    lines,
    /(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\s*\(\s*(['"])([^'"]{1,120})\1/g
  );
  const saveVersions = collectMatches(
    lines,
    /\b(?:SAVE_VERSION|saveVersion|save_version)\b\s*(?:=|:)\s*(['"]?)([0-9]+(?:\.[0-9]+)*)\1/gi
  );
  const removedStorageKeys = changedValues(storageKeys);
  const removedSaveVersions = changedValues(saveVersions);
  const versionChanged = removedSaveVersions.length > 0 && saveVersions.added.length > 0;
  const paths = migrationPaths(lines);
  const migrationPresent = paths.length > 0 || hasMigrationCall(lines);
  const concerns = [];
  const checks = [];

  if (removedStorageKeys.length) {
    concerns.push({
      id: 'storage-key-removed-or-renamed',
      message: `Changed lines stop using persisted storage key(s): ${removedStorageKeys.join(', ')}.`
    });
    checks.push('Verify saves stored under the previous key still load or migrate before writing the new key.');
  }

  if (versionChanged) {
    checks.push('Load a pre-change save and verify it migrates to the new save version without losing progress.');
    if (!migrationPresent) {
      concerns.push({
        id: 'save-version-change-without-migration',
        message: `Save version changed from ${removedSaveVersions.join(', ')} to ${saveVersions.added.join(', ')} without migration evidence in the diff.`
      });
    }
  }

  const observed = storageKeys.added.length > 0
    || storageKeys.removed.length > 0
    || saveVersions.added.length > 0
    || saveVersions.removed.length > 0;
  const status = concerns.length
    ? 'review-required'
    : versionChanged && migrationPresent
      ? 'migration-present'
      : observed ? 'observed' : 'not-detected';

  return {
    schemaVersion: 1,
    status,
    storageKeys,
    saveVersions,
    migrationEvidence: {
      present: migrationPresent,
      paths
    },
    concerns,
    checks: uniq(checks)
  };
}

export function applyBrowserGameSaveCompatibility(report, diffText) {
  const evidence = inspectBrowserGameSaveCompatibility(diffText);
  report.saveCompatibility = evidence;
  report.suggestedChecks = [
    ...evidence.checks,
    ...(Array.isArray(report.suggestedChecks) ? report.suggestedChecks : [])
  ].filter((check, index, checks) => checks.indexOf(check) === index);
  return report;
}
