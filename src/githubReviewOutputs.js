import { createHash } from 'node:crypto';

export const GITHUB_REVIEW_SCHEMA_VERSION = 1;
export const SARIF_VERSION = '2.1.0';

function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function safeInteger(value, fallback = 0) {
  return Number.isInteger(value) ? value : fallback;
}

function decodeGitPath(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed;

  return trimmed.slice(1, -1).replace(/\\([0-7]{1,3}|.)/g, (_, escape) => {
    if (/^[0-7]{1,3}$/.test(escape)) {
      return String.fromCharCode(Number.parseInt(escape, 8));
    }
    const escapes = {
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
      v: '\v',
      '\\': '\\',
      '"': '"'
    };
    return escapes[escape] ?? escape;
  });
}

function gitTokens(value) {
  return value.match(/"(?:\\.|[^"])*"|\S+/g)?.map(decodeGitPath) || [];
}

function normalizePath(value, stripSidePrefix = false) {
  if (typeof value !== 'string') return null;
  let normalized = value.trim();
  if (!normalized || normalized === '/dev/null') return null;
  if (stripSidePrefix && /^(?:a|b)\//.test(normalized)) normalized = normalized.slice(2);
  normalized = normalized.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (
    !normalized
    || normalized.startsWith('/')
    || normalized.includes('\0')
    || normalized.split('/').some((part) => part === '..' || !part)
  ) {
    return null;
  }
  return normalized;
}

function markerPath(value) {
  const token = value.trim().startsWith('"')
    ? gitTokens(value)[0]
    : value.split('\t', 1)[0].trim();
  return normalizePath(token, true);
}

export function parseAddedLineLocations(diffText) {
  if (typeof diffText !== 'string' || !diffText.trim()) return [];

  const locations = [];
  let currentPath = null;
  let newLine = null;

  for (const rawLine of diffText.split(/\r?\n/)) {
    if (rawLine.startsWith('diff --git ')) {
      const tokens = gitTokens(rawLine.slice('diff --git '.length));
      currentPath = normalizePath(tokens[1], true);
      newLine = null;
      continue;
    }
    if (rawLine.startsWith('rename to ')) {
      currentPath = normalizePath(decodeGitPath(rawLine.slice('rename to '.length)));
      continue;
    }
    if (rawLine.startsWith('+++ ')) {
      currentPath = markerPath(rawLine.slice(4));
      newLine = null;
      continue;
    }
    if (rawLine.startsWith('@@ ')) {
      const match = rawLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      newLine = match ? Number.parseInt(match[1], 10) : null;
      continue;
    }
    if (!currentPath || newLine === null) continue;

    if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      locations.push({ path: currentPath, line: newLine, content: rawLine.slice(1) });
      newLine += 1;
    } else if (rawLine.startsWith('-') && !rawLine.startsWith('---')) {
      continue;
    } else if (rawLine.startsWith(' ')) {
      newLine += 1;
    } else if (!rawLine.startsWith('\\ No newline at end of file')) {
      newLine = null;
    }
  }

  const unique = new Map();
  for (const location of locations) {
    unique.set(`${location.path}\0${location.line}\0${location.content}`, location);
  }
  return [...unique.values()].sort((left, right) =>
    left.path.localeCompare(right.path)
    || left.line - right.line
    || left.content.localeCompare(right.content)
  );
}

function hashIdentity(parts) {
  return createHash('sha256').update(parts.join('\0'), 'utf8').digest('hex');
}

function candidatePaths(rule, report) {
  const paths = new Set(list(rule?.matchedFiles).map((value) => normalizePath(value)).filter(Boolean));
  for (const file of list(report?.files)) {
    if (list(file?.rules).some((item) => item?.id === rule?.id)) {
      const filePath = normalizePath(file.path);
      if (filePath) paths.add(filePath);
    }
  }
  return [...paths].sort();
}

function annotationMessage(rule) {
  const reason = text(rule?.reason, 'Merge Guard reported this finding.');
  const check = text(rule?.check);
  return check ? `${reason} Suggested check: ${check}` : reason;
}

function unsupportedRecord(rule, path, reason) {
  return {
    ruleId: text(rule?.id, 'unknown-rule'),
    label: text(rule?.label, text(rule?.id, 'Unnamed finding')),
    path,
    reason
  };
}

export function createGithubAnnotationBundle(report, diffText) {
  if (!report || typeof report !== 'object') {
    throw new TypeError('createGithubAnnotationBundle requires a report object.');
  }
  const lineLocations = parseAddedLineLocations(diffText);
  const byPath = new Map();
  for (const location of lineLocations) {
    if (!byPath.has(location.path)) byPath.set(location.path, []);
    byPath.get(location.path).push(location);
  }

  const annotations = new Map();
  const unsupported = new Map();
  for (const rule of list(report.rules)) {
    const ruleId = text(rule?.id, 'unknown-rule');
    const paths = candidatePaths(rule, report);
    if (!paths.length) {
      const record = unsupportedRecord(rule, null, 'finding has no changed-file anchor');
      unsupported.set(`${record.ruleId}\0\0${record.reason}`, record);
      continue;
    }

    for (const filePath of paths) {
      const anchor = byPath.get(filePath)?.[0];
      if (!anchor) {
        const record = unsupportedRecord(rule, filePath, 'changed file has no added line to annotate');
        unsupported.set(`${record.ruleId}\0${filePath}\0${record.reason}`, record);
        continue;
      }
      const key = `${ruleId}\0${filePath}\0${anchor.line}`;
      if (annotations.has(key)) continue;
      annotations.set(key, {
        id: hashIdentity(['annotation-v1', ruleId, filePath, String(anchor.line)]),
        fingerprint: hashIdentity(['finding-v1', ruleId, filePath]),
        ruleId,
        title: text(rule?.label, ruleId).slice(0, 255),
        message: annotationMessage(rule),
        level: safeInteger(rule?.weight) > 0 ? 'warning' : 'notice',
        path: filePath,
        startLine: anchor.line,
        endLine: anchor.line,
        anchor: 'first-added-line',
        weight: safeInteger(rule?.weight)
      });
    }
  }

  return {
    schemaVersion: GITHUB_REVIEW_SCHEMA_VERSION,
    report: {
      schemaVersion: safeInteger(report.schemaVersion, 1),
      tool: text(report.tool, 'merge-guard'),
      version: text(report.version, '0.0.0'),
      riskScore: Number.isFinite(report.riskScore) ? report.riskScore : 0,
      riskLevel: text(report.riskLevel, 'UNKNOWN'),
      mergeReadiness: text(report.mergeReadiness, 'UNKNOWN')
    },
    annotations: [...annotations.values()].sort((left, right) =>
      left.path.localeCompare(right.path)
      || left.startLine - right.startLine
      || left.ruleId.localeCompare(right.ruleId)
    ),
    unsupported: [...unsupported.values()].sort((left, right) =>
      (left.path || '').localeCompare(right.path || '')
      || left.ruleId.localeCompare(right.ruleId)
      || left.reason.localeCompare(right.reason)
    ),
    semantics: 'projection-only; annotations do not change findings, risk scores, readiness, or CI thresholds'
  };
}

function sarifLevel(annotation) {
  return annotation.level === 'warning' ? 'warning' : 'note';
}

function ruleDescriptor(rule) {
  const id = text(rule?.id, 'unknown-rule');
  return {
    id,
    name: text(rule?.label, id),
    shortDescription: { text: text(rule?.label, id) },
    fullDescription: { text: text(rule?.reason, 'Merge Guard finding.') },
    defaultConfiguration: { level: safeInteger(rule?.weight) > 0 ? 'warning' : 'note' },
    properties: {
      tags: ['merge-guard', 'pull-request-review'],
      weight: safeInteger(rule?.weight)
    }
  };
}

export function createSarifLog(report, annotationBundle) {
  if (!report || typeof report !== 'object') {
    throw new TypeError('createSarifLog requires a report object.');
  }
  const bundle = annotationBundle || createGithubAnnotationBundle(report, '');
  const uniqueRules = new Map();
  for (const rule of list(report.rules)) {
    const descriptor = ruleDescriptor(rule);
    if (!uniqueRules.has(descriptor.id)) uniqueRules.set(descriptor.id, descriptor);
  }

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: SARIF_VERSION,
    runs: [{
      automationDetails: { id: 'merge-guard/pull-request-review' },
      tool: {
        driver: {
          name: 'merge-guard',
          organization: 'keepithandy',
          informationUri: 'https://github.com/keepithandy/merge-guard',
          semanticVersion: text(report.version, '0.0.0'),
          rules: [...uniqueRules.values()].sort((left, right) => left.id.localeCompare(right.id))
        }
      },
      results: list(bundle.annotations).map((annotation) => ({
        ruleId: annotation.ruleId,
        level: sarifLevel(annotation),
        message: { text: annotation.message },
        locations: [{
          physicalLocation: {
            artifactLocation: {
              uri: annotation.path,
              uriBaseId: '%SRCROOT%'
            },
            region: {
              startLine: annotation.startLine,
              endLine: annotation.endLine
            }
          }
        }],
        partialFingerprints: {
          primaryLocationLineHash: annotation.fingerprint
        },
        properties: {
          mergeGuardAnnotationId: annotation.id,
          mergeGuardSchemaVersion: GITHUB_REVIEW_SCHEMA_VERSION,
          weight: annotation.weight,
          anchor: annotation.anchor
        }
      })),
      invocations: [{
        executionSuccessful: true,
        properties: {
          mergeGuardSchemaVersion: GITHUB_REVIEW_SCHEMA_VERSION,
          reportSchemaVersion: safeInteger(report.schemaVersion, 1),
          riskScore: Number.isFinite(report.riskScore) ? report.riskScore : 0,
          unsupportedFindings: list(bundle.unsupported).length,
          semantics: bundle.semantics
        }
      }],
      columnKind: 'utf16CodeUnits'
    }]
  };
}

function escapeCommandData(value) {
  return String(value)
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
}

function escapeCommandProperty(value) {
  return escapeCommandData(value)
    .replaceAll(':', '%3A')
    .replaceAll(',', '%2C');
}

export function formatGithubWorkflowCommands(annotationBundle) {
  return list(annotationBundle?.annotations).map((annotation) => {
    const level = annotation.level === 'warning' ? 'warning' : 'notice';
    const properties = [
      `file=${escapeCommandProperty(annotation.path)}`,
      `line=${safeInteger(annotation.startLine, 1)}`,
      `endLine=${safeInteger(annotation.endLine, safeInteger(annotation.startLine, 1))}`,
      `title=${escapeCommandProperty(annotation.title)}`
    ].join(',');
    return `::${level} ${properties}::${escapeCommandData(annotation.message)}`;
  }).join('\n');
}
