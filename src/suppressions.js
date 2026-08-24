const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function warning(path, message) {
  return { path, message, severity: 'warning' };
}

function normalizeSuppressions(value) {
  const warnings = [];
  if (value === undefined) return { suppressions: [], warnings };
  if (!Array.isArray(value)) {
    return { suppressions: [], warnings: [warning('suppressions', 'expected an array of suppression objects')] };
  }

  const suppressions = [];
  const seen = new Set();

  for (const [index, item] of value.entries()) {
    const base = `suppressions[${index}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      warnings.push(warning(base, 'expected an object'));
      continue;
    }

    const id = typeof item.ruleId === 'string' ? item.ruleId.trim() : '';
    const reason = typeof item.reason === 'string' ? item.reason.trim() : '';
    const owner = typeof item.owner === 'string' ? item.owner.trim() : '';
    const expires = typeof item.expires === 'string' ? item.expires.trim() : '';
    const pathPattern = item.pathPattern === undefined ? null : item.pathPattern;

    if (!id) warnings.push(warning(`${base}.ruleId`, 'required non-empty string'));
    if (!reason) warnings.push(warning(`${base}.reason`, 'required non-empty string'));
    if (!owner) warnings.push(warning(`${base}.owner`, 'required non-empty string'));
    if (!DATE_PATTERN.test(expires) || Number.isNaN(Date.parse(`${expires}T00:00:00Z`))) {
      warnings.push(warning(`${base}.expires`, 'required ISO date in YYYY-MM-DD format'));
    }
    if (pathPattern !== null && typeof pathPattern !== 'string') {
      warnings.push(warning(`${base}.pathPattern`, 'must be a string when provided'));
    }

    const key = `${id}|${pathPattern || ''}`;
    if (seen.has(key)) {
      warnings.push(warning(base, 'duplicate suppression ignored'));
      continue;
    }

    if (!id || !reason || !owner || !DATE_PATTERN.test(expires) || (pathPattern !== null && typeof pathPattern !== 'string')) continue;

    let compiledPath = null;
    if (pathPattern) {
      try { compiledPath = new RegExp(pathPattern, 'i'); }
      catch { warnings.push(warning(`${base}.pathPattern`, 'invalid regular expression')); continue; }
    }

    seen.add(key);
    suppressions.push({ ruleId: id, reason, owner, expires, pathPattern, compiledPath });
  }

  return { suppressions, warnings };
}

export function applySuppressions(report, configuredSuppressions, today = new Date()) {
  const normalized = normalizeSuppressions(configuredSuppressions);
  const todayText = today.toISOString().slice(0, 10);
  report.suppressionWarnings = normalized.warnings;
  report.suppressedFindings = [];

  for (const suppression of normalized.suppressions) {
    if (suppression.expires < todayText) {
      report.suppressionWarnings.push(warning(suppression.ruleId, `expired on ${suppression.expires}; finding was not suppressed`));
      continue;
    }

    const matches = (report.rules || []).filter((rule) => {
      if (rule.id !== suppression.ruleId && rule.id !== `custom:${suppression.ruleId}`) return false;
      if (!suppression.compiledPath) return true;
      return (rule.matchedFiles || []).some((file) => suppression.compiledPath.test(file));
    });

    for (const finding of matches) {
      report.suppressedFindings.push({
        ...finding,
        suppression: {
          ruleId: suppression.ruleId,
          reason: suppression.reason,
          owner: suppression.owner,
          expires: suppression.expires,
          pathPattern: suppression.pathPattern
        }
      });
    }
  }

  report.config.suppressions = normalized.suppressions.map(({ ruleId, reason, owner, expires, pathPattern }) => ({
    ruleId, reason, owner, expires, pathPattern
  }));
  return report;
}

export { normalizeSuppressions };
