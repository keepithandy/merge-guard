import fs from 'node:fs';
import path from 'node:path';
import { parseDiffFileChanges } from './affectedPackages.js';
import { applyPolicyPack, loadStarterPolicyPack, STARTER_POLICY_IDS } from './starterPolicies.js';
import { compileSafeRegex, SAFE_REGEX_MAX_LENGTH } from './safeRegex.js';

export const POLICY_MANIFEST_SCHEMA_VERSION = 1;

const TARGET_TYPES = new Set(['rule', 'protectedPath', 'requiredCheck']);
const ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REPRESENTATIVE_PATHS = [
  'a.js',
  'src/file.js',
  '.github/workflows/ci.yml',
  'packages/example/test.py'
];

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function diagnostic({ severity = 'fatal', path, code, message, value, expected }) {
  return { severity, path, code, message, receivedType: valueType(value), expected };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requireString(value, fieldPath, fatal, expected = 'non-empty string') {
  const normalized = stringValue(value);
  if (normalized) return normalized;
  fatal.push(diagnostic({
    path: fieldPath,
    code: 'required-string',
    message: `${fieldPath} must be a non-empty string.`,
    value,
    expected
  }));
  return null;
}

function unknownFields(value, allowed, fieldPath, warnings) {
  if (!isObject(value)) return;
  for (const field of Object.keys(value).sort()) {
    if (allowed.has(field)) continue;
    warnings.push(diagnostic({
      severity: 'warning',
      path: `${fieldPath}.${field}`,
      code: 'unknown-field',
      message: `${fieldPath}.${field} is not part of policy-manifest schema version 1 and will be ignored.`,
      value: value[field],
      expected: 'documented manifest field'
    }));
  }
}

function normalizeRoot(value, fieldPath, fatal) {
  const root = requireString(value, fieldPath, fatal, 'repository-relative package root');
  if (!root) return null;
  const normalized = root.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (
    !normalized
    || normalized === '.'
    || normalized.startsWith('/')
    || normalized.split('/').some((part) => part === '..' || !part)
  ) {
    fatal.push(diagnostic({
      path: fieldPath,
      code: 'invalid-package-root',
      message: `${fieldPath} must be a non-root path inside the repository.`,
      value,
      expected: 'safe repository-relative package root other than .'
    }));
    return null;
  }
  return normalized;
}

function validatePolicyId(value, fieldPath, fatal) {
  const id = requireString(value, fieldPath, fatal, `one of: ${STARTER_POLICY_IDS.join(', ')}`);
  if (!id) return null;
  if (!STARTER_POLICY_IDS.includes(id)) {
    fatal.push(diagnostic({
      path: fieldPath,
      code: 'unknown-policy',
      message: `Unknown starter policy "${id}".`,
      value,
      expected: STARTER_POLICY_IDS.join(', ')
    }));
    return null;
  }
  return id;
}

function validDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function todayString(today) {
  const date = today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date();
  return date.toISOString().slice(0, 10);
}

function compileBoundedPattern(value, fieldPath, fatal) {
  const source = requireString(value, fieldPath, fatal, `non-blanket safe regular expression <= ${SAFE_REGEX_MAX_LENGTH} characters`);
  if (!source) return null;
  if (source.length > SAFE_REGEX_MAX_LENGTH) {
    fatal.push(diagnostic({
      path: fieldPath,
      code: 'pattern-too-long',
      message: `${fieldPath} exceeds ${SAFE_REGEX_MAX_LENGTH} characters.`,
      value,
      expected: `regular expression <= ${SAFE_REGEX_MAX_LENGTH} characters`
    }));
    return null;
  }
  let matcher;
  try {
    matcher = compileSafeRegex(source, 'i');
  } catch (error) {
    fatal.push(diagnostic({
      path: fieldPath,
      code: error.code || 'invalid-pattern',
      message: `${fieldPath} is not a safe, valid regular expression: ${error.message}`,
      value,
      expected: 'safe case-insensitive regular expression'
    }));
    return null;
  }
  if (REPRESENTATIVE_PATHS.every((filePath) => matcher.test(filePath))) {
    fatal.push(diagnostic({
      path: fieldPath,
      code: 'blanket-exception',
      message: `${fieldPath} matches every representative repository path and is too broad for an exception.`,
      value,
      expected: 'narrow path expression'
    }));
    return null;
  }
  return source;
}

function targetExists(policy, target) {
  if (!policy || !target?.id) return false;
  if (target.type === 'rule') return policy.rules.some((item) => item.id === target.id);
  if (target.type === 'protectedPath') return policy.protectedPaths.some((item) => item.id === target.id);
  if (target.type === 'requiredCheck') return policy.requiredChecks.some((item) => item.id === target.id);
  return false;
}

function validateExceptions(value, fieldPath, context, fatal, warnings, seenIds) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    fatal.push(diagnostic({
      path: fieldPath,
      code: 'invalid-type',
      message: `${fieldPath} must be an array.`,
      value,
      expected: 'array of exception objects'
    }));
    return [];
  }

  const exceptions = [];
  for (const [index, candidate] of value.entries()) {
    const base = `${fieldPath}[${index}]`;
    if (!isObject(candidate)) {
      fatal.push(diagnostic({
        path: base,
        code: 'invalid-type',
        message: `${base} must be an object.`,
        value: candidate,
        expected: 'exception object'
      }));
      continue;
    }
    unknownFields(candidate, new Set(['id', 'target', 'pathPattern', 'reason', 'owner', 'expires']), base, warnings);

    const id = requireString(candidate.id, `${base}.id`, fatal, 'unique lowercase identifier');
    if (id && !ID_PATTERN.test(id)) {
      fatal.push(diagnostic({
        path: `${base}.id`,
        code: 'invalid-id',
        message: `${base}.id must be a lowercase identifier.`,
        value: candidate.id,
        expected: ID_PATTERN.source
      }));
    } else if (id && seenIds.has(id)) {
      fatal.push(diagnostic({
        path: `${base}.id`,
        code: 'duplicate-exception-id',
        message: `Exception ID "${id}" is declared more than once.`,
        value: id,
        expected: 'globally unique exception ID'
      }));
    } else if (id) {
      seenIds.add(id);
    }

    let target = null;
    if (!isObject(candidate.target)) {
      fatal.push(diagnostic({
        path: `${base}.target`,
        code: 'invalid-type',
        message: `${base}.target must be an object.`,
        value: candidate.target,
        expected: 'object with type and id'
      }));
    } else {
      unknownFields(candidate.target, new Set(['type', 'id']), `${base}.target`, warnings);
      const type = requireString(candidate.target.type, `${base}.target.type`, fatal, 'rule, protectedPath, or requiredCheck');
      const targetId = requireString(candidate.target.id, `${base}.target.id`, fatal);
      if (type && !TARGET_TYPES.has(type)) {
        fatal.push(diagnostic({
          path: `${base}.target.type`,
          code: 'invalid-target-type',
          message: `${base}.target.type is not supported.`,
          value: type,
          expected: [...TARGET_TYPES].join(', ')
        }));
      }
      target = { type, id: targetId };
    }

    const pathPattern = compileBoundedPattern(candidate.pathPattern, `${base}.pathPattern`, fatal);
    const reason = requireString(candidate.reason, `${base}.reason`, fatal);
    const owner = requireString(candidate.owner, `${base}.owner`, fatal);
    const expires = requireString(candidate.expires, `${base}.expires`, fatal, 'UTC date YYYY-MM-DD');
    if (expires && !validDate(expires)) {
      fatal.push(diagnostic({
        path: `${base}.expires`,
        code: 'invalid-expiry',
        message: `${base}.expires must be a real UTC calendar date.`,
        value: expires,
        expected: 'YYYY-MM-DD'
      }));
    } else if (expires && expires < context.today) {
      fatal.push(diagnostic({
        path: `${base}.expires`,
        code: 'expired-exception',
        message: `Exception "${id || index}" expired on ${expires}.`,
        value: expires,
        expected: `date >= ${context.today}`
      }));
    }

    if (!context.effectivePolicy) {
      fatal.push(diagnostic({
        path: base,
        code: 'exception-without-policy',
        message: `${base} cannot target a scope with no effective policy.`,
        value: candidate,
        expected: 'exception under a scope with an effective policy'
      }));
    } else if (target?.type && TARGET_TYPES.has(target.type) && target.id) {
      const policy = loadStarterPolicyPack(context.effectivePolicy);
      if (!targetExists(policy, target)) {
        fatal.push(diagnostic({
          path: `${base}.target`,
          code: 'unknown-exception-target',
          message: `${base} does not reference a ${target.type} in policy "${context.effectivePolicy}".`,
          value: target,
          expected: `existing target in ${context.effectivePolicy}`
        }));
      }
    }

    exceptions.push({
      id,
      target,
      pathPattern,
      reason,
      owner,
      expires,
      scopeRoot: context.scopeRoot,
      starterPolicyId: context.effectivePolicy
    });
  }
  return exceptions;
}

function packageAncestors(root, packages) {
  return packages
    .filter((entry) => root === entry.root || root.startsWith(`${entry.root}/`))
    .sort((left, right) => left.root.length - right.root.length || left.root.localeCompare(right.root));
}

function effectivePolicy(rootPolicy, entries) {
  let policy = rootPolicy;
  for (const entry of entries) {
    if (entry.inherit === false) policy = null;
    if (entry.policy) policy = entry.policy;
  }
  return policy;
}

function validateScope(value, fieldPath, fatal, warnings, { packageScope = false } = {}) {
  if (!isObject(value)) {
    fatal.push(diagnostic({
      path: fieldPath,
      code: 'invalid-type',
      message: `${fieldPath} must be an object.`,
      value,
      expected: 'policy scope object'
    }));
    return null;
  }
  unknownFields(
    value,
    packageScope ? new Set(['root', 'inherit', 'policy', 'exceptions']) : new Set(['policy', 'exceptions']),
    fieldPath,
    warnings
  );
  const root = packageScope ? normalizeRoot(value.root, `${fieldPath}.root`, fatal) : '.';
  let inherit = true;
  if (packageScope && value.inherit !== undefined) {
    if (typeof value.inherit !== 'boolean') {
      fatal.push(diagnostic({
        path: `${fieldPath}.inherit`,
        code: 'invalid-type',
        message: `${fieldPath}.inherit must be boolean.`,
        value: value.inherit,
        expected: 'boolean'
      }));
    } else {
      inherit = value.inherit;
    }
  }
  const policy = value.policy === undefined ? null : validatePolicyId(value.policy, `${fieldPath}.policy`, fatal);
  return { root, inherit, policy, rawExceptions: value.exceptions };
}

export function validatePolicyManifest(value, { today = new Date() } = {}) {
  const fatal = [];
  const warnings = [];
  const currentDay = todayString(today);

  if (!isObject(value)) {
    fatal.push(diagnostic({
      path: '$',
      code: 'invalid-policy-manifest',
      message: 'A policy manifest must contain a JSON object.',
      value,
      expected: 'policy manifest object'
    }));
    return { valid: false, manifest: null, fatal, warnings };
  }
  unknownFields(value, new Set(['schemaVersion', 'root', 'packages']), '$', warnings);

  if (value.schemaVersion !== POLICY_MANIFEST_SCHEMA_VERSION) {
    fatal.push(diagnostic({
      path: '$.schemaVersion',
      code: value.schemaVersion > POLICY_MANIFEST_SCHEMA_VERSION ? 'future-schema-version' : 'unsupported-schema-version',
      message: `Policy manifest schemaVersion must be ${POLICY_MANIFEST_SCHEMA_VERSION}.`,
      value: value.schemaVersion,
      expected: `integer ${POLICY_MANIFEST_SCHEMA_VERSION}`
    }));
  }

  const rootScope = validateScope(value.root, '$.root', fatal, warnings) || {
    root: '.', inherit: true, policy: null, rawExceptions: []
  };
  const packageValues = value.packages === undefined ? [] : value.packages;
  if (!Array.isArray(packageValues)) {
    fatal.push(diagnostic({
      path: '$.packages',
      code: 'invalid-type',
      message: '$.packages must be an array.',
      value: packageValues,
      expected: 'array of package policy scopes'
    }));
  }
  const packages = (Array.isArray(packageValues) ? packageValues : [])
    .map((entry, index) => validateScope(entry, `$.packages[${index}]`, fatal, warnings, { packageScope: true }))
    .filter(Boolean)
    .sort((left, right) => left.root.localeCompare(right.root));

  const seenRoots = new Set();
  for (const [index, entry] of packages.entries()) {
    if (!entry.root) continue;
    if (seenRoots.has(entry.root)) {
      fatal.push(diagnostic({
        path: `$.packages[${index}].root`,
        code: 'conflicting-package-scope',
        message: `Package root "${entry.root}" is configured more than once.`,
        value: entry.root,
        expected: 'one policy scope per package root'
      }));
    }
    seenRoots.add(entry.root);
  }

  if (!rootScope.policy && !packages.some((entry) => entry.policy)) {
    fatal.push(diagnostic({
      path: '$',
      code: 'empty-policy-manifest',
      message: 'The manifest does not select a root or package policy.',
      value,
      expected: 'at least one explicit starter policy selection'
    }));
  }

  const exceptionIds = new Set();
  rootScope.exceptions = validateExceptions(
    rootScope.rawExceptions,
    '$.root.exceptions',
    { today: currentDay, scopeRoot: '.', effectivePolicy: rootScope.policy },
    fatal,
    warnings,
    exceptionIds
  );

  for (const entry of packages) {
    const ancestors = packageAncestors(entry.root, packages).filter((candidate) => candidate !== entry);
    const inherited = effectivePolicy(rootScope.policy, ancestors);
    const effective = effectivePolicy(inherited, [entry]);
    if (entry.policy && entry.policy === inherited) {
      warnings.push(diagnostic({
        severity: 'warning',
        path: `$.packages.${entry.root}.policy`,
        code: 'redundant-policy-override',
        message: `Package "${entry.root}" repeats inherited policy "${entry.policy}".`,
        value: entry.policy,
        expected: 'omit redundant override or choose a different policy'
      }));
    }
    entry.exceptions = validateExceptions(
      entry.rawExceptions,
      `$.packages.${entry.root}.exceptions`,
      { today: currentDay, scopeRoot: entry.root, effectivePolicy: effective },
      fatal,
      warnings,
      exceptionIds
    );
    entry.effectivePolicy = effective;
  }

  const valid = fatal.length === 0;
  return {
    valid,
    manifest: valid
      ? {
          schemaVersion: POLICY_MANIFEST_SCHEMA_VERSION,
          root: {
            policy: rootScope.policy,
            exceptions: rootScope.exceptions
          },
          packages: packages.map((entry) => ({
            root: entry.root,
            inherit: entry.inherit,
            policy: entry.policy,
            effectivePolicy: entry.effectivePolicy,
            exceptions: entry.exceptions
          }))
        }
      : null,
    fatal,
    warnings
  };
}

function changedPaths(diffText) {
  const paths = [];
  for (const change of parseDiffFileChanges(diffText)) {
    if (change.status === 'renamed' && change.previousPath) paths.push(change.previousPath);
    paths.push(change.path);
  }
  return [...new Set(paths)].sort();
}

function containsPath(root, filePath) {
  return root === '.' || filePath === root || filePath.startsWith(`${root}/`);
}

function resolvePathPolicy(filePath, manifest) {
  let selected = manifest.root.policy;
  let sourceRoot = selected ? '.' : null;
  const provenance = [{
    scopeRoot: '.',
    action: selected ? 'selected' : 'no-policy',
    policy: selected
  }];
  const matchingPackages = manifest.packages
    .filter((entry) => containsPath(entry.root, filePath))
    .sort((left, right) => left.root.length - right.root.length || left.root.localeCompare(right.root));

  for (const entry of matchingPackages) {
    if (entry.inherit === false) {
      selected = null;
      sourceRoot = null;
      provenance.push({ scopeRoot: entry.root, action: 'inheritance-cleared', policy: null });
    } else {
      provenance.push({ scopeRoot: entry.root, action: 'inherited', policy: selected });
    }
    if (entry.policy) {
      provenance.push({
        scopeRoot: entry.root,
        action: selected ? 'overridden' : 'selected',
        previousPolicy: selected,
        policy: entry.policy
      });
      selected = entry.policy;
      sourceRoot = entry.root;
    }
  }

  const evaluationRoot = matchingPackages.at(-1)?.root || '.';
  const relativePath = evaluationRoot === '.'
    ? filePath
    : filePath.slice(evaluationRoot.length + 1);
  return { selected, sourceRoot, evaluationRoot, relativePath, provenance };
}

function resolveExceptions(assignments, manifest, warnings) {
  const scopes = [
    { root: '.', exceptions: manifest.root.exceptions },
    ...manifest.packages.map((entry) => ({ root: entry.root, exceptions: entry.exceptions }))
  ];
  const resolved = [];

  for (const scope of scopes) {
    for (const exception of scope.exceptions || []) {
      const matcher = compileSafeRegex(exception.pathPattern, 'i');
      const paths = assignments
        .filter((assignment) =>
          assignment.starterPolicyId === exception.starterPolicyId
          && containsPath(scope.root, assignment.path)
          && matcher.test(
            scope.root === '.'
              ? assignment.path
              : assignment.path.slice(scope.root.length + 1)
          )
        )
        .map((assignment) => assignment.path);
      if (!paths.length) {
        warnings.push(diagnostic({
          severity: 'warning',
          path: `exception.${exception.id}`,
          code: 'unmatched-exception',
          message: `Active exception "${exception.id}" matched no changed path.`,
          value: exception.pathPattern,
          expected: 'at least one changed path in scope'
        }));
      }
      const policy = loadStarterPolicyPack(exception.starterPolicyId);
      resolved.push({
        ...exception,
        policyPackId: policy.identity.id,
        policyPackVersion: policy.identity.version,
        paths
      });
    }
  }
  return resolved;
}

export function resolvePolicyManifest(manifest, diffText, { manifestPath = null, warnings = [] } = {}) {
  const assignments = changedPaths(diffText).map((filePath) => {
    const resolved = resolvePathPolicy(filePath, manifest);
    const policy = resolved.selected ? loadStarterPolicyPack(resolved.selected) : null;
    return {
      path: filePath,
      starterPolicyId: resolved.selected,
      policyPackId: policy?.identity.id ?? null,
      policyPackVersion: policy?.identity.version ?? null,
      sourceRoot: resolved.sourceRoot,
      evaluationRoot: resolved.evaluationRoot,
      relativePath: resolved.relativePath,
      provenance: resolved.provenance
    };
  });

  const policyMap = new Map();
  for (const assignment of assignments) {
    if (!assignment.starterPolicyId) continue;
    if (!policyMap.has(assignment.starterPolicyId)) {
      policyMap.set(assignment.starterPolicyId, { paths: [], pathAliases: {} });
    }
    const scope = policyMap.get(assignment.starterPolicyId);
    scope.paths.push(assignment.path);
    scope.pathAliases[assignment.path] = assignment.relativePath;
  }
  const policyScopes = [...policyMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([starterPolicyId, scope]) => ({
      starterPolicyId,
      policy: loadStarterPolicyPack(starterPolicyId),
      paths: [...new Set(scope.paths)].sort(),
      pathAliases: Object.fromEntries(Object.entries(scope.pathAliases).sort(([left], [right]) => left.localeCompare(right)))
    }));

  const resolutionWarnings = [...warnings];
  const exceptions = resolveExceptions(assignments, manifest, resolutionWarnings);
  return {
    schemaVersion: manifest.schemaVersion,
    manifestPath,
    assignments,
    policyScopes,
    exceptions,
    warnings: resolutionWarnings
  };
}

export function loadAndResolvePolicyManifest(filePath, diffText, options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const absolutePath = path.resolve(cwd, filePath);
  const relativePath = path.relative(cwd, absolutePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new PolicyManifestError(`Policy manifest "${filePath}" must stay inside the repository.`);
  }
  let parsed;
  try {
    const stats = fs.lstatSync(absolutePath);
    if (stats.isSymbolicLink()) {
      throw new Error('symbolic links are not followed');
    }
    if (!stats.isFile()) {
      throw new Error('path is not a regular file');
    }
    if (stats.size > 1024 * 1024) {
      throw new Error('file exceeds the 1 MB manifest limit');
    }
    const realRoot = fs.realpathSync(cwd);
    const realManifest = fs.realpathSync(absolutePath);
    const realRelativePath = path.relative(realRoot, realManifest);
    if (realRelativePath.startsWith('..') || path.isAbsolute(realRelativePath)) {
      throw new Error('resolved path escapes the repository');
    }
    parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new PolicyManifestError(`Unable to read policy manifest "${filePath}": ${error.message}`);
  }
  const validation = validatePolicyManifest(parsed, { today: options.today });
  if (!validation.valid) {
    throw new PolicyManifestError(
      `Policy manifest "${filePath}" is invalid.`,
      validation.fatal
    );
  }
  return resolvePolicyManifest(validation.manifest, diffText, {
    manifestPath: filePath,
    warnings: validation.warnings
  });
}

export function applyResolvedPolicies(report, diffText, resolution) {
  const policyScopes = [];
  for (const scope of resolution.policyScopes || []) {
    report = applyPolicyPack(report, diffText, scope.policy, {
      scopePaths: scope.paths,
      pathAliases: scope.pathAliases
    });
    policyScopes.push({
      policy: scope.policy,
      paths: scope.paths,
      pathAliases: scope.pathAliases
    });
  }
  report.policyResolution = {
    schemaVersion: resolution.schemaVersion,
    manifestPath: resolution.manifestPath,
    assignments: resolution.assignments,
    warnings: resolution.warnings
  };
  return { report, policyScopes };
}

function annotation(exception) {
  return {
    id: exception.id,
    target: exception.target,
    reason: exception.reason,
    owner: exception.owner,
    expires: exception.expires,
    scopeRoot: exception.scopeRoot,
    paths: exception.paths
  };
}

function intersects(left, right) {
  const values = new Set(right);
  return left.some((value) => values.has(value));
}

export function applyPolicyExceptions(report, resolution) {
  const active = [];
  const unmatched = [];

  for (const exception of resolution?.exceptions || []) {
    const note = annotation(exception);
    let matched = false;
    if (exception.target.type === 'rule') {
      for (const finding of report.rules || []) {
        if (
          finding.policyPackId === exception.policyPackId
          && finding.id.endsWith(`:${exception.target.id}`)
          && intersects(finding.matchedFiles || [], exception.paths)
        ) {
          finding.policyExceptions = [...(finding.policyExceptions || []), note];
          matched = true;
        }
      }
    } else if (exception.target.type === 'protectedPath') {
      for (const match of report.reviewGuidance?.protectedPaths || []) {
        if (
          match.policyPackId === exception.policyPackId
          && match.protectedPathId === exception.target.id
          && exception.paths.includes(match.path)
        ) {
          match.policyExceptions = [...(match.policyExceptions || []), note];
          matched = true;
        }
      }
    } else if (exception.target.type === 'requiredCheck') {
      for (const check of report.policyRequiredChecks || []) {
        if (check.policyPackId === exception.policyPackId && check.id === exception.target.id) {
          check.policyExceptions = [...(check.policyExceptions || []), note];
          matched = true;
        }
      }
    }

    const record = { ...note, matched };
    (matched ? active : unmatched).push(record);
  }

  report.policyExceptions = {
    active,
    unmatched,
    semantics: 'annotations-only; exceptions do not remove findings, required checks, protected-path guidance, or risk score'
  };
  return report;
}

export class PolicyManifestError extends Error {
  constructor(message, diagnostics = []) {
    super(message);
    this.name = 'PolicyManifestError';
    this.diagnostics = diagnostics;
  }
}
