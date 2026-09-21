import { compareDashboardReports, extractDashboardFindings } from './comparison.js';
import { buildReviewFocus } from './review-focus.js';
import { createVerificationProgress, progressByFinding } from './verification-progress.js';
import {
  VERIFICATION_STATUSES,
  RUNTIME_DEFECT_SEVERITIES,
  createRuntimeDefect,
  createUserCheck,
  createVerificationSession,
  humanVerificationMarkdown,
  reportIdentity,
  verificationSummary
} from './human-verification.js';

const input = document.querySelector('#files');
const dropZone = document.querySelector('#drop-zone');
const status = document.querySelector('#status');
const output = document.querySelector('#output');
let committed = [];
let earlierReportIndex = 0;
let verificationByBinding = new Map();
let verificationProgressMessage = '';
let defectDraft = null;

function element(tag, text = '') {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

function list(value) { return Array.isArray(value) ? value : []; }
function nowIso() { return new Date().toISOString(); }
function newId(prefix) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${id}`;
}

function showStatus(message, error = false) {
  status.textContent = message;
  status.dataset.state = error ? 'error' : 'ready';
}

function render(imports) {
  output.replaceChildren();
  const reports = imports.filter((item) => item.kind === 'report');
  const selectedReports = reports.length === 2 ? comparisonPair(reports) : reports.length ? [reports[0]] : [];
  const comparison = reports.length === 2 ? compareDashboardReports(...selectedReports.map((item) => item.report)) : null;
  if (reports.length === 2) {
    renderComparisonControls(reports);
    renderComparison(selectedReports, comparison);
  }
  if (reports.length) renderReviewFocus(selectedReports.at(-1), comparison);
  if (reports.length) renderCalibration(reports, comparison);
  if (verificationProgressMessage) {
    const section = element('section');
    section.className = 'verification-progress';
    section.append(element('h2', 'Verification progress restore'), element('p', verificationProgressMessage));
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
  if (reports.length) renderHumanVerification(selectedReports.at(-1), comparison);
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
  section.append(exports);

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
  if (list(report.suggestedChecks).length) list(report.suggestedChecks).forEach((check) => checks.append(element('li', check)));
  else checks.append(element('li', 'No suggested checks were reported.'));
  section.append(checksHeading, checks);

  const addList = (headingText, values, fallback) => {
    const block = element('div'); block.append(element('h3', headingText));
    const valuesList = element('ul');
    if (values.length) values.forEach((value) => valuesList.append(element('li', typeof value === 'string' ? value : JSON.stringify(value))));
    else valuesList.append(element('li', fallback));
    block.append(valuesList); section.append(block);
  };
  addList('Warnings', [...(report.customRuleWarnings || []), ...(report.suppressionWarnings || []), ...(report.configDiagnostics || [])], 'No warnings reported.');
  addList('Suppressions', report.suppressedFindings || [], 'No suppressions reported.');
  output.append(section);
}

function sessionForReport(item) {
  return verificationByBinding.get(item.reportBinding) || null;
}

function progressForReview(item) {
  const session = sessionForReport(item);
  if (!session) return new Map();
  return new Map(session.items.filter((entry) => entry.findingIdentity).map((entry) => [entry.findingIdentity, { status: entry.status, note: entry.note }]));
}

function touchSession(session) {
  session.updatedAt = nowIso();
  showStatus('Human Verification evidence is ready to export.');
}

function startVerification(item, comparison) {
  const findings = extractDashboardFindings(item.report);
  const session = createVerificationSession({ report: item.report, findings, comparison, sessionId: newId('verification'), now: nowIso() });
  verificationByBinding.set(item.reportBinding, session);
  defectDraft = null;
  showStatus('Human Verification session started.');
  render(committed);
}

function renderHumanVerification(item, comparison) {
  const section = element('section');
  section.className = 'human-verification';
  section.append(element('h2', 'Human Verification'));
  section.append(element('p', 'Record what a person actually exercised. This evidence never changes Merge Guard scoring, findings, thresholds, or review semantics.'));
  section.append(element('p', `Report binding: ${item.reportBinding}`));
  const session = sessionForReport(item);
  if (!session) {
    section.append(element('p', 'No verification session has been started for this exact report. All checks will begin Untested.'));
    const start = element('button', 'Start verification');
    start.type = 'button';
    start.addEventListener('click', () => startVerification(item, comparison));
    section.append(start);
    output.append(section);
    return;
  }

  renderVerificationSummary(section, session);
  renderVerificationExports(section, item, session);
  renderSessionMetadata(section, session);
  renderVerificationPlan(section, item, session);
  renderCustomCheck(section, session);
  renderRuntimeDefects(section, item, session);

  const clear = element('button', 'Clear local verification session');
  clear.type = 'button'; clear.className = 'danger-button';
  clear.addEventListener('click', () => {
    if (!confirm('Clear this report-bound Human Verification session from browser memory? Export evidence first if you need to keep it.')) return;
    verificationByBinding.delete(item.reportBinding);
    defectDraft = null;
    showStatus('Local Human Verification session cleared.');
    render(committed);
  });
  section.append(clear);
  output.append(section);
}

function renderVerificationSummary(section, session) {
  const summary = verificationSummary(session);
  const block = element('div'); block.className = 'verification-summary';
  block.append(element('h3', 'Session summary'));
  block.append(element('p', `${summary.total} checks · ${summary.pass} passed · ${summary.fail} failed · ${summary.na} N/A · ${summary.untested} untested`));
  block.append(element('p', `Runtime defects: ${summary.runtimeDefects}`));
  if (summary.untested) block.append(element('p', `${summary.untested} check${summary.untested === 1 ? '' : 's'} remain untested.`));
  else if (summary.fail) block.append(element('p', 'Verification complete — failures recorded.'));
  else block.append(element('p', 'Verification complete — no failures recorded.'));
  const metadata = session.metadata;
  block.append(element('p', `Environment: ${metadata.device || 'Unavailable'} / ${metadata.browserRuntime || 'Unavailable'} · Build ${metadata.buildLabel || 'Unavailable'} · Commit ${metadata.commitSha || 'Unavailable'}`));
  section.append(block);
}

function renderVerificationExports(section, item, session) {
  const identity = reportIdentity(item.report);
  const exports = element('div'); exports.className = 'exports';
  exports.append(exportButton('Download Human Verification Markdown', `${item.name}-human-verification.md`, () => humanVerificationMarkdown({ reportBinding: item.reportBinding, reportIdentity: identity, session })));
  exports.append(copyButton('Copy Human Verification Markdown', () => humanVerificationMarkdown({ reportBinding: item.reportBinding, reportIdentity: identity, session })));
  exports.append(exportButton('Download Verification Progress JSON', `${item.name}-verification-progress.json`, () => `${JSON.stringify(createVerificationProgress(item.reportBinding, identity, session), null, 2)}\n`));
  section.append(exports);
}

function field(container, labelText, value, onInput, options = {}) {
  const id = newId('field');
  const label = element('label', labelText); label.htmlFor = id;
  let control;
  if (options.multiline) {
    control = document.createElement('textarea'); control.maxLength = options.maxLength || 8000;
  } else {
    control = document.createElement('input'); control.type = options.type || 'text'; control.maxLength = options.maxLength || 8000;
  }
  control.id = id;
  control.value = value ?? '';
  control.addEventListener('input', () => onInput(control.value));
  container.append(label, control);
  return control;
}

function renderSessionMetadata(section, session) {
  const details = document.createElement('details');
  details.className = 'verification-details';
  details.append(element('summary', 'Environment & session metadata'));
  const form = element('div'); form.className = 'metadata-grid';
  const update = (key, value) => {
    session.metadata[key] = key === 'pullRequestNumber' ? (value ? Number(value) : null) : value;
    touchSession(session);
  };
  field(form, 'Project/repository', session.metadata.projectName, (value) => update('projectName', value));
  field(form, 'Branch', session.metadata.branch, (value) => update('branch', value));
  field(form, 'Pull request number', session.metadata.pullRequestNumber || '', (value) => update('pullRequestNumber', value), { type: 'number' });
  field(form, 'Build/version label', session.metadata.buildLabel, (value) => update('buildLabel', value));
  field(form, 'Commit SHA', session.metadata.commitSha, (value) => update('commitSha', value));
  field(form, 'Tester name or alias', session.metadata.tester, (value) => update('tester', value));
  field(form, 'Date/time', session.metadata.dateTime, (value) => update('dateTime', value), { type: 'datetime-local' });
  field(form, 'Device', session.metadata.device, (value) => update('device', value));
  field(form, 'Operating system', session.metadata.operatingSystem, (value) => update('operatingSystem', value));
  field(form, 'Browser/runtime', session.metadata.browserRuntime, (value) => update('browserRuntime', value));
  field(form, 'Test objective', session.metadata.objective, (value) => update('objective', value), { multiline: true, maxLength: 8000 });
  field(form, 'Environment note', session.metadata.environmentNote, (value) => update('environmentNote', value), { multiline: true, maxLength: 8000 });
  details.append(form); section.append(details);
}

function renderVerificationPlan(section, item, session) {
  section.append(element('h3', 'Verification plan'));
  section.append(element('p', 'Statuses start Untested. Pass, Fail, and N/A are human-recorded outcomes; none of them change deterministic Merge Guard analysis.'));
  const cards = element('div'); cards.className = 'verification-cards';
  if (!session.items.length) cards.append(element('p', 'No generated checks are available. Add a user check below if manual verification is still needed.'));
  session.items.forEach((check, index) => {
    const card = element('article'); card.className = `verification-card status-${check.status}`;
    const title = element('h4', check.title); card.append(title);
    const origin = element('p', check.kind === 'user' ? 'User-added check' : check.provenance); origin.className = 'provenance'; card.append(origin);
    if (check.comparisonState === 'new') card.append(element('p', 'New finding in the current report — prioritized for current-build verification.'));
    card.append(element('p', `Reason: ${check.reason || 'Unavailable'}`));
    card.append(element('p', `Affected files: ${check.affectedFiles?.length ? check.affectedFiles.join(', ') : 'None reported'}`));
    card.append(element('p', `Suggested verification: ${check.instruction || 'Unavailable'}`));
    if (check.ruleId || check.findingIdentity) card.append(element('p', `Related finding/rule: ${check.ruleId || check.findingIdentity}`));

    const statusId = `verification-status-${index}`;
    const statusLabel = element('label', 'Verification status'); statusLabel.htmlFor = statusId;
    const select = document.createElement('select'); select.id = statusId;
    for (const value of VERIFICATION_STATUSES) {
      const option = element('option', value === 'na' ? 'N/A' : value[0].toUpperCase() + value.slice(1));
      option.value = value; select.append(option);
    }
    select.value = check.status;
    select.addEventListener('change', () => {
      check.status = select.value;
      touchSession(session);
      render(committed);
    });
    card.append(statusLabel, select);

    const noteLabel = element('label', 'Tester note (optional)'); noteLabel.htmlFor = `verification-note-${index}`;
    const note = document.createElement('textarea'); note.id = `verification-note-${index}`; note.maxLength = 2000; note.value = check.note;
    note.addEventListener('input', () => { check.note = note.value; touchSession(session); });
    card.append(noteLabel, note);

    if (check.status === 'fail') {
      const defect = element('button', 'Record runtime defect'); defect.type = 'button';
      defect.addEventListener('click', () => { defectDraft = { reportBinding: item.reportBinding, relatedVerificationItem: check.id, relatedFinding: check.findingIdentity }; render(committed); });
      card.append(defect);
    }
    if (check.kind === 'user') {
      const remove = element('button', 'Remove user-added check'); remove.type = 'button'; remove.className = 'danger-button';
      remove.addEventListener('click', () => {
        if (!confirm(`Remove user-added check “${check.title}”?`)) return;
        session.items = session.items.filter((entry) => entry.id !== check.id);
        touchSession(session); render(committed);
      });
      card.append(remove);
    }
    cards.append(card);
  });
  section.append(cards);
}

function renderCustomCheck(section, session) {
  const details = document.createElement('details'); details.className = 'verification-details';
  details.append(element('summary', 'Add a custom manual check'));
  const wrap = element('div');
  const title = field(wrap, 'Check title', '', () => {});
  const instruction = field(wrap, 'Short instruction', '', () => {}, { multiline: true });
  const notes = field(wrap, 'Optional notes', '', () => {}, { multiline: true, maxLength: 2000 });
  const add = element('button', 'Add user check'); add.type = 'button';
  add.addEventListener('click', () => {
    if (!title.value.trim()) return showStatus('Custom check title is required.', true);
    session.items.push(createUserCheck({ id: newId('user-check'), title: title.value, instruction: instruction.value, note: notes.value }));
    touchSession(session); render(committed);
  });
  wrap.append(add); details.append(wrap); section.append(details);
}

function renderRuntimeDefects(section, item, session) {
  const heading = element('h3', 'Runtime defects'); section.append(heading);
  section.append(element('p', 'These are human-observed runtime defects. They remain separate from deterministic Merge Guard findings and do not modify the risk score.'));
  const addStandalone = element('button', 'Record standalone runtime defect'); addStandalone.type = 'button';
  addStandalone.addEventListener('click', () => { defectDraft = { reportBinding: item.reportBinding, relatedVerificationItem: null, relatedFinding: null }; render(committed); });
  section.append(addStandalone);

  if (defectDraft?.reportBinding === item.reportBinding) renderRuntimeDefectForm(section, session, defectDraft);

  const defects = element('div'); defects.className = 'runtime-defects';
  if (!session.runtimeDefects.length) defects.append(element('p', 'No human-observed runtime defects recorded.'));
  for (const defect of session.runtimeDefects) {
    const card = element('article'); card.className = 'runtime-defect';
    card.append(element('h4', `${defect.severity.toUpperCase()} — ${defect.title}`));
    card.append(element('p', defect.observationState === 'reopened' ? 'Reopened human-observed runtime defect' : 'New human-observed runtime defect'));
    card.append(element('p', `Component: ${defect.component || 'Unavailable'}`));
    card.append(element('p', `Expected: ${defect.expectedBehavior || 'Unavailable'}`));
    card.append(element('p', `Actual: ${defect.actualBehavior || 'Unavailable'}`));
    card.append(element('p', `Reproduction: ${defect.reproductionSteps || 'Unavailable'}`));
    card.append(element('p', `Evidence reference: ${defect.evidenceReference || 'Unavailable'}`));
    if (defect.relatedVerificationItem) card.append(element('p', `Related check: ${defect.relatedVerificationItem}`));
    if (defect.relatedFinding) card.append(element('p', `Related Merge Guard finding: ${defect.relatedFinding}`));
    defects.append(card);
  }
  section.append(defects);
}

function renderRuntimeDefectForm(section, session, draft) {
  const form = element('div'); form.className = 'runtime-defect-form';
  form.append(element('h4', 'Record human-observed runtime defect'));
  const title = field(form, 'Title', '', () => {});
  const severityLabel = element('label', 'Severity'); severityLabel.htmlFor = 'runtime-defect-severity';
  const severity = document.createElement('select'); severity.id = 'runtime-defect-severity';
  for (const value of RUNTIME_DEFECT_SEVERITIES) { const option = element('option', value[0].toUpperCase() + value.slice(1)); option.value = value; severity.append(option); }
  severity.value = 'medium'; form.append(severityLabel, severity);
  const observationLabel = element('label', 'Observation state'); observationLabel.htmlFor = 'runtime-defect-observation';
  const observation = document.createElement('select'); observation.id = 'runtime-defect-observation';
  for (const [value, label] of [['new', 'Newly observed'], ['reopened', 'Reopened from previous verification']]) { const option = element('option', label); option.value = value; observation.append(option); }
  form.append(observationLabel, observation);
  const component = field(form, 'Component', '', () => {});
  const expected = field(form, 'Expected behavior', '', () => {}, { multiline: true });
  const actual = field(form, 'Actual behavior', '', () => {}, { multiline: true });
  const reproduction = field(form, 'Reproduction steps', '', () => {}, { multiline: true });
  const environment = field(form, 'Optional environment note', '', () => {}, { multiline: true });
  const evidence = field(form, 'Optional evidence reference', '', () => {});
  const save = element('button', 'Save runtime defect'); save.type = 'button';
  save.addEventListener('click', () => {
    if (!title.value.trim()) return showStatus('Runtime defect title is required.', true);
    session.runtimeDefects.push(createRuntimeDefect({
      id: newId('runtime-defect'), title: title.value, severity: severity.value, component: component.value,
      expectedBehavior: expected.value, actualBehavior: actual.value, reproductionSteps: reproduction.value,
      environmentNote: environment.value, evidenceReference: evidence.value,
      relatedVerificationItem: draft.relatedVerificationItem, relatedFinding: draft.relatedFinding,
      observationState: observation.value
    }));
    touchSession(session); defectDraft = null; render(committed);
  });
  const cancel = element('button', 'Cancel'); cancel.type = 'button'; cancel.className = 'secondary-button';
  cancel.addEventListener('click', () => { defectDraft = null; render(committed); });
  form.append(save, cancel); section.append(form);
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
  reports.forEach((report, index) => { const option = element('option', report.name); option.value = String(index); select.append(option); });
  select.value = String(earlierReportIndex);
  select.addEventListener('change', () => { earlierReportIndex = Number(select.value); defectDraft = null; render(committed); });
  label.append(select); section.append(label);
  const latest = comparisonPair(reports)[1]; section.append(element('p', `Latest report: ${latest.name}.`));
  const swap = element('button', 'Swap reports'); swap.type = 'button';
  swap.addEventListener('click', () => { earlierReportIndex = earlierReportIndex === 0 ? 1 : 0; defectDraft = null; render(committed); });
  section.append(swap); output.append(section);
}

function findingLabel(finding) { return `${finding.label} — ${finding.path || 'global finding'}`; }

function renderComparison([previousItem, currentItem], comparison) {
  const previous = previousItem.report; const current = currentItem.report;
  const section = element('section'); section.className = 'comparison';
  section.append(element('h2', 'What changed since the previous report'));
  section.append(element('p', `Comparing ${previousItem.name} → ${currentItem.name}. Risk score ${previous.riskScore} → ${current.riskScore} (${scoreChange(previous.riskScore, current.riskScore)}).`));
  const summary = element('p', `New: ${comparison.summary.new} · Unchanged: ${comparison.summary.unchanged} · Resolved: ${comparison.summary.resolved}`); summary.className = 'summary'; section.append(summary);
  if (comparison.configurationChanged) section.append(element('p', 'Configuration changed between reports; compare scores and findings with that context in mind.'));
  comparisonList(section, 'New findings — review these first', comparison.newFindings, (finding) => finding.reason || 'No explanation supplied.');
  comparisonList(section, 'Resolved findings', comparison.resolvedFindings, () => 'Absent from the latest report; this is report comparison state, not a manual Pass.');
  const unchanged = document.createElement('details'); unchanged.append(element('summary', `Unchanged findings (${comparison.summary.unchanged})`));
  const unchangedList = element('ul');
  if (!comparison.unchangedFindings.length) unchangedList.append(element('li', 'None.'));
  comparison.unchangedFindings.forEach(({ current: finding, detailsChanged }) => unchangedList.append(element('li', `${findingLabel(finding)} — ${detailsChanged ? `Explanation changed: ${finding.reason}` : 'The finding remains with the same explanation. Current verification is still explicit.'}`)));
  unchanged.append(unchangedList); section.append(unchanged); output.append(section);
}

function renderReviewFocus(item, comparison) {
  const report = item.report; const findings = extractDashboardFindings(report);
  const focus = buildReviewFocus({ report, findings, progress: progressForReview(item), comparison, expiringSuppressions: upcomingSuppressions([item]) });
  const section = element('section'); section.className = 'review-focus';
  section.append(element('h2', 'Review focus'));
  section.append(element('p', 'Prioritized review prompts from the selected report and its optional history. They do not approve a pull request or change Merge Guard results.'));
  const summary = element('p', `Current-report verification recorded: ${focus.verification.completed} of ${focus.verification.total}.`); summary.className = 'summary'; section.append(summary);
  const actions = document.createElement('ol');
  focus.items.forEach((focusItem) => { const action = element('li'); action.className = `review-focus-${focusItem.priority}`; action.append(element('strong', focusItem.title), document.createTextNode(` — ${focusItem.detail}`)); actions.append(action); });
  section.append(actions); output.append(section);
}

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number); const timestamp = Date.UTC(year, month - 1, day); const date = new Date(timestamp);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? timestamp : null;
}

function upcomingSuppressions(reports) {
  const now = new Date(); const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()); const limit = today + 30 * 86400000; const unique = new Map();
  reports.forEach((item) => list(item.report?.config?.suppressions).forEach((suppression) => {
    const expiry = calendarDate(suppression?.expires); if (expiry === null || expiry < today || expiry > limit) return;
    const key = [suppression.ruleId, suppression.pathPattern || '', suppression.owner, suppression.expires].join('\u0000'); unique.set(key, suppression);
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
  expiryBlock.append(expiryList); section.append(expiryBlock); output.append(section);
}

function signedDelta(value) { return `${value > 0 ? '+' : ''}${value}`; }
function scoreChange(previous, current) { return signedDelta(current - previous); }
function comparisonList(section, heading, entries, description) {
  const block = element('div'); block.append(element('h3', heading)); const items = element('ul');
  if (!entries.length) items.append(element('li', 'None.'));
  entries.forEach((entry) => { const item = element('li'); item.append(element('strong', findingLabel(entry)), document.createTextNode(` — ${description(entry)}`)); items.append(item); });
  block.append(items); section.append(block);
}

function exportButton(label, filename, content) {
  const button = element('button', label); button.type = 'button';
  button.addEventListener('click', () => {
    const value = typeof content === 'function' ? content() : content;
    const url = URL.createObjectURL(new Blob([value], { type: 'text/plain;charset=utf-8' }));
    const link = element('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  return button;
}

function copyButton(label, content) {
  const button = element('button', label); button.type = 'button';
  button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(content()); showStatus('Copied to clipboard.'); }
    catch { showStatus('Could not copy; use the download instead.', true); }
  });
  return button;
}

function markdownReport(report) {
  const lines = ['# Merge Guard report', '', `- Risk level: ${report.riskLevel}`, `- Merge readiness: ${report.mergeReadiness}`, `- Risk score: ${report.riskScore}`, '', '## Files'];
  for (const file of report.files || []) lines.push(`- **${file.riskLevel || 'UNSPECIFIED'}** ${file.path} — score ${file.riskScore ?? 'n/a'}: ${file.reason || 'No explanation supplied.'}`);
  lines.push('', '## Suggested checks'); for (const check of report.suggestedChecks || []) lines.push(`- [ ] ${check}`); return lines.join('\n') + '\n';
}

function markdownVerificationChecklist(item) {
  const report = item.report; const session = sessionForReport(item);
  const statuses = session ? new Map(session.items.filter((entry) => entry.findingIdentity).map((entry) => [entry.findingIdentity, entry])) : new Map();
  const lines = ['# Merge Guard verification checklist', '', `- Risk level: ${report.riskLevel}`, `- Review decision: ${report.reviewDecision || report.mergeReadiness}`, `- Risk score: ${report.riskScore}`, '', '> This checklist is human work evidence only; it does not approve a pull request or change Merge Guard findings.', '', '## Findings to verify', ''];
  const findings = extractDashboardFindings(report);
  if (!findings.length) lines.push('- [ ] No rule findings were reported; confirm the intended scope and test coverage.');
  findings.forEach((finding) => {
    const record = statuses.get(finding.identity); const check = finding.check || 'Record the verification you performed.';
    lines.push(`- [${record?.status === 'pass' ? 'x' : ' '}] **${findingLabel(finding)}** — ${check}`);
    lines.push(`  - Status: ${record?.status ? (record.status === 'na' ? 'N/A' : record.status.toUpperCase()) : 'UNTESTED'}`);
    lines.push(`  - Affected: ${finding.path ? `\`${finding.path}\`` : 'repository-wide finding'}`);
    if (finding.reason) lines.push(`  - Why: ${finding.reason}`); if (record?.note) lines.push(`  - Note: ${record.note}`);
  });
  return lines.join('\n') + '\n';
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

async function reportBinding(report) {
  if (!globalThis.crypto?.subtle) throw new Error('This browser cannot create the SHA-256 report binding required for Human Verification.');
  const bytes = new TextEncoder().encode(canonicalJson(report)); const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function attachReportBindings(imports) {
  return Promise.all(imports.map(async (item) => item.kind === 'report' ? { ...item, reportBinding: await reportBinding(item.report) } : item));
}

function identityText(identity) {
  if (!identity) return 'identity unavailable';
  return [identity.repository, identity.commitSha].filter(Boolean).join(' @ ') || 'identity unavailable';
}

function applyVerificationProgress(imports) {
  verificationByBinding = new Map(); defectDraft = null;
  const progressItem = imports.find((item) => item.kind === 'verification-progress');
  if (!progressItem) { verificationProgressMessage = ''; return; }
  const reports = imports.filter((item) => item.kind === 'report');
  const matchedReport = reports.find((item) => item.reportBinding === progressItem.progress.reportBinding);
  if (!matchedReport) {
    const evidenceIdentity = progressItem.progress.reportIdentity || null;
    const available = reports.map((item) => identityText(reportIdentity(item.report))).join('; ');
    verificationProgressMessage = reports.length
      ? `Evidence from ${progressItem.name} was not applied: report binding mismatch. Evidence: ${identityText(evidenceIdentity)}. Imported report(s): ${available || 'identity unavailable'}. The evidence file remains untouched.`
      : `Evidence from ${progressItem.name} is ready but was not applied. Import its exact original report in the same selection.`;
    return;
  }
  if (progressItem.progress.schemaVersion === 2) {
    verificationByBinding.set(matchedReport.reportBinding, JSON.parse(JSON.stringify(progressItem.progress.session)));
    verificationProgressMessage = `Human Verification evidence from ${progressItem.name} was restored for ${matchedReport.name}.`;
    return;
  }
  const session = createVerificationSession({ report: matchedReport.report, findings: extractDashboardFindings(matchedReport.report), comparison: null, sessionId: `legacy-v1:${matchedReport.reportBinding.slice(0, 16)}`, now: null });
  const legacy = progressByFinding(progressItem.progress);
  for (const item of session.items) {
    if (!item.findingIdentity || !legacy.has(item.findingIdentity)) continue;
    const record = legacy.get(item.findingIdentity); item.status = record.status; item.note = record.note;
  }
  verificationByBinding.set(matchedReport.reportBinding, session);
  verificationProgressMessage = `Legacy verification-progress schema v1 from ${progressItem.name} was restored for ${matchedReport.name}. Explicit migration: completed=true becomes Pass; incomplete becomes Untested. Export again to save schema v2 Human Verification evidence.`;
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
