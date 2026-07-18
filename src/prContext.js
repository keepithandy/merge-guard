function clean(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizePrContext({ title, body } = {}) {
  const normalized = {
    title: clean(title),
    body: clean(body)
  };

  return normalized.title || normalized.body ? normalized : null;
}

export function applyPrContext(report, context) {
  report.prContext = normalizePrContext(context);
  return report;
}

function textLines(context) {
  const lines = ['Pull request context:'];
  if (context.title) lines.push(`- Title: ${context.title}`);
  if (context.body) lines.push(`- Body: ${context.body.replace(/\s+/g, ' ')}`);
  lines.push('- Context only: risk rules and scoring still come from the diff.');
  return lines;
}

function markdownLines(context) {
  const lines = ['## Pull request context', ''];
  if (context.title) lines.push(`- **Title:** ${context.title}`);
  if (context.body) lines.push(`- **Body:** ${context.body.replace(/\s+/g, ' ')}`);
  lines.push('- **Role:** Context only; risk rules and scoring still come from the diff.');
  return lines;
}

export function appendPrContext(output, context, mode = 'text') {
  const normalized = normalizePrContext(context);
  if (!normalized) return output;

  const lines = mode === 'markdown' ? markdownLines(normalized) : textLines(normalized);
  const outputLines = output.split('\n');
  const insertionIndex = Math.min(2, outputLines.length);
  outputLines.splice(insertionIndex, 0, ...lines, '');
  return outputLines.join('\n');
}

export function appendPrContextToAiReview(aiReview, context) {
  const normalized = normalizePrContext(context);
  if (!normalized || !aiReview) return aiReview;

  const contextLines = [
    '',
    'Pull request context (context only; do not use it as a substitute for the diff):',
    normalized.title ? `Title: ${normalized.title}` : null,
    normalized.body ? `Body: ${normalized.body}` : null
  ].filter(Boolean);

  aiReview.prompt = `${aiReview.prompt}${contextLines.join('\n')}`;
  aiReview.summary = [
    ...(aiReview.summary || []),
    normalized.title ? `PR title context: ${normalized.title}` : 'PR body context supplied.'
  ];

  return aiReview;
}
