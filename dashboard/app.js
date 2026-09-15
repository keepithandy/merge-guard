import { compareDashboardReports, extractDashboardFindings } from './comparison.js';
import { buildReviewFocus } from './review-focus.js';
import { createVerificationProgress, progressByFinding } from './verification-progress.js';

const input = document.querySelector('#files');
const dropZone = document.querySelector('#drop-zone');
const status = document.querySelector('#status');
const output = document.querySelector('#output');
let committed = [];
let earlierReportIndex = 0;
let verificationByBinding = new Map();
let verificationProgressMessage = '';

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
  const selectedReports = reports.length === 2 ? comparisonPair(reports) : [reports[0]];
  const comparison = reports.length === 2 ? compareDashboardReports(...selectedReports.map((item) => item.report)) : null;
  if (reports.length === 2) {
    renderComparisonControls(reports);
    renderComparison(selectedReports, comparison);
  }
  if (reports.length) renderReviewFocus(selectedReports.at(-1), comparison);
  if (reports.length) renderCalibration(reports, comparison);
  if (verificationProgressMessage) {
    const section = element('section'); section.className = 'verification-progress';
    section.append(element('h2', 'Verification progress'), element('p', verificationProgressMessage));
    output.append(section);
  }
  for (const item of imports) {
    if (item.kind === 'report') renderReport(item);
    else if (item.kind === 'diff') {
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
  exports.append(exportButton('Download verification checklist', `${item.name}-verification-checklist.md`, () => markdownVerificationChecklist(item)));
  exports.append(copyButton('Copy verification checklist', () => markdownVerificationChecklist(item)));
  exports.append(exportButton('Download verification progress', `${item.name}-verification-progress.json`, () => `${JSON.stringify(createVerificationProgress(item.reportBinding, extractDashboardFindings(report), verificationForReport(item)), null, 2)}\n`));
  section.append(exports);

  renderActionPlan(section, item);

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

  const checksHeading = element('h3', 'Unassociated suggested checks');
  const checks = element('ul');
  const findingChecks = new Set(extractDashboardFindings(report).map((finding) => finding.check).filter(Boolean));
  const unassociatedChecks = list(report.suggestedChecks).filter((check) => !findingChecks.has(check));
  if (unassociatedChecks.length) unassociatedChecks.forEach((check) => checks.append(element('li', check)));
  else checks.append(element('li', 'All suggested checks are associated with a finding above.'));
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

function verificationForReport(item) {
  if (!verificationByBinding.has(item.reportBinding)) verificationByBinding.set(item.reportBinding, new Map());
  return verificationByBinding.get(item.reportBinding);
}

function updateVerification(item, finding, update) {
  const progress = verificationForReport(item);
  const current = progress.get(finding.identity) || { completed: false, note: '' };
  progress.set(finding.identity, { ...current, ...update });
  showStatus('Verification progress is ready to export.');
}

function renderActionPlan(section, item) {
  const report = item.report;
  const heading = element('h3', 'Fix this PR');
  const lead = element('p', 'Work through the findings below. Progress stays in this browser session until you export it, and it never changes the report.');
  const cards = element('div');
  cards.className = 'action-cards';
  const findings = extractDashboardFindings(report);
  const progress = verificationForReport(item);
  if (!findings.length) cards.append(element('p', 'No rule findings were reported.'));
  findings.forEach((finding, index) => {
    const card = element('article'); card.className = 'action-card';
    card.append(element('h4', findingLabel(finding)));
    card.append(element('p', finding.reason || 'No explanation supplied.'));
    const files = finding.path ? [finding.path] : [];
    card.append(element('p', `Affected: ${files.length ? files.join(', ') : 'repository-wide finding'}.`));
    const owners = matchingOwners(report, files);
    if (owners.length) card.append(element('p', `Suggested owners: ${owners.join(', ')}.`));
    const check = finding.check || 'Record the verification you performed.';
    const record = progress.get(finding.identity) || { completed: false, note: '' };
    const checkLabel = element('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.id = `action-check-${index}`; checkbox.checked = record.completed;
    checkbox.addEventListener('change', () => updateVerification(item, finding, { completed: checkbox.checked }));
    checkLabel.append(checkbox, document.createTextNode(` Verified: ${check}`));
    card.append(checkLabel);
    const copy = copyButton('Copy check', () => check); card.append(copy);
    const noteLabel = element('label', 'Verification note (optional)');
    const note = document.createElement('textarea');
    note.id = `verification-note-${index}`; note.maxLength = 2000; note.value = record.note;
    note.addEventListener('input', () => updateVerification(item, finding, { note: note.value }));
    noteLabel.htmlFor = note.id; card.append(noteLabel, note);
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

function renderReviewFocus(item, comparison) {
  const report = item.report;
  const findings = extractDashboardFindings(report);
  const focus = buildReviewFocus({
    report,
    findings,
    progress: verificationForReport(item),
    comparison,
    expiringSuppressions: upcomingSuppressions([item])
  });
  const section = element('section'); section.className = 'review-focus';
  section.append(element('h2', 'Review focus'));
  section.append(element('p', 'Prioritized review prompts from the selected report and its optional history. They do not approve a pull request or change Merge Guard results.'));
  const summary = element('p', `Verification recorded: ${focus.verification.completed} of ${focus.verification.total}.`);
  summary.className = 'summary'; section.append(summary);
  const actions = document.createElement('ol');
  focus.items.forEach((focusItem) => {
    const action = element('li'); action.className = `review-focus-${focusItem.priority}`;
    action.append(element('strong', focusItem.title), document.createTextNode(` — ${focusItem.detail}`));
    actions.append(action);
  });
  section.append(actions); output.append(section);
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
    const value = typeof content === 'function' ? content() : content;
    const url = URL.createObjectURL(new Blob([value], { type: 'text/plain;charset=utf-8' }));
    const link = element('a');
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  return button;
}

function copyButton(label, content) {
  const button = element('button', label); button.type = 'button';
  button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(content()); showStatus('Copied to clipboard.'); }
    catch { showStatus('Could not copy; select the text instead.', true); }
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

function markdownVerificationChecklist(item) {
  const report = item.report;
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
  const findings = extractDashboardFindings(report);
  const progress = verificationForReport(item);
  if (!findings.length) lines.push('- [ ] No rule findings were reported; confirm the intended scope and test coverage.');
  findings.forEach((finding) => {
    const record = progress.get(finding.identity) || { completed: false, note: '' };
    const check = finding.check || 'Record the verification you performed.';
    lines.push(`- [${record.completed ? 'x' : ' '}] **${findingLabel(finding)}** — ${check}`);
    lines.push(`  - Affected: ${finding.path ? `\`${finding.path}\`` : 'repository-wide finding'}`);
    if (finding.reason) lines.push(`  - Why: ${finding.reason}`);
    if (record.note) lines.push(`  - Note: ${record.note}`);
  });
  const generalChecks = list(report.suggestedChecks).filter((check) => !findings.some((finding) => finding.check === check));
  if (generalChecks.length) {
    lines.push('', '## Additional suggested checks', '');
    generalChecks.forEach((check) => lines.push(`- ${check}`));
  }
  return lines.join('\n') + '\n';
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

async function reportBinding(report) {
  if (!globalThis.crypto?.subtle) throw new Error('This browser cannot create the SHA-256 report binding required for verification progress.');
  const bytes = new TextEncoder().encode(canonicalJson(report));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function attachReportBindings(imports) {
  return Promise.all(imports.map(async (item) => item.kind === 'report' ? { ...item, reportBinding: await reportBinding(item.report) } : item));
}

function applyVerificationProgress(imports) {
  verificationByBinding = new Map();
  const progressItem = imports.find((item) => item.kind === 'verification-progress');
  if (!progressItem) { verificationProgressMessage = ''; return; }
  const reports = imports.filter((item) => item.kind === 'report');
  const matchedReport = reports.find((item) => item.reportBinding === progressItem.progress.reportBinding);
  if (!matchedReport) {
    verificationProgressMessage = reports.length
      ? `Progress from ${progressItem.name} was not applied because it belongs to a different report.`
      : `Progress from ${progressItem.name} is ready; import its original report in the same selection to apply it.`;
    return;
  }
  verificationByBinding.set(matchedReport.reportBinding, progressByFinding(progressItem.progress));
  verificationProgressMessage = `Progress from ${progressItem.name} was applied to ${matchedReport.name}.`;
}

async function importFiles(files) {
  const items = await Promise.all([...files].map(async (file) => ({ name: file.name, bytes: await file.arrayBuffer() })));
  const worker = new Worker('./import-worker.js', { type: 'module' });
  const timer = setTimeout(() => { worker.terminate(); showStatus('processing-timeout: validation exceeded 10 seconds', true); }, 10000);
  worker.onmessage = async ({ data }) => {
    clearTimeout(timer); worker.terminate();
    if (!data.ok) return showStatus(`${data.error.category}: ${data.error.message}`, true);
    try {
      committed = await attachReportBindings(data.imports); applyVerificationProgress(committed); earlierReportIndex = 0; render(committed); showStatus(`Loaded ${committed.length} validated file${committed.length === 1 ? '' : 's'}.`);
    } catch (error) { showStatus(`verification-progress: ${error.message}`, true); }
  };
  worker.postMessage({ items }, items.map((item) => item.bytes));
}

input.addEventListener('change', () => importFiles(input.files).catch((error) => showStatus(`malformed-input: ${error.message}`, true)));
dropZone.addEventListener('dragover', (event) => event.preventDefault());
dropZone.addEventListener('drop', (event) => { event.preventDefault(); importFiles(event.dataTransfer.files).catch((error) => showStatus(`malformed-input: ${error.message}`, true)); });
