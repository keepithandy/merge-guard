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

function parseChangedFiles(diffText) {
  const files = [];
  const lines = diffText.split('\n');

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      const match = line.match(/^diff --git a\/(.*?) b\/(.*)$/);
      if (match) {
        files.push(match[2]);
      }
    }
  }

  return uniq(files);
}

function countChangedLines(diffText) {
  const lines = diffText.split('\n');
  let added = 0;
  let removed = 0;

  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) added += 1;
    if (line.startsWith('-')) removed += 1;
  }

  return { added, removed };
}

function collectAddedLines(diffText) {
  return diffText
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
}

function scoreRisk(diffText, files, addedLines, totals, config) {
  const flags = [];
  const checks = [];
  let score = 0;

  for (const pattern of RISK_PATTERNS) {
    let matched = false;

    if (pattern.id === 'large-change') {
      matched = totals.added + totals.removed >= 120 || files.length >= 8;
    } else {
      const fileMatch = pattern.file ? files.some((file) => pattern.file.test(file)) : false;
      const lineMatch = pattern.line ? addedLines.some((line) => pattern.line.test(line)) : false;
      matched = fileMatch || lineMatch;
    }

    if (matched) {
      score += pattern.weight;
      flags.push(pattern.label);
      checks.push(pattern.check);
    }
  }

  const configuredHighRiskPaths = files.filter((file) =>
    config.highRiskPaths.some((highRiskPath) => file.startsWith(highRiskPath))
  );

  if (configuredHighRiskPaths.length) {
    score += 4;
    flags.push(`Configured high-risk path changed: ${configuredHighRiskPaths.join(', ')}`);
    checks.push('Review the configured high-risk path changes carefully before merging.');
  }

  const touchedTests = files.some((file) => /(test|spec|smoke|__tests__)/i.test(file));
  const touchedImplementation = files.some((file) => !/(test|spec|smoke|__tests__|README|docs?\//i.test(file));

  if (touchedImplementation && !touchedTests) {
    score += 2;
    flags.push('Implementation changed without matching test changes');
    checks.push('Run the closest available test or smoke check manually.');
  }

  for (const command of config.testCommands) {
    checks.push(`Configured check: ${command}`);
  }

  return {
    score: Math.max(0, score),
    flags: uniq(flags),
    checks: uniq(checks)
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

export function analyzeDiff(diffText, userConfig = {}) {
  const config = normalizeConfig({ ...DEFAULT_CONFIG, ...userConfig });
  const files = parseChangedFiles(diffText);
  const totals = countChangedLines(diffText);
  const addedLines = collectAddedLines(diffText);
  const risk = scoreRisk(diffText, files, addedLines, totals, config);

  return {
    tool: 'merge-guard',
    version: '0.1.0',
    riskLevel: levelFromScore(risk.score, config),
    mergeReadiness: readinessFromScore(risk.score, config),
    riskScore: risk.score,
    config: {
      highRiskPaths: config.highRiskPaths,
      testCommands: config.testCommands,
      failThreshold: config.failThreshold
    },
    summary: {
      changedFiles: files.length,
      addedLines: totals.added,
      removedLines: totals.removed,
      files
    },
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

  if (report.summary.files.length) {
    lines.push('');
    lines.push('Changed files:');
    for (const file of report.summary.files) {
      lines.push(`- ${file}`);
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

  return lines.join('\n');
}
