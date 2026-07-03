const DEFAULT_CONFIG = {
  highRiskPaths: [],
  testCommands: [],
  preset: 'standard',
  failThreshold: 7
};

const RISK_PRESETS = {
  safe: {
    label: 'safe',
    failThreshold: 9,
    reviewThreshold: 4,
    largeChangeLines: 160,
    largeChangeFiles: 10,
    positiveWeightDelta: -1,
    configuredHighRiskWeight: 3,
    missingTestsWeight: 1,
    docsOnlyScoreCap: 1
  },
  standard: {
    label: 'standard',
    failThreshold: 7,
    reviewThreshold: 3,
    largeChangeLines: 120,
    largeChangeFiles: 8,
    positiveWeightDelta: 0,
    configuredHighRiskWeight: 4,
    missingTestsWeight: 2,
    docsOnlyScoreCap: 1
  },
  strict: {
    label: 'strict',
    failThreshold: 5,
    reviewThreshold: 2,
    largeChangeLines: 80,
    largeChangeFiles: 5,
    positiveWeightDelta: 1,
    configuredHighRiskWeight: 5,
    missingTestsWeight: 3,
    docsOnlyScoreCap: 1
  }
};

const RISK_PATTERNS = [
  {
    id: 'state-or-persistence',
    label: 'State or persistence logic changed',
    weight: 3,
    file: /(save|state|store|storage|persist|migration|ledger|cache)/i,
    fileDescription: 'save, state, storage, persistence, migration, ledger, or cache path patterns',
    line: /(localStorage|sessionStorage|save|load|persist|migrate|hydrate|serialize|deserialize)/i,
    lineDescription: 'save/load, storage, migration, hydration, or serialization code patterns',
    check: 'Review save/load behavior and run state-related smoke tests.'
  },
  {
    id: 'dependency-or-config',
    label: 'Dependency or config file changed',
    weight: 2,
    file: /(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|vite\.config|tsconfig|eslint|prettier|webpack|rollup)/i,
    fileDescription: 'dependency, lockfile, build, lint, or formatter config path patterns',
    line: null,
    lineDescription: null,
    check: 'Run install/build checks and verify the app still starts cleanly.'
  },
  {
    id: 'routing-or-entry',
    label: 'Routing or entry-point logic changed',
    weight: 2,
    file: /(route|router|entry|main|index|app)/i,
    fileDescription: 'routing, entry, main, index, or app path patterns',
    line: /(navigate|redirect|route|render|mount|entry)/i,
    lineDescription: 'navigation, routing, render, mount, or entry code patterns',
    check: 'Manually test the affected navigation or app entry path.'
  },
  {
    id: 'async-or-network',
    label: 'Async or network behavior changed',
    weight: 2,
    file: /(api|client|fetch|request|service|worker)/i,
    fileDescription: 'API, client, fetch, request, service, or worker path patterns',
    line: /(fetch|axios|Promise|async|await|setTimeout|setInterval|AbortController)/i,
    lineDescription: 'fetch, promise, async, timer, or abort controller code patterns',
    check: 'Check loading, failure, timeout, and empty-state behavior.'
  },
  {
    id: 'large-change',
    label: 'Large diff size',
    weight: 2,
    file: null,
    fileDescription: null,
    line: null,
    lineDescription: null,
    check: 'Split review into smaller sections or inspect the riskiest files first.'
  },
  {
    id: 'test-change',
    label: 'Tests changed with implementation',
    weight: -1,
    file: /(test|spec|smoke|__tests__)/i,
    fileDescription: 'test, spec, smoke, or __tests__ path patterns',
    line: null,
    lineDescription: null,
    check: 'Confirm the updated tests cover the changed behavior.'
  }
];

function uniq(values) {
  return [...new Set(values)];
}

function uniqById(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    if (seen.has(value.id)) continue;
    seen.add(value.id);
    result.push(value);
  }

  return result;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePreset(value) {
  if (typeof value !== 'string') return DEFAULT_CONFIG.preset;
  const normalized = value.trim().toLowerCase();
  return RISK_PRESETS[normalized] ? normalized : DEFAULT_CONFIG.preset;
}

function normalizeFailThreshold(value, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function normalizeConfig(config = {}) {
  const preset = normalizePreset(config.preset);
  const presetConfig = RISK_PRESETS[preset];

  return {
    highRiskPaths: normalizeStringArray(config.highRiskPaths),
    testCommands: normalizeStringArray(config.testCommands),
    preset,
    presetLabel: presetConfig.label,
    reviewThreshold: presetConfig.reviewThreshold,
    failThreshold: normalizeFailThreshold(config.failThreshold, presetConfig.failThreshold),
    largeChangeLines: presetConfig.largeChangeLines,
    largeChangeFiles: presetConfig.largeChangeFiles,
    positiveWeightDelta: presetConfig.positiveWeightDelta,
    configuredHighRiskWeight: presetConfig.configuredHighRiskWeight,
    missingTestsWeight: presetConfig.missingTestsWeight,
    docsOnlyScoreCap: presetConfig.docsOnlyScoreCap
  };
}

function parseFileChanges(diffText) {
  const changes = [];
  let current = null;

  for (const line of diffText.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const match = line.match(/^diff --git a\/(.*?) b\/(.*)$/);
      if (match) {
        current = {
          path: match[2],
          addedLines: [],
          removedLines: [],
          addedLinesCount: 0,
          removedLinesCount: 0
        };
        changes.push(current);
      } else {
        current = null;
      }
      continue;
    }

    if (!current) continue;
    if (line.startsWith('+++') || line.startsWith('---')) continue;

    if (line.startsWith('+')) {
      current.addedLinesCount += 1;
      current.addedLines.push(line.slice(1));
    } else if (line.startsWith('-')) {
      current.removedLinesCount += 1;
      current.removedLines.push(line.slice(1));
    }
  }

  return mergeDuplicateFileChanges(changes);
}

function mergeDuplicateFileChanges(changes) {
  const byPath = new Map();

  for (const change of changes) {
    if (!byPath.has(change.path)) {
      byPath.set(change.path, { ...change, addedLines: [...change.addedLines], removedLines: [...change.removedLines] });
      continue;
    }

    const existing = byPath.get(change.path);
    existing.addedLines.push(...change.addedLines);
    existing.removedLines.push(...change.removedLines);
    existing.addedLinesCount += change.addedLinesCount;
    existing.removedLinesCount += change.removedLinesCount;
  }

  return [...byPath.values()];
}

function parseChangedFiles(diffText) {
  return parseFileChanges(diffText).map((change) => change.path);
}

function countChangedLines(diffText) {
  const changes = parseFileChanges(diffText);
  return {
    added: changes.reduce((sum, change) => sum + change.addedLinesCount, 0),
    removed: changes.reduce((sum, change) => sum + change.removedLinesCount, 0)
  };
}

function collectAddedLines(diffText) {
  return parseFileChanges(diffText).flatMap((change) => change.addedLines);
}

function isTestFile(file) {
  return /(test|spec|smoke|__tests__)/i.test(file);
}

function isDocsFile(file) {
  return /(^|\/)(README|CHANGELOG|LICENSE|CONTRIBUTING|CODE_OF_CONDUCT)(\.[^.]+)?$/i.test(file)
    || /(^|\/)docs?\//i.test(file)
    || /^examples\//i.test(file)
    || /\.(md|mdx|rst|txt|adoc)$/i.test(file);
}

function isCommentOrWhitespaceLine(line) {
  const trimmed = line.trim();
  return trimmed === ''
    || trimmed.startsWith('//')
    || trimmed.startsWith('#')
    || trimmed.startsWith('*')
    || trimmed.startsWith('/*')
    || trimmed.startsWith('*/')
    || trimmed.startsWith('<!--')
    || trimmed.startsWith('-->');
}

function hasOnlyCommentChanges(change) {
  const changedLines = [...change.addedLines, ...change.removedLines];
  return changedLines.length > 0 && changedLines.every(isCommentOrWhitespaceLine);
}

function isDocsOnlyChange(changes) {
  return changes.length > 0 && changes.every((change) => isDocsFile(change.path) || hasOnlyCommentChanges(change));
}

function isImplementationFile(file) {
  return !isDocsFile(file) && !isTestFile(file);
}

function adjustedWeight(weight, config) {
  if (weight <= 0) return weight;
  return Math.max(1, weight + config.positiveWeightDelta);
}

function commaList(values) {
  return values.length ? values.join(', ') : 'none';
}

function lineMatchCount(lines, pattern) {
  if (!pattern) return 0;
  return lines.filter((line) => pattern.test(line)).length;
}

function matchRiskPattern(pattern, files, addedLines, totals, config) {
  if (pattern.id === 'large-change') {
    const lineCount = totals.added + totals.removed;
    const matched = lineCount >= config.largeChangeLines || files.length >= config.largeChangeFiles;
    return {
      matched,
      reason: matched
        ? `${lineCount} changed line(s) or ${files.length} file(s) met the ${config.preset} preset large-change threshold.`
        : '',
      matchedFiles: [],
      matchedLineCount: 0
    };
  }

  const matchedFiles = pattern.file ? files.filter((file) => pattern.file.test(file)) : [];
  const matchedLineCount = lineMatchCount(addedLines, pattern.line);
  const reasons = [];

  if (matchedFiles.length) {
    reasons.push(`${commaList(matchedFiles)} matched ${pattern.fileDescription}.`);
  }

  if (matchedLineCount) {
    reasons.push(`${matchedLineCount} added line(s) matched ${pattern.lineDescription}.`);
  }

  return {
    matched: Boolean(matchedFiles.length || matchedLineCount),
    reason: reasons.join(' '),
    matchedFiles,
    matchedLineCount
  };
}

function configuredHighRiskFiles(files, config) {
  return files.filter((file) =>
    config.highRiskPaths.some((highRiskPath) => file.startsWith(highRiskPath))
  );
}

function makeRuleHit({ id, label, weight, reason, check, matchedFiles = [], matchedLineCount = 0 }) {
  return {
    id,
    label,
    weight,
    reason,
    check,
    matchedFiles,
    matchedLineCount
  };
}

function scoreRisk(diffText, changes, config) {
  const files = changes.map((change) => change.path);
  const addedLines = changes.flatMap((change) => change.addedLines);
  const totals = {
    added: changes.reduce((sum, change) => sum + change.addedLinesCount, 0),
    removed: changes.reduce((sum, change) => sum + change.removedLinesCount, 0)
  };
  const docsOnly = isDocsOnlyChange(changes);
  const ruleHits = [];
  const checks = [];
  let score = 0;

  for (const pattern of RISK_PATTERNS) {
    if (docsOnly && pattern.id !== 'test-change') continue;

    const match = matchRiskPattern(pattern, files, addedLines, totals, config);
    if (match.matched) {
      const weight = adjustedWeight(pattern.weight, config);
      score += weight;
      ruleHits.push(makeRuleHit({
        id: pattern.id,
        label: pattern.label,
        weight,
        reason: `${pattern.label} because ${match.reason}`,
        check: pattern.check,
        matchedFiles: match.matchedFiles,
        matchedLineCount: match.matchedLineCount
      }));
      checks.push(pattern.check);
    }
  }

  const configuredRiskFiles = configuredHighRiskFiles(files, config);

  if (configuredRiskFiles.length) {
    score += config.configuredHighRiskWeight;
    ruleHits.push(makeRuleHit({
      id: 'configured-high-risk-path',
      label: 'Configured high-risk path changed',
      weight: config.configuredHighRiskWeight,
      reason: `Configured high-risk path changed because ${configuredRiskFiles.join(', ')} matched highRiskPaths from merge-guard.config.json.`,
      check: 'Review the configured high-risk path changes carefully before merging.',
      matchedFiles: configuredRiskFiles,
      matchedLineCount: 0
    }));
    checks.push('Review the configured high-risk path changes carefully before merging.');
  }

  const touchedTests = files.some(isTestFile);
  const touchedImplementation = files.some(isImplementationFile);
  const implementationFiles = files.filter(isImplementationFile);

  if (!docsOnly && touchedImplementation && !touchedTests) {
    score += config.missingTestsWeight;
    ruleHits.push(makeRuleHit({
      id: 'implementation-without-tests',
      label: 'Implementation changed without matching test changes',
      weight: config.missingTestsWeight,
      reason: `Implementation changed without matching test changes because ${implementationFiles.join(', ')} changed and no test, spec, smoke, or __tests__ file changed.`,
      check: 'Run the closest available test or smoke check manually.',
      matchedFiles: implementationFiles,
      matchedLineCount: 0
    }));
    checks.push('Run the closest available test or smoke check manually.');
  }

  if (docsOnly) {
    ruleHits.unshift(makeRuleHit({
      id: 'docs-only',
      label: 'Docs-only change detected',
      weight: 0,
      reason: 'Docs-only change detected because every changed file is documentation, an example, Markdown, or comment-only content.',
      check: 'Proofread documentation and verify examples or commands still match the project.',
      matchedFiles: files,
      matchedLineCount: 0
    }));
    checks.push('Proofread documentation and verify examples or commands still match the project.');

    if (!configuredRiskFiles.length) {
      score = Math.min(score, config.docsOnlyScoreCap);
    }
  }

  for (const command of config.testCommands) {
    checks.push(`Configured check: ${command}`);
  }

  return {
    score: Math.max(0, score),
    ruleHits: uniqById(ruleHits),
    flags: uniq(ruleHits.map((ruleHit) => ruleHit.label)),
    checks: uniq(checks),
    docsOnly
  };
}

function readinessFromScore(score, config) {
  if (score >= config.failThreshold) return 'DO_NOT_MERGE_YET';
  if (score >= config.reviewThreshold) return 'NEEDS_REVIEW';
  return 'SAFE_TO_MERGE';
}

function levelFromScore(score, config) {
  if (score >= config.failThreshold) return 'HIGH';
  if (score >= config.reviewThreshold) return 'MEDIUM';
  return 'LOW';
}

function fileLevelFromScore(score, config) {
  if (score >= config.failThreshold) return 'HIGH';
  if (score >= config.reviewThreshold) return 'MEDIUM';
  return 'LOW';
}

function scoreSingleFile(change, config) {
  const ruleHits = [];
  let score = 0;
  const addedLines = change.addedLines;
  const totals = {
    added: change.addedLinesCount,
    removed: change.removedLinesCount
  };
  const docsLike = isDocsFile(change.path) || hasOnlyCommentChanges(change);

  if (!docsLike) {
    for (const pattern of RISK_PATTERNS) {
      const match = matchRiskPattern(pattern, [change.path], addedLines, totals, config);
      if (match.matched) {
        const weight = adjustedWeight(pattern.weight, config);
        score += weight;
        ruleHits.push(makeRuleHit({
          id: pattern.id,
          label: pattern.label,
          weight,
          reason: `${pattern.label} because ${match.reason}`,
          check: pattern.check,
          matchedFiles: match.matchedFiles,
          matchedLineCount: match.matchedLineCount
        }));
      }
    }
  }

  const configuredRiskFiles = configuredHighRiskFiles([change.path], config);
  if (configuredRiskFiles.length) {
    score += config.configuredHighRiskWeight;
    ruleHits.push(makeRuleHit({
      id: 'configured-high-risk-path',
      label: 'Configured high-risk path changed',
      weight: config.configuredHighRiskWeight,
      reason: `${change.path} matched highRiskPaths from merge-guard.config.json.`,
      check: 'Review the configured high-risk path changes carefully before merging.',
      matchedFiles: configuredRiskFiles,
      matchedLineCount: 0
    }));
  }

  if (docsLike && !configuredRiskFiles.length) {
    ruleHits.push(makeRuleHit({
      id: 'docs-or-comment-only-file',
      label: 'Documentation/comment-only change',
      weight: 0,
      reason: `${change.path} is documentation, an example, Markdown, or comment-only content.`,
      check: 'Proofread documentation and verify examples or commands still match the project.',
      matchedFiles: [change.path],
      matchedLineCount: 0
    }));
    score = Math.min(score, config.docsOnlyScoreCap);
  }

  score = Math.max(0, score);
  const uniqueRuleHits = uniqById(ruleHits);

  return {
    path: change.path,
    riskLevel: fileLevelFromScore(score, config),
    riskScore: score,
    addedLines: change.addedLinesCount,
    removedLines: change.removedLinesCount,
    reason: uniqueRuleHits.length ? uniqueRuleHits.map((ruleHit) => ruleHit.reason).join(' ') : 'No major file-specific risk signals.',
    flags: uniqueRuleHits.map((ruleHit) => ruleHit.label),
    rules: uniqueRuleHits
  };
}

function sortFilesByRisk(files) {
  const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  return [...files].sort((a, b) => {
    const riskDelta = rank[b.riskLevel] - rank[a.riskLevel];
    if (riskDelta !== 0) return riskDelta;
    const scoreDelta = b.riskScore - a.riskScore;
    if (scoreDelta !== 0) return scoreDelta;
    return a.path.localeCompare(b.path);
  });
}

function escapeMarkdownTableCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function shouldShowConfig(report) {
  return report.config.preset !== DEFAULT_CONFIG.preset
    || report.config.highRiskPaths.length
    || report.config.testCommands.length
    || report.config.failThreshold !== RISK_PRESETS[report.config.preset].failThreshold;
}

export function analyzeDiff(diffText, userConfig = {}) {
  const config = normalizeConfig(userConfig);
  const changes = parseFileChanges(diffText);
  const files = changes.map((change) => change.path);
  const totals = {
    added: changes.reduce((sum, change) => sum + change.addedLinesCount, 0),
    removed: changes.reduce((sum, change) => sum + change.removedLinesCount, 0)
  };
  const risk = scoreRisk(diffText, changes, config);
  const fileBreakdown = sortFilesByRisk(changes.map((change) => scoreSingleFile(change, config)));

  return {
    tool: 'merge-guard',
    version: '0.1.0',
    riskLevel: levelFromScore(risk.score, config),
    mergeReadiness: readinessFromScore(risk.score, config),
    riskScore: risk.score,
    docsOnly: risk.docsOnly,
    config: {
      preset: config.preset,
      highRiskPaths: config.highRiskPaths,
      testCommands: config.testCommands,
      failThreshold: config.failThreshold,
      reviewThreshold: config.reviewThreshold
    },
    summary: {
      changedFiles: files.length,
      addedLines: totals.added,
      removedLines: totals.removed,
      docsOnly: risk.docsOnly,
      files
    },
    files: fileBreakdown,
    rules: risk.ruleHits,
    flags: risk.flags,
    suggestedChecks: risk.checks.length
      ? risk.checks
      : ['Run the normal test suite and review the diff before merging.']
  };
}

export function formatReport(report) {
  const lines = [];

  lines.push('merge-guard report');
  lines.push('');
  lines.push(`Risk level: ${report.riskLevel}`);
  lines.push(`Merge readiness: ${report.mergeReadiness}`);
  lines.push(`Risk score: ${report.riskScore}`);
  lines.push(`Preset: ${report.config.preset}`);
  lines.push('');
  lines.push('Summary:');
  lines.push(`- ${report.summary.changedFiles} file(s) changed`);
  lines.push(`- ${report.summary.addedLines} added line(s)`);
  lines.push(`- ${report.summary.removedLines} removed line(s)`);

  if (report.summary.docsOnly) {
    lines.push('- Docs-only: yes');
  }

  if (report.summary.files.length) {
    lines.push('');
    lines.push('Changed files:');
    for (const file of report.summary.files) {
      lines.push(`- ${file}`);
    }
  }

  if (report.files?.length) {
    lines.push('');
    lines.push('Per-file risk:');
    for (const file of report.files) {
      lines.push(`- ${file.riskLevel} ${file.path} - ${file.reason}`);
    }
  }

  if (shouldShowConfig(report)) {
    lines.push('');
    lines.push('Config:');
    lines.push(`- Preset: ${report.config.preset}`);
    lines.push(`- High-risk paths: ${report.config.highRiskPaths.length ? report.config.highRiskPaths.join(', ') : 'none'}`);
    lines.push(`- Test commands: ${report.config.testCommands.length ? report.config.testCommands.join(', ') : 'none'}`);
    lines.push(`- Review threshold: ${report.config.reviewThreshold}`);
    lines.push(`- Fail threshold: ${report.config.failThreshold}`);
  }

  lines.push('');
  lines.push('Risk flags:');
  for (const flag of report.flags.length ? report.flags : ['No major risk flags detected']) {
    lines.push(`- ${flag}`);
  }

  if (report.rules?.length) {
    lines.push('');
    lines.push('Rule explanations:');
    for (const rule of report.rules) {
      lines.push(`- ${rule.label} (${rule.id}, weight ${rule.weight}): ${rule.reason}`);
    }
  }

  lines.push('');
  lines.push('Suggested checks:');
  for (const check of report.suggestedChecks) {
    lines.push(`- ${check}`);
  }

  if (report.aiReview) {
    lines.push('');
    lines.push('AI review summary:');
    for (const item of report.aiReview.summary) {
      lines.push(`- ${item}`);
    }
    lines.push('');
    lines.push('Possible breakpoints:');
    for (const item of report.aiReview.possibleBreakpoints) {
      lines.push(`- ${item}`);
    }
    lines.push('');
    lines.push(`Reviewer note: ${report.aiReview.reviewerNote}`);
  }

  return lines.join('\n');
}

export function formatMarkdownReport(report) {
  const lines = [];

  lines.push('# merge-guard report');
  lines.push('');
  lines.push(`**Risk level:** ${report.riskLevel}`);
  lines.push(`**Merge readiness:** ${report.mergeReadiness}`);
  lines.push(`**Risk score:** ${report.riskScore}`);
  lines.push(`**Preset:** ${report.config.preset}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Changed files: ${report.summary.changedFiles}`);
  lines.push(`- Added lines: ${report.summary.addedLines}`);
  lines.push(`- Removed lines: ${report.summary.removedLines}`);
  lines.push(`- Docs-only: ${report.summary.docsOnly ? 'yes' : 'no'}`);

  if (report.files?.length) {
    lines.push('');
    lines.push('## Per-file risk');
    lines.push('');
    lines.push('| File | Risk | Reason |');
    lines.push('| --- | --- | --- |');
    for (const file of report.files) {
      lines.push(`| \`${escapeMarkdownTableCell(file.path)}\` | ${file.riskLevel} | ${escapeMarkdownTableCell(file.reason)} |`);
    }
  }

  lines.push('');
  lines.push('## Risk flags');
  lines.push('');
  for (const flag of report.flags.length ? report.flags : ['No major risk flags detected']) {
    lines.push(`- ${flag}`);
  }

  if (report.rules?.length) {
    lines.push('');
    lines.push('## Rule explanations');
    lines.push('');
    for (const rule of report.rules) {
      lines.push(`- **${rule.label}** (\`${rule.id}\`, weight ${rule.weight}): ${rule.reason}`);
    }
  }

  lines.push('');
  lines.push('## Suggested checks');
  lines.push('');
  for (const check of report.suggestedChecks) {
    lines.push(`- ${check}`);
  }

  if (report.aiReview) {
    lines.push('');
    lines.push('## AI review summary');
    lines.push('');
    for (const item of report.aiReview.summary) {
      lines.push(`- ${item}`);
    }
    lines.push('');
    lines.push('### Possible breakpoints');
    lines.push('');
    for (const item of report.aiReview.possibleBreakpoints) {
      lines.push(`- ${item}`);
    }
    lines.push('');
    lines.push(`**Reviewer note:** ${report.aiReview.reviewerNote}`);
  }

  return lines.join('\n');
}

export const __testables = {
  collectAddedLines,
  countChangedLines,
  isDocsFile,
  isDocsOnlyChange,
  normalizeConfig,
  parseChangedFiles,
  parseFileChanges
};
