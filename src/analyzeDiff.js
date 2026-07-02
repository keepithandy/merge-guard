const DEFAULT_CONFIG = {
  highRiskPaths: [],
  testCommands: [],
  failThreshold: 7
};

const RISK_PATTERNS = [
  {
    id: 'state-or-persistence',
    label: 'State or persistence logic changed',
    weight: 3,
    file: /(save|state|store|storage|persist|migration|ledger|cache)/i,
    line: /(localStorage|sessionStorage|save|load|persist|migrate|hydrate|serialize|deserialize)/i,
    check: 'Review save/load behavior and run state-related smoke tests.'
  },
  {
    id: 'dependency-or-config',
    label: 'Dependency or config file changed',
    weight: 2,
    file: /(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|vite\.config|tsconfig|eslint|prettier|webpack|rollup)/i,
    line: null,
    check: 'Run install/build checks and verify the app still starts cleanly.'
  },
  {
    id: 'routing-or-entry',
    label: 'Routing or entry-point logic changed',
    weight: 2,
    file: /(route|router|entry|main|index|app)/i,
    line: /(navigate|redirect|route|render|mount|entry)/i,
    check: 'Manually test the affected navigation or app entry path.'
  },
  {
    id: 'async-or-network',
    label: 'Async or network behavior changed',
    weight: 2,
    file: /(api|client|fetch|request|service|worker)/i,
    line: /(fetch|axios|Promise|async|await|setTimeout|setInterval|AbortController)/i,
    check: 'Check loading, failure, timeout, and empty-state behavior.'
  },
  {
    id: 'large-change',
    label: 'Large diff size',
    weight: 2,
    file: null,
    line: null,
    check: 'Split review into smaller sections or inspect the riskiest files first.'
  },
  {
    id: 'test-change',
    label: 'Tests changed with implementation',
    weight: -1,
    file: /(test|spec|smoke|__tests__)/i,
    line: null,
    check: 'Confirm the updated tests cover the changed behavior.'
  }
];

function uniq(values) {
  return [...new Set(values)];
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeFailThreshold(value) {
  if (!Number.isFinite(value)) return DEFAULT_CONFIG.failThreshold;
  return Math.max(1, Math.floor(value));
}

function normalizeConfig(config = {}) {
  return {
    highRiskPaths: normalizeStringArray(config.highRiskPaths),
    testCommands: normalizeStringArray(config.testCommands),
    failThreshold: normalizeFailThreshold(config.failThreshold)
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

function matchRiskPattern(pattern, files, addedLines, totals) {
  if (pattern.id === 'large-change') {
    return totals.added + totals.removed >= 120 || files.length >= 8;
  }

  const fileMatch = pattern.file ? files.some((file) => pattern.file.test(file)) : false;
  const lineMatch = pattern.line ? addedLines.some((line) => pattern.line.test(line)) : false;
  return fileMatch || lineMatch;
}

function configuredHighRiskFiles(files, config) {
  return files.filter((file) =>
    config.highRiskPaths.some((highRiskPath) => file.startsWith(highRiskPath))
  );
}

function scoreRisk(diffText, changes, config) {
  const files = changes.map((change) => change.path);
  const addedLines = changes.flatMap((change) => change.addedLines);
  const totals = {
    added: changes.reduce((sum, change) => sum + change.addedLinesCount, 0),
    removed: changes.reduce((sum, change) => sum + change.removedLinesCount, 0)
  };
  const docsOnly = isDocsOnlyChange(changes);
  const flags = [];
  const checks = [];
  let score = 0;

  for (const pattern of RISK_PATTERNS) {
    if (docsOnly && pattern.id !== 'test-change') continue;

    if (matchRiskPattern(pattern, files, addedLines, totals)) {
      score += pattern.weight;
      flags.push(pattern.label);
      checks.push(pattern.check);
    }
  }

  const configuredRiskFiles = configuredHighRiskFiles(files, config);

  if (configuredRiskFiles.length) {
    score += 4;
    flags.push(`Configured high-risk path changed: ${configuredRiskFiles.join(', ')}`);
    checks.push('Review the configured high-risk path changes carefully before merging.');
  }

  const touchedTests = files.some(isTestFile);
  const touchedImplementation = files.some(isImplementationFile);

  if (!docsOnly && touchedImplementation && !touchedTests) {
    score += 2;
    flags.push('Implementation changed without matching test changes');
    checks.push('Run the closest available test or smoke check manually.');
  }

  if (docsOnly) {
    flags.unshift('Docs-only change detected');
    checks.push('Proofread documentation and verify examples or commands still match the project.');

    if (!configuredRiskFiles.length) {
      score = Math.min(score, 1);
    }
  }

  for (const command of config.testCommands) {
    checks.push(`Configured check: ${command}`);
  }

  return {
    score: Math.max(0, score),
    flags: uniq(flags),
    checks: uniq(checks),
    docsOnly
  };
}

function readinessFromScore(score, config) {
  if (score >= config.failThreshold) return 'DO_NOT_MERGE_YET';
  if (score >= 3) return 'NEEDS_REVIEW';
  return 'SAFE_TO_MERGE';
}

function levelFromScore(score, config) {
  if (score >= config.failThreshold) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

function fileLevelFromScore(score) {
  if (score >= 5) return 'HIGH';
  if (score >= 2) return 'MEDIUM';
  return 'LOW';
}

function scoreSingleFile(change, config) {
  const flags = [];
  let score = 0;
  const addedLines = change.addedLines;
  const totals = {
    added: change.addedLinesCount,
    removed: change.removedLinesCount
  };
  const docsLike = isDocsFile(change.path) || hasOnlyCommentChanges(change);

  if (!docsLike) {
    for (const pattern of RISK_PATTERNS) {
      if (matchRiskPattern(pattern, [change.path], addedLines, totals)) {
        score += pattern.weight;
        flags.push(pattern.label);
      }
    }
  }

  const configuredRiskFiles = configuredHighRiskFiles([change.path], config);
  if (configuredRiskFiles.length) {
    score += 4;
    flags.push('Configured high-risk path changed');
  }

  if (docsLike && !configuredRiskFiles.length) {
    flags.push('Documentation/comment-only change');
    score = Math.min(score, 1);
  }

  score = Math.max(0, score);

  return {
    path: change.path,
    riskLevel: fileLevelFromScore(score),
    riskScore: score,
    addedLines: change.addedLinesCount,
    removedLines: change.removedLinesCount,
    reason: flags.length ? uniq(flags).join('; ') : 'No major file-specific risk signals',
    flags: uniq(flags)
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

export function analyzeDiff(diffText, userConfig = {}) {
  const config = normalizeConfig({ ...DEFAULT_CONFIG, ...userConfig });
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
      highRiskPaths: config.highRiskPaths,
      testCommands: config.testCommands,
      failThreshold: config.failThreshold
    },
    summary: {
      changedFiles: files.length,
      addedLines: totals.added,
      removedLines: totals.removed,
      docsOnly: risk.docsOnly,
      files
    },
    files: fileBreakdown,
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

  if (report.config.highRiskPaths.length || report.config.testCommands.length || report.config.failThreshold !== DEFAULT_CONFIG.failThreshold) {
    lines.push('');
    lines.push('Config:');
    lines.push(`- High-risk paths: ${report.config.highRiskPaths.length ? report.config.highRiskPaths.join(', ') : 'none'}`);
    lines.push(`- Test commands: ${report.config.testCommands.length ? report.config.testCommands.join(', ') : 'none'}`);
    lines.push(`- Fail threshold: ${report.config.failThreshold}`);
  }

  lines.push('');
  lines.push('Risk flags:');
  for (const flag of report.flags.length ? report.flags : ['No major risk flags detected']) {
    lines.push(`- ${flag}`);
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
  parseChangedFiles,
  parseFileChanges
};
