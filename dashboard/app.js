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
