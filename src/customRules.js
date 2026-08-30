import { compileSafeRegex } from './safeRegex.js';

export const CUSTOM_RULE_WEIGHT_MIN = 0;
export const CUSTOM_RULE_WEIGHT_MAX = 10;

function uniq(values) {
  return [...new Set(values)];
}

function parseFileChanges(diffText) {
  const changes = [];
  let current = null;

  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      const match = line.match(/^diff --git a\/(.*?) b\/(.*)$/);
      current = match
        ? { path: match[2], addedLines: [] }
        : null;

      if (current) changes.push(current);
      continue;
    }

    if (!current || line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) current.addedLines.push(line.slice(1));
  }

  return changes;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function compilePattern(value, fieldName, ruleId, warnings) {
  const source = nonEmptyString(value);
  if (!source) return null;

  try {
    return compileSafeRegex(source, 'i');
  } catch (error) {
    warnings.push(`Custom rule ${ruleId} ignored: unsafe or invalid ${fieldName} (${error.message}).`);
    return false;
  }
}

export function normalizeCustomRules(customRules) {
  const warnings = [];
  const rules = [];
  const seenIds = new Set();

  if (customRules === undefined) {
    return { rules, warnings };
  }

  if (!Array.isArray(customRules)) {
    return {
      rules,
      warnings: ['customRules ignored: expected an array in merge-guard.config.json.']
    };
  }

  for (const [index, candidate] of customRules.entries()) {
    const fallbackId = `index-${index}`;

    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      warnings.push(`Custom rule ${fallbackId} ignored: expected an object.`);
      continue;
    }

    const id = nonEmptyString(candidate.id);
    const label = nonEmptyString(candidate.label);
    const check = nonEmptyString(candidate.check) || 'Review the custom-rule match before merging.';
    const weight = candidate.weight;

    if (!id || !label) {
      warnings.push(`Custom rule ${id || fallbackId} ignored: id and label are required.`);
      continue;
    }

    if (seenIds.has(id)) {
      warnings.push(`Custom rule ${id} ignored: duplicate rule id; define each id only once.`);
      continue;
    }

    if (
      typeof weight !== 'number'
      || !Number.isInteger(weight)
      || weight < CUSTOM_RULE_WEIGHT_MIN
      || weight > CUSTOM_RULE_WEIGHT_MAX
    ) {
      warnings.push(
        `Custom rule ${id} ignored: weight must be an integer from ${CUSTOM_RULE_WEIGHT_MIN} to ${CUSTOM_RULE_WEIGHT_MAX}; negative and non-finite weights are not allowed.`
      );
      continue;
    }

    seenIds.add(id);

    const pathPattern = compilePattern(candidate.pathPattern, 'pathPattern', id, warnings);
    const linePattern = compilePattern(candidate.linePattern, 'linePattern', id, warnings);

    if (pathPattern === false || linePattern === false) continue;
    if (!pathPattern && !linePattern) {
      warnings.push(`Custom rule ${id} ignored: pathPattern or linePattern is required.`);
      continue;
    }

    rules.push({
      id,
      label,
      weight,
      check,
      pathPattern,
      linePattern,
      pathPatternSource: nonEmptyString(candidate.pathPattern),
      linePatternSource: nonEmptyString(candidate.linePattern)
    });
  }

  return { rules, warnings };
}

function matchCustomRule(rule, changes, scopePaths = null, pathAliases = {}) {
  const matchedFiles = [];
  let matchedLineCount = 0;

  for (const change of changes) {
    if (scopePaths && !scopePaths.has(change.path)) continue;
    const matchPath = typeof pathAliases[change.path] === 'string'
      ? pathAliases[change.path]
      : change.path;
    const pathMatches = !rule.pathPattern || rule.pathPattern.test(matchPath);
    const matchingLines = rule.linePattern
      ? change.addedLines.filter((line) => rule.linePattern.test(line))
      : change.addedLines;
    const lineMatches = !rule.linePattern || matchingLines.length > 0;

    if (pathMatches && lineMatches) {
      matchedFiles.push(change.path);
      matchedLineCount += rule.linePattern ? matchingLines.length : 0;
    }
  }

  return {
    matched: matchedFiles.length > 0,
    matchedFiles: uniq(matchedFiles),
    matchedLineCount
  };
}

function levelFromScore(score, config) {
  if (score >= config.failThreshold) return 'HIGH';
  if (score >= config.reviewThreshold) return 'MEDIUM';
  return 'LOW';
}

function readinessFromScore(score, config) {
  if (score >= config.failThreshold) return 'DO_NOT_MERGE_YET';
  if (score >= config.reviewThreshold) return 'NEEDS_REVIEW';
  return 'SAFE_TO_MERGE';
}

function reviewDecisionFromScore(score, config) {
  if (score >= config.failThreshold) return 'CONFIGURED_BLOCKER_FOUND';
  if (score >= config.reviewThreshold) return 'REVIEW_RECOMMENDED';
  return 'NO_CONFIGURED_BLOCKERS';
}

function updateFileBreakdown(report, hit) {
  if (!Array.isArray(report.files)) return;

  for (const file of report.files) {
    if (!hit.matchedFiles.includes(file.path)) continue;

    file.riskScore = Math.max(0, file.riskScore + hit.weight);
    file.riskLevel = levelFromScore(file.riskScore, report.config);
    file.flags = uniq([...(file.flags || []), hit.label]);
    file.rules = [...(file.rules || []), hit];
    file.reason = `${file.reason} ${hit.reason}`.trim();
  }

  const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  report.files.sort((a, b) => {
    const levelDelta = rank[b.riskLevel] - rank[a.riskLevel];
    if (levelDelta !== 0) return levelDelta;
    const scoreDelta = b.riskScore - a.riskScore;
    if (scoreDelta !== 0) return scoreDelta;
    return a.path.localeCompare(b.path);
  });
}

export function applyCustomRules(report, diffText, customRules, options = {}) {
  const normalized = normalizeCustomRules(customRules);
  const changes = parseFileChanges(diffText);
  const idPrefix = typeof options.idPrefix === 'string' ? options.idPrefix : 'custom:';
  const custom = options.custom === undefined ? true : Boolean(options.custom);
  const warningsField = options.warningsField === undefined ? 'customRuleWarnings' : options.warningsField;
  const configField = options.configField === undefined ? 'customRules' : options.configField;
  const hitMetadata = options.hitMetadata && typeof options.hitMetadata === 'object'
    ? options.hitMetadata
    : {};
  const reasonContext = nonEmptyString(options.reasonContext);
  const scopePaths = Array.isArray(options.scopePaths)
    ? new Set(options.scopePaths.filter((filePath) => typeof filePath === 'string'))
    : null;
  const pathAliases = options.pathAliases && typeof options.pathAliases === 'object'
    ? options.pathAliases
    : {};

  if (warningsField) report[warningsField] = normalized.warnings;
  if (configField) {
    report.config[configField] = normalized.rules.map((rule) => ({
      id: rule.id,
      label: rule.label,
      weight: rule.weight,
      pathPattern: rule.pathPatternSource,
      linePattern: rule.linePatternSource,
      check: rule.check
    }));
  }

  for (const rule of normalized.rules) {
    const match = matchCustomRule(rule, changes, scopePaths, pathAliases);
    if (!match.matched) continue;

    const patternSummary = [
      rule.pathPatternSource ? `pathPattern /${rule.pathPatternSource}/` : null,
      rule.linePatternSource ? `linePattern /${rule.linePatternSource}/` : null
    ].filter(Boolean).join(' and ');

    const hit = {
      id: `${idPrefix}${rule.id}`,
      custom,
      ...hitMetadata,
      label: rule.label,
      weight: rule.weight,
      reason: `${rule.label} because ${match.matchedFiles.join(', ')} matched ${patternSummary}${reasonContext ? ` from ${reasonContext}` : ''}.`,
      check: rule.check,
      matchedFiles: match.matchedFiles,
      matchedLineCount: match.matchedLineCount
    };

    report.rules = [...(report.rules || []), hit];
    report.flags = uniq([...(report.flags || []), rule.label]);
    report.suggestedChecks = uniq([...(report.suggestedChecks || []), rule.check]);
    report.riskScore = Math.max(0, report.riskScore + rule.weight);
    updateFileBreakdown(report, hit);
  }

  report.riskLevel = levelFromScore(report.riskScore, report.config);
  report.reviewDecision = reviewDecisionFromScore(report.riskScore, report.config);
  report.mergeReadiness = readinessFromScore(report.riskScore, report.config);

  return report;
}

export function appendCustomRuleWarnings(output, warnings, mode = 'text') {
  if (!Array.isArray(warnings) || warnings.length === 0) return output;

  if (mode === 'markdown') {
    return `${output}\n\n## Custom rule warnings\n\n${warnings.map((warning) => `- ${warning}`).join('\n')}`;
  }

  return `${output}\n\nCustom rule warnings:\n${warnings.map((warning) => `- ${warning}`).join('\n')}`;
}
