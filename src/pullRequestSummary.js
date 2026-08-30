export const PULL_REQUEST_SUMMARY_VERSION = 1;
export const PULL_REQUEST_SUMMARY_MARKER = `<!-- merge-guard-pr-summary:v${PULL_REQUEST_SUMMARY_VERSION} -->`;

const FILE_RISK_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function list(value) {
  return Array.isArray(value) ? value : [];
}

function number(value) {
  return Number.isFinite(value) ? value : 0;
}

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inline(value) {
  return escapeHtml(String(value).replace(/\s+/g, ' ').trim());
}

function tableCell(value) {
  return inline(value).replaceAll('|', '&#124;');
}

function code(value) {
  return `<code>${inline(value)}</code>`;
}

function sortedFiles(report) {
  return [...list(report?.files)].sort((left, right) => {
    const riskDelta = (FILE_RISK_RANK[right?.riskLevel] || 0) - (FILE_RISK_RANK[left?.riskLevel] || 0);
    if (riskDelta) return riskDelta;
    const scoreDelta = number(right?.riskScore) - number(left?.riskScore);
    if (scoreDelta) return scoreDelta;
    return text(left?.path).localeCompare(text(right?.path));
  });
}

function checkRecords(report) {
  const source = list(report?.primaryChecks).length
    ? list(report.primaryChecks)
    : list(report?.suggestedChecks).slice(0, 3);
  return [...new Set(source.filter((item) => typeof item === 'string' && item.trim()))].slice(0, 3);
}

function reviewDecision(report) {
  const explicit = text(report?.reviewDecision);
  if (explicit) return explicit;
  return {
    SAFE_TO_MERGE: 'NO_CONFIGURED_BLOCKERS',
    NEEDS_REVIEW: 'REVIEW_RECOMMENDED',
    DO_NOT_MERGE_YET: 'CONFIGURED_BLOCKER_FOUND'
  }[report?.mergeReadiness] || 'UNKNOWN';
}

function warningRecords(report) {
  const groups = [
    ['Configuration', report?.configDiagnostics],
    ['Custom rule', report?.customRuleWarnings],
    ['Suppression', report?.suppressionWarnings],
    ['Policy rule', report?.policyRuleWarnings],
    ['Policy resolution', report?.policyResolution?.warnings],
    ['CODEOWNERS', report?.reviewGuidance?.codeOwners?.warnings]
  ];
  const records = [];
  for (const [source, items] of groups) {
    for (const item of list(items)) {
      const message = text(item?.message, text(item));
      if (message) records.push({ source, message });
    }
  }
  return records;
}

function detailStart(lines, label) {
  if (lines.length && lines.at(-1) !== '') lines.push('');
  lines.push('<details>');
  lines.push(`<summary>${escapeHtml(label)}</summary>`);
  lines.push('');
}

function detailEnd(lines) {
  lines.push('');
  lines.push('</details>');
}

function plural(count, singular, pluralValue = `${singular}s`) {
  return count === 1 ? singular : pluralValue;
}

function sentence(value, fallback) {
  const normalized = inline(text(value, fallback));
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

export function formatPullRequestSummary(report) {
  if (!report || typeof report !== 'object') {
    throw new TypeError('formatPullRequestSummary requires a report object.');
  }

  const files = sortedFiles(report);
  const rules = list(report.rules);
  const checks = checkRecords(report);
  const warnings = warningRecords(report);
  const changedFiles = number(report.summary?.changedFiles);
  const addedLines = number(report.summary?.addedLines);
  const removedLines = number(report.summary?.removedLines);
  const riskLevel = text(report.riskLevel, 'UNKNOWN');
  const decision = reviewDecision(report);
  const riskScore = number(report.riskScore);
  const docsOnly = Boolean(report.summary?.docsOnly ?? report.docsOnly);
  const lines = [];

  lines.push('## merge-guard review summary');
  lines.push(PULL_REQUEST_SUMMARY_MARKER);
  lines.push('');
  lines.push(`**${inline(riskLevel)} risk** · score **${riskScore}** · ${inline(decision)} · **${changedFiles} changed ${plural(changedFiles, 'file')}** · **+${addedLines} / -${removedLines}**${docsOnly ? ' · **docs-only**' : ''}`);
  lines.push('');
  lines.push('Risk, review decision, and score come from the analyzed diff. Pull-request text is context only.');

  if (files.length) {
    lines.push('');
    lines.push('### Highest-risk files');
    lines.push('');
    for (const file of files.slice(0, 3)) {
      lines.push(`- **${inline(text(file.riskLevel, 'UNKNOWN'))} / ${number(file.riskScore)}** ${code(text(file.path, '(unknown path)'))} — ${inline(text(file.reason, 'No reason supplied.'))}`);
    }
  }

  detailStart(lines, `Files (${files.length})`);
  if (files.length) {
    lines.push('| File | Risk | Score | Evidence |');
    lines.push('| --- | --- | ---: | --- |');
    for (const file of files) {
      lines.push(`| ${code(text(file.path, '(unknown path)'))} | ${tableCell(text(file.riskLevel, 'UNKNOWN'))} | ${number(file.riskScore)} | ${tableCell(text(file.reason, 'No reason supplied.'))} |`);
    }
  } else {
    lines.push('No changed files were reported.');
  }
  detailEnd(lines);

  detailStart(lines, `Rules (${rules.length})`);
  if (rules.length) {
    for (const rule of rules) {
      const matchedFiles = list(rule?.matchedFiles);
      const matches = matchedFiles.length
        ? ` Matched ${matchedFiles.map(code).join(', ')}.`
        : '';
      lines.push(`- **${inline(text(rule?.label, text(rule?.id, 'Unnamed rule')))}** (${code(text(rule?.id, 'unknown-rule'))}, weight ${number(rule?.weight)}): ${sentence(rule?.reason, 'No reason supplied.')}${matches}`);
    }
  } else {
    lines.push('No rule findings were reported.');
  }
  detailEnd(lines);

  const allChecks = list(report?.suggestedChecks).filter((item) => typeof item === 'string' && item.trim());
  const checkLabel = allChecks.length > checks.length
    ? `Suggested checks (${checks.length} shown; ${allChecks.length} detected)`
    : `Suggested checks (${checks.length})`;
  detailStart(lines, checkLabel);
  if (checks.length) {
    for (const check of checks) lines.push(`- [ ] ${inline(check)}`);
  } else {
    lines.push('No checks were reported.');
  }
  detailEnd(lines);

  if (warnings.length) {
    detailStart(lines, `Warnings (${warnings.length})`);
    for (const warning of warnings) {
      lines.push(`- **${inline(warning.source)}:** ${inline(warning.message)}`);
    }
    detailEnd(lines);
  }

  if (report.prContext) {
    detailStart(lines, 'Pull-request context');
    if (report.prContext.title) lines.push(`- **Title:** ${inline(report.prContext.title)}`);
    if (report.prContext.body) lines.push(`- **Body:** ${inline(report.prContext.body)}`);
    lines.push('- Context is displayed for reviewers and does not change diff-derived findings or scoring.');
    detailEnd(lines);
  }

  lines.push('');
  lines.push(`<sub>Summary contract v${PULL_REQUEST_SUMMARY_VERSION}. Expand sections for deterministic report detail.</sub>`);
  return lines.join('\n');
}
