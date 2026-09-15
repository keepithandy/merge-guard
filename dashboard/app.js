import { compareDashboardReports } from './comparison.js';

const input = document.querySelector('#files');
const dropZone = document.querySelector('#drop-zone');
const status = document.querySelector('#status');
const output = document.querySelector('#output');
let committed = [];
let earlierReportIndex = 0;

function element(tag, text = '') {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

function showStatus(message, error = false) {
  status.textContent = message;
  status.dataset.state = error ? 'error' : 'ready';
}

function render(imports) {
  output.replaceChildren();
  const reports = imports.filter((item) => item.kind === 'report');
  const comparison = reports.length === 2 ? compareDashboardReports(...comparisonPair(reports).map((item) => item.report)) : null;
  if (reports.length === 2) {
    renderComparisonControls(reports);
    renderComparison(comparisonPair(reports), comparison);
  }
  if (reports.length) renderCalibration(reports, comparison);
  for (const item of imports) {
    if (item.kind === 'report') renderReport(item);
    else {
      const section = element('section');
      section.append(element('h2', item.name), element('p', `Unified diff loaded (${item.text.split(/\r?\n/).length} lines).`));
      output.append(section);
    }
  }
}

function renderReport(item) {
  const report = item.report;
  const section = element('section');
  section.className = 'report';
  const heading = element('h2', item.name);
  const summary = element('p', `${report.riskLevel} · score ${report.riskScore} · ${report.mergeReadiness}`);
  summary.className = 'summary';
  section.append(heading, summary);
  const exports = element('div');
  exports.className = 'exports';
  exports.append(exportButton('Download JSON', `${item.name}.json`, JSON.stringify(report, null, 2) + '\n'));
  exports.append(exportButton('Download Markdown', `${item.name}.md`, markdownReport(report)));
  exports.append(exportButton('Download verification checklist', `${item.name}-verification-checklist.md`, markdownVerificationChecklist(report)));
  section.append(exports);

  renderActionPlan(section, report);

  const filesHeading = element('h3', 'Files by reported risk');
  const files = element('ul');
  [...report.files].sort((left, right) => (right.riskScore ?? 0) - (left.riskScore ?? 0) || String(left.path).localeCompare(String(right.path))).forEach((file) => {
    const itemNode = element('li');
    const title = element('strong', `${file.riskLevel || 'UNSPECIFIED'} · ${file.path} · score ${file.riskScore ?? 'n/a'}`);
    itemNode.append(title, element('p', file.reason || 'No file explanation supplied.'));
    if (Array.isArray(file.rules) && file.rules.length) {
      const rules = element('ul');
      file.rules.forEach((rule) => {
        const ruleNode = element('li');
        ruleNode.append(element('strong', rule.label || rule.id || 'Unnamed rule'), element('p', rule.reason || 'No rule explanation supplied.'));
        ruleNode.append(element('small', `Evidence: ${(rule.matchedFiles || []).join(', ') || 'global finding'}; matched lines: ${rule.matchedLineCount ?? 0}`));
        rules.append(ruleNode);
      });
      itemNode.append(rules);
    }
    files.append(itemNode);
  });
  section.append(filesHeading, files);

  const checksHeading = element('h3', 'Suggested checks');
  const checks = element('ul');
  (report.suggestedChecks || []).forEach((check, index) => {
    const label = element('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.id = `check-${index}`;
    label.append(checkbox, document.createTextNode(` ${check}`));
    const checkItem = element('li'); checkItem.append(label); checks.append(checkItem);
  });
  section.append(checksHeading, checks);
  const addList = (headingText, values, fallback) => {
    const block = element('div'); block.append(element('h3', headingText));
    const list = element('ul');
    if (values.length) values.forEach((value) => list.append(element('li', typeof value === 'string' ? value : JSON.stringify(value))));
    else list.append(element('li', fallback));
    block.append(list); section.append(block);
  };
  addList('Warnings', [...(report.customRuleWarnings || []), ...(report.suppressionWarnings || []), ...(report.configDiagnostics || [])], 'No warnings reported.');
  addList('Suppressions', report.suppressedFindings || [], 'No suppressions reported.');
  output.append(section);
}

function list(value) { return Array.isArray(value) ? value : []; }

function matchingOwners(report, files) {
  const suggestions = list(report.reviewGuidance?.codeOwners?.suggestions);
  const owners = new Set();
  for (const suggestion of suggestions) {
    if (files.includes(suggestion.path)) for (const owner of list(suggestion.owners)) owners.add(owner);
  }
  return [...owners].sort();
}

function renderActionPlan(section, report) {
  const heading = element('h3', 'Fix this PR');
  const lead = element('p', 'Work through the findings below. Completing a check records only this browser session and never changes the report.');
  const cards = element('div');
  cards.className = 'action-cards';
  const rules = list(report.rules);
  if (!rules.length) cards.append(element('p', 'No rule findings were reported.'));
  rules.forEach((rule, index) => {
    const card = element('article'); card.className = 'action-card';
    card.append(element('h4', rule.label || rule.id || 'Unnamed finding'));
    card.append(element('p', rule.reason || 'No explanation supplied.'));
    const files = list(rule.matchedFiles);
    card.append(element('p', `Affected: ${files.length ? files.join(', ') : 'repository-wide finding'}.`));
    const owners = matchingOwners(report, files);
    if (owners.length) card.append(element('p', `Suggested owners: ${owners.join(', ')}.`));
    const check = rule.check || list(report.suggestedChecks)[index] || '';
    if (check) {
      const checkLabel = element('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.id = `action-check-${index}`;
      checkLabel.append(checkbox, document.createTextNode(` Verified: ${check}`));
      card.append(checkLabel);
      const copy = element('button', 'Copy check'); copy.type = 'button';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(check); showStatus('Verification check copied.'); }
        catch { showStatus('Could not copy the check; select its text instead.', true); }
      });
      card.append(copy);
    }
    cards.append(card);
  });
  section.append(heading, lead, cards);
}

function comparisonPair(reports) {
  const earlier = reports[earlierReportIndex] || reports[0];
  return [earlier, reports.find((item) => item !== earlier)];
}

function renderComparisonControls(reports) {
  const section = element('section'); section.className = 'comparison-controls';
  section.append(element('h2', 'Choose report order'));
  const label = element('label', 'Earlier report: ');
  const select = document.createElement('select'); select.id = 'earlier-report';
  reports.forEach((report, index) => {
    const option = element('option', report.name); option.value = String(index); select.append(option);
  });
  select.value = String(earlierReportIndex);
  select.addEventListener('change', () => { earlierReportIndex = Number(select.value); render(committed); });
  label.append(select); section.append(label);
  const latest = comparisonPair(reports)[1];
  section.append(element('p', `Latest report: ${latest.name}.`));
  const swap = element('button', 'Swap reports'); swap.type = 'button';
  swap.addEventListener('click', () => { earlierReportIndex = earlierReportIndex === 0 ? 1 : 0; render(committed); });
  section.append(swap);
  output.append(section);
}

function findingLabel(finding) {
  return `${finding.label} — ${finding.path || 'global finding'}`;
}

function renderComparison([previousItem, currentItem], comparison) {
  const previous = previousItem.report;
  const current = currentItem.report;
  const section = element('section'); section.className = 'comparison';
  section.append(element('h2', 'What changed since the previous report'));
  section.append(element('p', `Comparing ${previousItem.name} → ${currentItem.name}. Risk score ${previous.riskScore} → ${current.riskScore} (${scoreChange(previous.riskScore, current.riskScore)}).`));
  const summary = element('p', `New: ${comparison.summary.new} · Unchanged: ${comparison.summary.unchanged} · Resolved: ${comparison.summary.resolved}`); summary.className = 'summary'; section.append(summary);
  if (comparison.configurationChanged) section.append(element('p', 'Configuration changed between reports; compare scores and findings with that context in mind.'));
  comparisonList(section, 'New findings — review these first', comparison.newFindings, (finding) => finding.reason || 'No explanation supplied.');
  comparisonList(section, 'Resolved findings', comparison.resolvedFindings, () => 'Absent from the latest report; this does not by itself prove remediation.');
  const unchanged = document.createElement('details');
  unchanged.append(element('summary', `Unchanged findings (${comparison.summary.unchanged})`));
  const unchangedList = element('ul');
  if (!comparison.unchangedFindings.length) unchangedList.append(element('li', 'None.'));
  comparison.unchangedFindings.forEach(({ current: finding, detailsChanged }) => {
    unchangedList.append(element('li', `${findingLabel(finding)} — ${detailsChanged ? `Explanation changed: ${finding.reason}` : 'The finding remains with the same explanation.'}`));
  });
  unchanged.append(unchangedList); section.append(unchanged);
  output.append(section);
}

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? timestamp : null;
}

function upcomingSuppressions(reports) {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const limit = today + 30 * 86400000;
  const unique = new Map();
  reports.forEach((item) => list(item.report?.config?.suppressions).forEach((suppression) => {
    const expiry = calendarDate(suppression?.expires);
    if (expiry === null || expiry < today || expiry > limit) return;
    const key = [suppression.ruleId, suppression.pathPattern || '', suppression.owner, suppression.expires].join('\u0000');
    unique.set(key, suppression);
  }));
  return [...unique.values()].sort((left, right) => left.expires.localeCompare(right.expires));
}

function renderCalibration(reports, comparison) {
  const section = element('section'); section.className = 'calibration';
  section.append(element('h2', 'Calibration signals'));
  section.append(element('p', 'These signals describe the selected reports and never change risk scores, findings, or merge decisions.'));
  const recurring = comparison?.unchangedFindings.map((finding) => finding.current) || [];
  const recurringBlock = element('div'); recurringBlock.append(element('h3', 'Findings repeated across reports'));
  const recurringList = element('ul');
  if (reports.length < 2) recurringList.append(element('li', 'Import an earlier report to identify findings that recur across pushes.'));
  else if (!recurring.length) recurringList.append(element('li', 'No finding identities repeated across the two selected reports.'));
  else recurring.forEach((finding) => recurringList.append(element('li', `${findingLabel(finding)} — present in both reports.`)));
  recurringBlock.append(recurringList); section.append(recurringBlock);

  const expiring = upcomingSuppressions(reports);
  const expiryBlock = element('div'); expiryBlock.append(element('h3', 'Suppressions expiring within 30 days'));
  const expiryList = element('ul');
  if (!expiring.length) expiryList.append(element('li', 'No configured suppression expires within the next 30 days.'));
  else expiring.forEach((suppression) => expiryList.append(element('li', `${suppression.ruleId} — expires ${suppression.expires}; owner: ${suppression.owner || 'unspecified'}.`)));
  expiryBlock.append(expiryList); section.append(expiryBlock);
  output.append(section);
}

function signedDelta(value) { return `${value > 0 ? '+' : ''}${value}`; }

function scoreChange(previous, current) { return signedDelta(current - previous); }

function comparisonList(section, heading, entries, description) {
  const block = element('div'); block.append(element('h3', heading));
  const items = element('ul');
  if (!entries.length) items.append(element('li', 'None.'));
  entries.forEach((entry) => {
    const item = element('li'); item.append(element('strong', findingLabel(entry)), document.createTextNode(` — ${description(entry)}`)); items.append(item);
  });
  block.append(items); section.append(block);
}

function exportButton(label, filename, content) {
  const button = element('button', label);
  button.type = 'button';
  button.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = element('a');
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  return button;
}

function markdownReport(report) {
  const lines = [
    '# Merge Guard report', '',
    `- Risk level: ${report.riskLevel}`,
    `- Merge readiness: ${report.mergeReadiness}`,
    `- Risk score: ${report.riskScore}`,
    '', '## Files'
  ];
  for (const file of report.files || []) lines.push(`- **${file.riskLevel || 'UNSPECIFIED'}** ${file.path} — score ${file.riskScore ?? 'n/a'}: ${file.reason || 'No explanation supplied.'}`);
  lines.push('', '## Suggested checks');
  for (const check of report.suggestedChecks || []) lines.push(`- [ ] ${check}`);
  return lines.join('\n') + '\n';
}

function markdownVerificationChecklist(report) {
  const lines = [
    '# Merge Guard verification checklist',
    '',
    `- Risk level: ${report.riskLevel}`,
    `- Review decision: ${report.reviewDecision || report.mergeReadiness}`,
    `- Risk score: ${report.riskScore}`,
    '',
    '> Checking an item records verification work only; it does not approve a pull request or change Merge Guard findings.',
    '',
    '## Findings to verify',
    ''
  ];
  const rules = list(report.rules);
  if (!rules.length) lines.push('- [ ] No rule findings were reported; confirm the intended scope and test coverage.');
  rules.forEach((rule, index) => {
    const title = rule.label || rule.id || 'Unnamed finding';
    const files = list(rule.matchedFiles);
    const check = rule.check || list(report.suggestedChecks)[index] || 'Choose and record an appropriate verification step.';
    lines.push(`- [ ] **${title}** — ${check}`);
    lines.push(`  - Affected: ${files.length ? files.map((file) => `\`${file}\``).join(', ') : 'repository-wide finding'}`);
    if (rule.reason) lines.push(`  - Why: ${rule.reason}`);
  });
  const unmatchedChecks = list(report.suggestedChecks).slice(rules.length);
  if (unmatchedChecks.length) {
    lines.push('', '## Additional suggested checks', '');
    unmatchedChecks.forEach((check) => lines.push(`- [ ] ${check}`));
  }
  return lines.join('\n') + '\n';
}

async function importFiles(files) {
  const items = await Promise.all([...files].map(async (file) => ({ name: file.name, bytes: await file.arrayBuffer() })));
  const worker = new Worker('./import-worker.js', { type: 'module' });
  const timer = setTimeout(() => { worker.terminate(); showStatus('processing-timeout: validation exceeded 10 seconds', true); }, 10000);
  worker.onmessage = ({ data }) => {
    clearTimeout(timer); worker.terminate();
    if (!data.ok) return showStatus(`${data.error.category}: ${data.error.message}`, true);
    committed = data.imports; earlierReportIndex = 0; render(committed); showStatus(`Loaded ${committed.length} validated file${committed.length === 1 ? '' : 's'}.`);
  };
  worker.postMessage({ items }, items.map((item) => item.bytes));
}

input.addEventListener('change', () => importFiles(input.files).catch((error) => showStatus(`malformed-input: ${error.message}`, true)));
dropZone.addEventListener('dragover', (event) => event.preventDefault());
dropZone.addEventListener('drop', (event) => { event.preventDefault(); importFiles(event.dataTransfer.files).catch((error) => showStatus(`malformed-input: ${error.message}`, true)); });
