const input = document.querySelector('#files');
const dropZone = document.querySelector('#drop-zone');
const status = document.querySelector('#status');
const output = document.querySelector('#output');
let committed = [];

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
  if (reports.length === 2) renderComparison(reports[0], reports[1]);
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

function ruleIdentity(rule) {
  return `${rule.id || ''}\u0000${list(rule.matchedFiles).slice().sort().join('\u0000')}`;
}

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

function renderComparison(previousItem, currentItem) {
  const previous = previousItem.report;
  const current = currentItem.report;
  const before = new Map(list(previous.rules).map((rule) => [ruleIdentity(rule), rule]));
  const after = new Map(list(current.rules).map((rule) => [ruleIdentity(rule), rule]));
  const newRules = [...after].filter(([identity]) => !before.has(identity)).map(([, rule]) => rule);
  const resolvedRules = [...before].filter(([identity]) => !after.has(identity)).map(([, rule]) => rule);
  const unchangedRules = [...after].filter(([identity]) => before.has(identity)).map(([identity, rule]) => ({ rule, previous: before.get(identity) }));
  const section = element('section'); section.className = 'comparison';
  section.append(element('h2', 'What changed since the previous report'));
  section.append(element('p', `Comparing ${previousItem.name} → ${currentItem.name}. Risk score ${previous.riskScore} → ${current.riskScore} (${scoreChange(previous.riskScore, current.riskScore)}).`));
  const summary = element('p', `New: ${newRules.length} · Unchanged: ${unchangedRules.length} · Resolved: ${resolvedRules.length}`); summary.className = 'summary'; section.append(summary);
  comparisonList(section, 'New findings — review these first', newRules, (rule) => rule.reason || 'No explanation supplied.');
  comparisonList(section, 'Resolved findings', resolvedRules, () => 'Absent from the latest report; this does not by itself prove remediation.');
  comparisonList(section, 'Unchanged findings', unchangedRules, ({ rule, previous: oldRule }) => oldRule.reason === rule.reason ? 'The finding remains with the same explanation.' : `Explanation changed: ${rule.reason || 'No explanation supplied.'}`);
  output.append(section);
}

function signedDelta(value) { return `${value > 0 ? '+' : ''}${value}`; }

function scoreChange(previous, current) { return signedDelta(current - previous); }

function comparisonList(section, heading, entries, description) {
  const block = element('div'); block.append(element('h3', heading));
  const items = element('ul');
  if (!entries.length) items.append(element('li', 'None.'));
  entries.forEach((entry) => {
    const rule = entry.rule || entry;
    const item = element('li'); item.append(element('strong', rule.label || rule.id || 'Unnamed finding'), document.createTextNode(` — ${description(entry)}`)); items.append(item);
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

async function importFiles(files) {
  const items = await Promise.all([...files].map(async (file) => ({ name: file.name, bytes: await file.arrayBuffer() })));
  const worker = new Worker('./import-worker.js', { type: 'module' });
  const timer = setTimeout(() => { worker.terminate(); showStatus('processing-timeout: validation exceeded 10 seconds', true); }, 10000);
  worker.onmessage = ({ data }) => {
    clearTimeout(timer); worker.terminate();
    if (!data.ok) return showStatus(`${data.error.category}: ${data.error.message}`, true);
    committed = data.imports; render(committed); showStatus(`Loaded ${committed.length} validated file${committed.length === 1 ? '' : 's'}.`);
  };
  worker.postMessage({ items }, items.map((item) => item.bytes));
}

input.addEventListener('change', () => importFiles(input.files).catch((error) => showStatus(`malformed-input: ${error.message}`, true)));
dropZone.addEventListener('dragover', (event) => event.preventDefault());
dropZone.addEventListener('drop', (event) => { event.preventDefault(); importFiles(event.dataTransfer.files).catch((error) => showStatus(`malformed-input: ${error.message}`, true)); });
