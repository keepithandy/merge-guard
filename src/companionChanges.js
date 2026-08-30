import { compileSafeRegex } from './safeRegex.js';

function pathsFromDiff(diffText) {
  return [...diffText.matchAll(/^diff --git a\/(.*?) b\/(.*?)$/gm)].map((match) => match[2]);
}

function clean(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function evaluateCompanionChanges(diffText, contracts = []) {
  const paths = pathsFromDiff(typeof diffText === 'string' ? diffText : '');
  const results = [];
  for (const contract of Array.isArray(contracts) ? contracts : []) {
    const id = clean(contract?.id);
    const trigger = clean(contract?.trigger);
    const companions = Array.isArray(contract?.companions) ? contract.companions.filter(clean) : [];
    if (!id || !trigger || !companions.length) continue;
    let triggerPattern;
    try { triggerPattern = compileSafeRegex(trigger, 'i'); } catch { continue; }
    const triggeredBy = paths.filter((path) => triggerPattern.test(path));
    if (!triggeredBy.length) continue;
    const missing = companions.filter((companion) => {
      try {
        const pattern = compileSafeRegex(companion, 'i');
        return !paths.some((path) => pattern.test(path));
      } catch { return false; }
    });
    results.push({ id, status: missing.length ? 'missing' : 'satisfied', triggeredBy, missing });
  }
  return results;
}
