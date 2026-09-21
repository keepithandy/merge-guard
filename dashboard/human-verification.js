export const VERIFICATION_STATUSES = Object.freeze(['untested', 'pass', 'fail', 'na']);
export const RUNTIME_DEFECT_SEVERITIES = Object.freeze(['critical', 'high', 'medium', 'low']);
export const VERIFICATION_NOTE_MAX_LENGTH = 2000;
export const VERIFICATION_TEXT_MAX_LENGTH = 8000;

function list(value) { return Array.isArray(value) ? value : []; }
function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function nullableText(value) { const valueText = text(value); return valueText || null; }
function status(value) { return VERIFICATION_STATUSES.includes(value) ? value : 'untested'; }
function normalizePrNumber(value) { return Number.isInteger(value) && value > 0 ? value : null; }

export function reportIdentity(report) {
  return Object.freeze({
    repository: nullableText(report?.repository),
    branch: nullableText(report?.branch),
    pullRequestNumber: normalizePrNumber(report?.pullRequestNumber),
    commitSha: nullableText(report?.commitSha)
  });
}

export function initialVerificationMetadata(report) {
  const identity = reportIdentity(report);
  return {
    projectName: identity.repository || '',
    branch: identity.branch || '',
    pullRequestNumber: identity.pullRequestNumber,
    buildLabel: '',
    commitSha: identity.commitSha || '',
    tester: '',
    dateTime: '',
    device: '',
    operatingSystem: '',
    browserRuntime: '',
    objective: '',
    environmentNote: ''
  };
}

function affectedFiles(finding) {
  return finding?.path ? [finding.path] : [];
}

function findingConcern(report, finding) {
  const file = list(report?.files).find((candidate) => candidate?.path === finding?.path);
  return {
    weight: Number.isInteger(finding?.weight) ? finding.weight : 0,
    fileRiskScore: Number.isFinite(file?.riskScore) ? file.riskScore : 0
  };
}

export function buildVerificationPlan(report, findings, comparison = null) {
  const newIdentities = new Set(list(comparison?.newFindings).map((finding) => finding.identity));
  const plan = findings.map((finding) => {
    const concern = findingConcern(report, finding);
    return {
      id: `finding:${finding.identity}`,
      kind: 'merge-guard',
      title: finding.label || finding.ruleId || 'Merge Guard finding',
      instruction: finding.check || 'Exercise the affected surface and record what happened.',
      reason: finding.reason || 'No reason supplied.',
      affectedFiles: affectedFiles(finding),
      provenance: `Merge Guard ${finding.source || 'finding'}`,
      findingIdentity: finding.identity,
      ruleId: finding.ruleId || null,
      comparisonState: newIdentities.has(finding.identity) ? 'new' : 'current',
      status: 'untested',
      note: '',
      _order: { isNew: newIdentities.has(finding.identity) ? 0 : 1, weight: concern.weight, fileRiskScore: concern.fileRiskScore }
    };
  });

  const associatedChecks = new Set(findings.map((finding) => finding.check).filter(Boolean));
  list(report?.suggestedChecks).forEach((check, index) => {
    if (typeof check !== 'string' || !check.trim() || associatedChecks.has(check)) return;
    plan.push({
      id: `suggested:${index}`,
      kind: 'merge-guard',
      title: 'Suggested verification',
      instruction: check.trim(),
      reason: 'Suggested by the imported Merge Guard report.',
      affectedFiles: [],
      provenance: 'Merge Guard suggested check',
      findingIdentity: null,
      ruleId: null,
      comparisonState: 'current',
      status: 'untested',
      note: '',
      _order: { isNew: 2, weight: 0, fileRiskScore: 0 }
    });
  });

  return plan
    .sort((left, right) => left._order.isNew - right._order.isNew || right._order.weight - left._order.weight || right._order.fileRiskScore - left._order.fileRiskScore || left.id.localeCompare(right.id))
    .map(({ _order, ...item }) => item);
}

export function createVerificationSession({ report, findings, comparison = null, sessionId, now }) {
  if (!sessionId) throw new Error('verification session identity is required');
  const timestamp = typeof now === 'string' && now ? now : null;
  return {
    id: sessionId,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: initialVerificationMetadata(report),
    items: buildVerificationPlan(report, findings, comparison),
    runtimeDefects: []
  };
}

export function createUserCheck({ id, title, instruction = '', note = '' }) {
  if (!id || !text(title)) throw new Error('user-added check requires an id and title');
  return {
    id,
    kind: 'user',
    title: text(title),
    instruction: text(instruction),
    reason: 'Added by the human verifier.',
    affectedFiles: [],
    provenance: 'User-added check',
    findingIdentity: null,
    ruleId: null,
    comparisonState: 'current',
    status: 'untested',
    note: text(note)
  };
}

export function createRuntimeDefect({
  id,
  title,
  severity = 'medium',
  component = '',
  expectedBehavior = '',
  actualBehavior = '',
  reproductionSteps = '',
  environmentNote = '',
  evidenceReference = '',
  relatedVerificationItem = null,
  relatedFinding = null,
  observationState = 'new'
}) {
  if (!id || !text(title)) throw new Error('runtime defect requires an id and title');
  if (!RUNTIME_DEFECT_SEVERITIES.includes(severity)) throw new Error('runtime defect severity is invalid');
  if (!['new', 'reopened'].includes(observationState)) throw new Error('runtime defect observation state is invalid');
  return {
    id,
    kind: 'human-runtime-defect',
    title: text(title),
    severity,
    component: text(component),
    expectedBehavior: text(expectedBehavior),
    actualBehavior: text(actualBehavior),
    reproductionSteps: text(reproductionSteps),
    environmentNote: text(environmentNote),
    evidenceReference: text(evidenceReference),
    relatedVerificationItem,
    relatedFinding,
    observationState
  };
}

export function verificationSummary(session) {
  const summary = { total: 0, pass: 0, fail: 0, na: 0, untested: 0, runtimeDefects: list(session?.runtimeDefects).length };
  for (const item of list(session?.items)) {
    summary.total += 1;
    summary[status(item?.status)] += 1;
  }
  return Object.freeze(summary);
}

function displayStatus(value) {
  return value === 'na' ? 'N/A' : value.toUpperCase();
}

function display(value) {
  const valueText = text(value);
  return valueText || 'Unavailable';
}

function markdownLines(value, prefix = '') {
  const valueText = text(value);
  return valueText ? valueText.split(/\r?\n/).map((line) => `${prefix}${line}`) : [`${prefix}Unavailable`];
}

export function humanVerificationMarkdown({ reportBinding, reportIdentity: identity, session }) {
  const summary = verificationSummary(session);
  const metadata = session.metadata || {};
  const lines = [
    '# Merge Guard Human Verification', '',
    '## Report Binding', '',
    `- Repository: ${display(identity?.repository || metadata.projectName)}`,
    `- Commit: ${display(identity?.commitSha || metadata.commitSha)}`,
    `- Report digest: ${reportBinding}`,
    `- Verification session: ${display(session.id)}`,
    `- Created: ${display(session.createdAt)}`,
    `- Updated: ${display(session.updatedAt)}`,
    '', '## Environment', '',
    `- Device: ${display(metadata.device)}`,
    `- OS: ${display(metadata.operatingSystem)}`,
    `- Browser/runtime: ${display(metadata.browserRuntime)}`,
    `- Build: ${display(metadata.buildLabel)}`,
    `- Tester: ${display(metadata.tester)}`,
    `- Branch: ${display(metadata.branch)}`,
    `- Pull request: ${metadata.pullRequestNumber || 'Unavailable'}`,
    `- Objective: ${display(metadata.objective)}`,
    `- Environment note: ${display(metadata.environmentNote)}`,
    '', '## Summary', '',
    `- Passed: ${summary.pass}`,
    `- Failed: ${summary.fail}`,
    `- N/A: ${summary.na}`,
    `- Untested: ${summary.untested}`,
    `- Runtime defects: ${summary.runtimeDefects}`,
    '', '## Verification Results', ''
  ];

  for (const item of list(session.items)) {
    lines.push(`[${displayStatus(status(item.status))}] ${item.title}`);
    lines.push('');
    lines.push(`Provenance: ${display(item.provenance)}`);
    lines.push(`Reason: ${display(item.reason)}`);
    lines.push(`Affected files: ${item.affectedFiles?.length ? item.affectedFiles.join(', ') : 'None reported'}`);
    lines.push(`Suggested verification: ${display(item.instruction)}`);
    lines.push(`Related finding/rule: ${display(item.ruleId || item.findingIdentity)}`);
    lines.push(`Tester note: ${display(item.note)}`);
    lines.push('');
  }

  lines.push('## Runtime Defects', '');
  if (!summary.runtimeDefects) lines.push('No human-observed runtime defects recorded.', '');
  for (const defect of list(session.runtimeDefects)) {
    lines.push(`${String(defect.severity || 'medium').toUpperCase()} — ${defect.title}`);
    lines.push('');
    lines.push(`Observation: ${defect.observationState === 'reopened' ? 'Reopened runtime defect' : 'New human-observed runtime defect'}`);
    lines.push(`Component: ${display(defect.component)}`);
    lines.push('Expected:');
    lines.push(...markdownLines(defect.expectedBehavior, '  '));
    lines.push('Actual:');
    lines.push(...markdownLines(defect.actualBehavior, '  '));
    lines.push('Reproduction:');
    lines.push(...markdownLines(defect.reproductionSteps, '  '));
    lines.push(`Related check: ${display(defect.relatedVerificationItem)}`);
    lines.push(`Related Merge Guard finding: ${display(defect.relatedFinding)}`);
    lines.push(`Evidence reference: ${display(defect.evidenceReference)}`);
    lines.push(`Environment note: ${display(defect.environmentNote)}`, '');
  }

  lines.push('## Disclaimer', '', 'Human verification records testing performed by a person. It does not alter Merge Guard’s deterministic risk analysis or constitute merge approval.', '');
  return lines.join('\n');
}
