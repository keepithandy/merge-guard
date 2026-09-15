function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizePath(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0') || normalized.split('/').some((part) => part === '..' || !part)) return null;
  return normalized;
}

function findingSource(rule) {
  if (text(rule?.policyPackId)) return `policy:${text(rule.policyPackId)}`;
  if (rule?.custom === true) return 'custom';
  return 'builtin';
}

function findingPaths(rule, report) {
  const direct = [...new Set(list(rule?.matchedFiles).map(normalizePath).filter(Boolean))].sort();
  if (direct.length) return direct;
  const inferred = [];
  for (const file of list(report?.files)) {
    if (!list(file?.rules).some((item) => item?.id === rule?.id)) continue;
    const filePath = normalizePath(file?.path);
    if (filePath) inferred.push(filePath);
  }
  return [...new Set(inferred)].sort();
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function findingRecord(rule, path) {
  const ruleId = text(rule?.id, 'unknown-rule');
  const source = findingSource(rule);
  const identity = JSON.stringify([source, ruleId, path]);
  return {
    identity,
    source,
    ruleId,
    path,
    label: text(rule?.label, ruleId),
    weight: Number.isInteger(rule?.weight) ? rule.weight : 0,
    reason: text(rule?.reason, 'No reason supplied.'),
    check: text(rule?.check) || null,
    matchedLineCount: Number.isInteger(rule?.matchedLineCount) ? rule.matchedLineCount : 0,
    policyPackId: text(rule?.policyPackId) || null,
    policyPackVersion: text(rule?.policyPackVersion) || null,
    exceptionIds: list(rule?.policyExceptions).map((item) => text(item?.id)).filter(Boolean).sort()
  };
}

export function extractDashboardFindings(report) {
  const findings = new Map();
  for (const rule of list(report?.rules)) {
    const paths = findingPaths(rule, report);
    for (const path of paths.length ? paths : [null]) {
      const finding = findingRecord(rule, path);
      if (!findings.has(finding.identity)) findings.set(finding.identity, finding);
    }
  }
  return [...findings.values()].sort((left, right) => left.identity.localeCompare(right.identity));
}

export function compareDashboardReports(previousReport, currentReport) {
  const previous = extractDashboardFindings(previousReport);
  const current = extractDashboardFindings(currentReport);
  const previousByIdentity = new Map(previous.map((finding) => [finding.identity, finding]));
  const currentByIdentity = new Map(current.map((finding) => [finding.identity, finding]));
  const newFindings = current.filter((finding) => !previousByIdentity.has(finding.identity));
  const resolvedFindings = previous.filter((finding) => !currentByIdentity.has(finding.identity));
  const unchangedFindings = current
    .filter((finding) => previousByIdentity.has(finding.identity))
    .map((finding) => ({
      identity: finding.identity,
      previous: previousByIdentity.get(finding.identity),
      current: finding,
      detailsChanged: canonicalJson(previousByIdentity.get(finding.identity)) !== canonicalJson(finding)
    }));
  return {
    summary: { new: newFindings.length, unchanged: unchangedFindings.length, resolved: resolvedFindings.length },
    newFindings,
    unchangedFindings,
    resolvedFindings,
    configurationChanged: canonicalJson(previousReport?.config || {}) !== canonicalJson(currentReport?.config || {})
  };
}
