import fs from 'node:fs';
import path from 'node:path';

export const IMPACT_METADATA_SCHEMA_VERSION = 1;
export const IMPACT_METADATA_MAX_BYTES = 256 * 1024;

const ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
const MAX_PATH_PATTERN_LENGTH = 240;

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function diagnostic({ severity = 'fatal', path: fieldPath, code, message, value, expected }) {
  return {
    severity,
    path: fieldPath,
    code,
    message,
    receivedType: valueType(value),
    expected
  };
}

function emptyMetadata(status = 'not-provided', sourcePath = null, diagnostics = []) {
  return {
    status,
    sourcePath,
    schemaVersion: null,
    packages: [],
    ownership: [],
    generatedPaths: [],
    repositoryWidePaths: [],
    diagnostics
  };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requireText(value, fieldPath, diagnostics, expected = 'non-empty string') {
  const normalized = text(value);
  if (normalized) return normalized;
  diagnostics.push(diagnostic({
    path: fieldPath,
    code: 'required-string',
    message: `${fieldPath} must be a non-empty string.`,
    value,
    expected
  }));
  return null;
}

function normalizePathPattern(value, fieldPath, diagnostics) {
  const candidate = requireText(value, fieldPath, diagnostics, 'safe repository-relative path or glob');
  if (!candidate) return null;

  const normalized = candidate.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (
    normalized.length > MAX_PATH_PATTERN_LENGTH
    || !normalized
    || normalized.startsWith('/')
    || /^[a-z]:\//i.test(normalized)
    || /^[a-z][a-z+.-]*:/i.test(normalized)
    || normalized.includes('\0')
    || normalized.split('/').some((part) => !part || part === '..')
  ) {
    diagnostics.push(diagnostic({
      path: fieldPath,
      code: 'invalid-path-pattern',
      message: `${fieldPath} must stay inside the repository and be at most ${MAX_PATH_PATTERN_LENGTH} characters.`,
      value,
      expected: 'safe repository-relative path or glob'
    }));
    return null;
  }

  return normalized;
}

function normalizePackageRoot(value, fieldPath, diagnostics) {
  const root = normalizePathPattern(value, fieldPath, diagnostics);
  if (!root) return null;
  if (root !== '.' && /[*?\[\]{}]/.test(root)) {
    diagnostics.push(diagnostic({
      path: fieldPath,
      code: 'invalid-package-root',
      message: `${fieldPath} must identify one exact package directory, not a glob.`,
      value,
      expected: 'exact repository-relative package root or .'
    }));
    return null;
  }
  return root;
}

function normalizePackageId(value, fieldPath, diagnostics) {
  const id = requireText(value, fieldPath, diagnostics, 'lowercase package identifier');
  if (!id) return null;
  if (!ID_PATTERN.test(id)) {
    diagnostics.push(diagnostic({
      path: fieldPath,
      code: 'invalid-package-id',
      message: `${fieldPath} must be a lowercase package identifier.`,
      value,
      expected: ID_PATTERN.source
    }));
    return null;
  }
  return id;
}

function unknownFields(value, allowed, fieldPath, diagnostics) {
  if (!isObject(value)) return;
  for (const field of Object.keys(value).sort()) {
    if (allowed.has(field)) continue;
    diagnostics.push(diagnostic({
      severity: 'warning',
      path: `${fieldPath}.${field}`,
      code: 'unknown-field',
      message: `${fieldPath}.${field} is not part of impact-metadata schema version 1 and will be ignored.`,
      value: value[field],
      expected: 'documented impact metadata field'
    }));
  }
}

function normalizeStringArray(value, fieldPath, diagnostics, normalize, expected) {
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic({
      path: fieldPath,
      code: 'invalid-type',
      message: `${fieldPath} must be an array.`,
      value,
      expected
    }));
    return [];
  }

  const normalized = [];
  const seen = new Set();
  for (const [index, entry] of value.entries()) {
    const item = normalize(entry, `${fieldPath}[${index}]`, diagnostics);
    if (!item || seen.has(item)) {
      if (item && seen.has(item)) {
        diagnostics.push(diagnostic({
          path: `${fieldPath}[${index}]`,
          code: 'duplicate-value',
          message: `${fieldPath} must not repeat "${item}".`,
          value: entry,
          expected
        }));
      }
      continue;
    }
    seen.add(item);
    normalized.push(item);
  }

  return normalized.sort((left, right) => left.localeCompare(right));
}

function normalizePackages(value, diagnostics) {
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic({
      path: '$.packages',
      code: 'invalid-type',
      message: '$.packages must be an array.',
      value,
      expected: 'array of package records'
    }));
    return [];
  }

  const packages = [];
  const seenIds = new Set();
  const seenRoots = new Set();
  for (const [index, candidate] of value.entries()) {
    const base = `$.packages[${index}]`;
    if (!isObject(candidate)) {
      diagnostics.push(diagnostic({
        path: base,
        code: 'invalid-type',
        message: `${base} must be an object.`,
        value: candidate,
        expected: 'package record'
      }));
      continue;
    }
    unknownFields(candidate, new Set(['id', 'root', 'dependsOn']), base, diagnostics);
    const id = normalizePackageId(candidate.id, `${base}.id`, diagnostics);
    const root = normalizePackageRoot(candidate.root, `${base}.root`, diagnostics);
    const dependsOn = candidate.dependsOn === undefined
      ? []
      : normalizeStringArray(candidate.dependsOn, `${base}.dependsOn`, diagnostics, normalizePackageId, 'unique package identifiers');

    if (id && dependsOn.includes(id)) {
      diagnostics.push(diagnostic({
        path: `${base}.dependsOn`,
        code: 'self-dependency',
        message: `${base}.dependsOn must not include its own package identifier.`,
        value: candidate.dependsOn,
        expected: 'other package identifiers'
      }));
    }
    if (id && seenIds.has(id)) {
      diagnostics.push(diagnostic({
        path: `${base}.id`,
        code: 'duplicate-package-id',
        message: `Package identifier "${id}" is declared more than once.`,
        value: candidate.id,
        expected: 'globally unique package identifier'
      }));
      continue;
    }
    if (root && seenRoots.has(root)) {
      diagnostics.push(diagnostic({
        path: `${base}.root`,
        code: 'duplicate-package-root',
        message: `Package root "${root}" is declared more than once.`,
        value: candidate.root,
        expected: 'globally unique package root'
      }));
      continue;
    }
    if (!id || !root) continue;

    seenIds.add(id);
    seenRoots.add(root);
    packages.push({ id, root, dependsOn });
  }

  const declaredIds = new Set(packages.map((entry) => entry.id));
  for (const packageRecord of packages) {
    for (const dependencyId of packageRecord.dependsOn) {
      if (declaredIds.has(dependencyId)) continue;
      diagnostics.push(diagnostic({
        path: `$.packages[${value.findIndex((entry) => entry?.id === packageRecord.id)}].dependsOn`,
        code: 'unknown-dependency',
        message: `Package "${packageRecord.id}" depends on undeclared package "${dependencyId}".`,
        value: dependencyId,
        expected: 'package identifier declared in $.packages'
      }));
    }
  }

  return packages.sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeOwnership(value, packageIds, diagnostics) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic({
      path: '$.ownership',
      code: 'invalid-type',
      message: '$.ownership must be an array.',
      value,
      expected: 'array of path ownership records'
    }));
    return [];
  }

  const ownership = [];
  const seenPaths = new Set();
  for (const [index, candidate] of value.entries()) {
    const base = `$.ownership[${index}]`;
    if (!isObject(candidate)) {
      diagnostics.push(diagnostic({ path: base, code: 'invalid-type', message: `${base} must be an object.`, value: candidate, expected: 'ownership record' }));
      continue;
    }
    unknownFields(candidate, new Set(['path', 'packages']), base, diagnostics);
    const pattern = normalizePathPattern(candidate.path, `${base}.path`, diagnostics);
    const packages = normalizeStringArray(candidate.packages, `${base}.packages`, diagnostics, normalizePackageId, 'unique declared package identifiers');
    for (const packageId of packages) {
      if (packageIds.has(packageId)) continue;
      diagnostics.push(diagnostic({
        path: `${base}.packages`,
        code: 'unknown-package',
        message: `${base}.packages references undeclared package "${packageId}".`,
        value: packageId,
        expected: 'package identifier declared in $.packages'
      }));
    }
    if (pattern && seenPaths.has(pattern)) {
      diagnostics.push(diagnostic({ path: `${base}.path`, code: 'duplicate-path', message: `Ownership path "${pattern}" is declared more than once.`, value: candidate.path, expected: 'unique ownership path' }));
      continue;
    }
    if (!pattern || !packages.length) continue;
    seenPaths.add(pattern);
    ownership.push({ path: pattern, packages });
  }

  return ownership.sort((left, right) => left.path.localeCompare(right.path));
}

function normalizeGeneratedPaths(value, packageIds, diagnostics) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic({ path: '$.generatedPaths', code: 'invalid-type', message: '$.generatedPaths must be an array.', value, expected: 'array of generated path records' }));
    return [];
  }

  const generatedPaths = [];
  const seenPaths = new Set();
  for (const [index, candidate] of value.entries()) {
    const base = `$.generatedPaths[${index}]`;
    if (!isObject(candidate)) {
      diagnostics.push(diagnostic({ path: base, code: 'invalid-type', message: `${base} must be an object.`, value: candidate, expected: 'generated path record' }));
      continue;
    }
    unknownFields(candidate, new Set(['path', 'package', 'source']), base, diagnostics);
    const pattern = normalizePathPattern(candidate.path, `${base}.path`, diagnostics);
    const packageId = normalizePackageId(candidate.package, `${base}.package`, diagnostics);
    const source = requireText(candidate.source, `${base}.source`, diagnostics, 'human-readable generated-file source');
    if (packageId && !packageIds.has(packageId)) {
      diagnostics.push(diagnostic({
        path: `${base}.package`,
        code: 'unknown-package',
        message: `${base}.package references undeclared package "${packageId}".`,
        value: candidate.package,
        expected: 'package identifier declared in $.packages'
      }));
    }
    if (pattern && seenPaths.has(pattern)) {
      diagnostics.push(diagnostic({ path: `${base}.path`, code: 'duplicate-path', message: `Generated path "${pattern}" is declared more than once.`, value: candidate.path, expected: 'unique generated path' }));
      continue;
    }
    if (!pattern || !packageId || !source) continue;
    seenPaths.add(pattern);
    generatedPaths.push({ path: pattern, package: packageId, source });
  }

  return generatedPaths.sort((left, right) => left.path.localeCompare(right.path));
}

export function validateImpactMetadata(value) {
  const diagnostics = [];
  if (!isObject(value)) {
    diagnostics.push(diagnostic({ path: '$', code: 'invalid-type', message: 'Impact metadata must contain a JSON object.', value, expected: 'JSON object' }));
    return { valid: false, metadata: emptyMetadata('invalid', null, diagnostics) };
  }

  unknownFields(value, new Set(['$schema', 'schemaVersion', 'packages', 'ownership', 'generatedPaths', 'repositoryWidePaths']), '$', diagnostics);
  const schemaVersion = value.schemaVersion;
  if (schemaVersion !== IMPACT_METADATA_SCHEMA_VERSION) {
    diagnostics.push(diagnostic({
      path: '$.schemaVersion',
      code: 'unsupported-schema-version',
      message: `$.schemaVersion must equal ${IMPACT_METADATA_SCHEMA_VERSION}.`,
      value: schemaVersion,
      expected: String(IMPACT_METADATA_SCHEMA_VERSION)
    }));
  }
  const packages = normalizePackages(value.packages, diagnostics);
  const packageIds = new Set(packages.map((entry) => entry.id));
  const ownership = normalizeOwnership(value.ownership, packageIds, diagnostics);
  const generatedPaths = normalizeGeneratedPaths(value.generatedPaths, packageIds, diagnostics);
  const repositoryWidePaths = value.repositoryWidePaths === undefined
    ? []
    : normalizeStringArray(value.repositoryWidePaths, '$.repositoryWidePaths', diagnostics, normalizePathPattern, 'unique repository-relative paths or globs');
  const valid = !diagnostics.some((entry) => entry.severity === 'fatal');

  return {
    valid,
    metadata: {
      status: valid ? 'valid' : 'invalid',
      sourcePath: null,
      schemaVersion: valid ? IMPACT_METADATA_SCHEMA_VERSION : null,
      packages: valid ? packages : [],
      ownership: valid ? ownership : [],
      generatedPaths: valid ? generatedPaths : [],
      repositoryWidePaths: valid ? repositoryWidePaths : [],
      diagnostics: diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code))
    }
  };
}

function leavesRoot(relative) {
  return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

function safeSourcePath(cwd, requestedPath) {
  if (typeof requestedPath !== 'string' || !requestedPath.trim()) return null;
  if (path.isAbsolute(requestedPath) || /^[a-z]:[\\/]/i.test(requestedPath)) return null;
  const root = path.resolve(cwd);
  const resolved = path.resolve(root, requestedPath);
  const relative = path.relative(root, resolved);
  if (!relative || leavesRoot(relative)) return null;
  return { absolute: resolved, display: relative.split(path.sep).join('/') };
}

function realPathStaysInside(root, candidate) {
  try {
    const realRoot = fs.realpathSync(root);
    const realCandidate = fs.realpathSync(candidate);
    const relative = path.relative(realRoot, realCandidate);
    return Boolean(relative) && !leavesRoot(relative);
  } catch {
    return false;
  }
}

function sourcePathContainsSymbolicLink(root, candidate) {
  const relative = path.relative(root, candidate);
  let current = root;
  try {
    for (const part of relative.split(path.sep)) {
      current = path.join(current, part);
      if (fs.lstatSync(current).isSymbolicLink()) return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function loadImpactMetadata(cwd = process.cwd(), requestedPath = null) {
  if (!requestedPath) return emptyMetadata();

  const source = safeSourcePath(cwd, requestedPath);
  if (!source) {
    return emptyMetadata('invalid', null, [diagnostic({
      path: '$source',
      code: 'unsafe-source-path',
      message: 'Impact metadata must be an existing repository-relative regular file.',
      value: requestedPath,
      expected: 'repository-relative JSON file'
    })]);
  }

  let stat;
  try {
    stat = fs.lstatSync(source.absolute);
  } catch {
    return emptyMetadata('invalid', source.display, [diagnostic({
      path: '$source',
      code: 'unreadable-source',
      message: 'Could not read impact metadata from the selected repository-relative path.',
      value: requestedPath,
      expected: 'existing repository-relative JSON file'
    })]);
  }
  if (
    !stat.isFile()
    || stat.isSymbolicLink()
    || stat.size > IMPACT_METADATA_MAX_BYTES
    || sourcePathContainsSymbolicLink(path.resolve(cwd), source.absolute)
    || !realPathStaysInside(path.resolve(cwd), source.absolute)
  ) {
    return emptyMetadata('invalid', source.display, [diagnostic({
      path: '$source',
      code: 'unsafe-source-file',
      message: `Impact metadata must be a regular JSON file no larger than ${IMPACT_METADATA_MAX_BYTES} bytes.`,
      value: requestedPath,
      expected: 'small repository-relative regular JSON file'
    })]);
  }

  let content;
  try {
    content = fs.readFileSync(source.absolute, 'utf8');
  } catch {
    return emptyMetadata('invalid', source.display, [diagnostic({
      path: '$source',
      code: 'unreadable-source',
      message: 'Could not read impact metadata from the selected repository-relative path.',
      value: requestedPath,
      expected: 'readable repository-relative JSON file'
    })]);
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return emptyMetadata('invalid', source.display, [diagnostic({
      path: '$',
      code: 'invalid-json',
      message: 'Impact metadata is not valid JSON.',
      value: 'invalid-json',
      expected: 'valid JSON object'
    })]);
  }

  const result = validateImpactMetadata(parsed);
  return { ...result.metadata, sourcePath: source.display };
}
