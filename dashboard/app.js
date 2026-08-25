const input = document.querySelector('#files');
const dropZone = document.querySelector('#drop-zone');
const status = document.querySelector('#status');
const output = document.querySelector('#output');
let committed = [];

function showStatus(message, error = false) {
  status.textContent = message;
  status.dataset.state = error ? 'error' : 'ready';
}

function render(imports) {
  output.replaceChildren();
  for (const item of imports) {
    const line = document.createElement('li');
    line.textContent = item.kind === 'report'
      ? `${item.name}: Merge Guard report (${item.report.riskLevel}, score ${item.report.riskScore})`
      : `${item.name}: unified diff (${item.text.split(/\r?\n/).length} lines)`;
    output.append(line);
  }
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
