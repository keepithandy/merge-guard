const MAX_DIFF_PROMPT_CHARS = 12000;

const PROMPT_TEMPLATE = `You are merge-guard, a careful code review assistant.

Review the provided git diff and rules-based scan report.

Your job is to produce a practical merge-readiness report for a developer.

Focus on:
- what changed
- what behavior may be affected
- what could break
- what tests or smoke checks should be run
- whether the change looks ready to merge

Do not claim the code is safe with certainty.
Do not invent files, tests, or project behavior not shown in the diff.
Do not replace human review.`;

function listChangedFileSummary(report) {
  if (!report.files?.length) return 'No changed files were detected.';

  return report.files
    .slice(0, 8)
    .map((file) => `${file.riskLevel}: ${file.path} (${file.reason})`)
    .join('\n');
}

function buildPossibleBreakpoints(report) {
  const riskyFiles = (report.files || []).filter((file) => file.riskLevel !== 'LOW');

  if (report.docsOnly) {
    return ['Documentation, command examples, or usage notes may drift from actual project behavior.'];
  }

  if (!riskyFiles.length) {
    return ['No specific breakpoint was detected by the rules-based scanner. Review the diff manually before merging.'];
  }

  return riskyFiles.map((file) => `${file.path}: ${file.reason}`);
}

export function buildAiReviewPrompt(report, diffText) {
  const trimmedDiff = diffText.length > MAX_DIFF_PROMPT_CHARS
    ? `${diffText.slice(0, MAX_DIFF_PROMPT_CHARS)}\n\n[diff truncated for prompt size]`
    : diffText;

  return `${PROMPT_TEMPLATE}

Return this structure:

1. Summary
2. Risk level
3. Risk flags
4. Possible breakpoints
5. Suggested checks
6. Merge readiness
7. Reviewer note

Rules-based report:
${JSON.stringify(report, null, 2)}

Changed files by risk:
${listChangedFileSummary(report)}

Git diff:
${trimmedDiff}`;
}

export function createAiReviewSummary(report, diffText) {
  const fileCount = report.summary.changedFiles;
  const riskiestFile = report.files?.[0];
  const summary = [
    `${fileCount} file(s) changed with ${report.summary.addedLines} added line(s) and ${report.summary.removedLines} removed line(s).`,
    `The rules-based scanner classified this as ${report.riskLevel} risk with merge readiness ${report.mergeReadiness}.`
  ];

  if (riskiestFile) {
    summary.push(`Highest attention file: ${riskiestFile.path} (${riskiestFile.riskLevel}) — ${riskiestFile.reason}.`);
  }

  if (report.docsOnly) {
    summary.push('This appears to be a docs-only change, so the main review focus should be correctness and wording rather than runtime behavior.');
  }

  return {
    mode: 'ai-ready-rules-summary',
    summary,
    possibleBreakpoints: buildPossibleBreakpoints(report),
    suggestedChecks: report.suggestedChecks,
    mergeReadiness: report.mergeReadiness,
    prompt: buildAiReviewPrompt(report, diffText),
    reviewerNote: 'Optional AI review can organize the risk report, but it does not prove the change is safe or replace human review.'
  };
}
