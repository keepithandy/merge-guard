import fs from 'node:fs';
import path from 'node:path';

const FALLBACK_LAYOUTS = ['apps/*', 'packages/*', 'services/*'];
const SKIPPED_DIRECTORIES = new Set(['.git', '.hg', '.svn', 'node_modules']);

function posixPath(value) {
  return value.split(path.sep).join('/');
}

function warning(filePath, message) {
  return { path: filePath, message, severity: 'warning' };
}

function readManifest(filePath, displayPath, warnings) {
  let parsed;

  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    warnings.push(warning(displayPath, `invalid package metadata: ${error.message}`));
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    warnings.push(warning(displayPath, 'package metadata must contain a JSON object'));
    return null;
  }

  return parsed;
}

function normalizeWorkspacePatterns(value, warnings) {
  if (value === undefined) return [];

  let entries = value;
  if (!Array.isArray(value)) {
    if (value && typeof value === 'object' && Array.isArray(value.packages)) {
      entries = value.packages;
    } else {
      warnings.push(warning('package.json#workspaces', 'expected an array or an object with a packages array'));
      return [];
    }
  }

  const patterns = [];
  for (const [index, entry] of entries.entries()) {
    if (typeof entry !== 'string' || !entry.trim()) {
      warnings.push(warning(`package.json#workspaces[${index}]`, 'expected a non-empty string'));
      continue;
    }

    const negated = entry.trim().startsWith('!');
    let pattern = negated ? entry.trim().slice(1) : entry.trim();
    pattern = pattern.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');

    if (!pattern || path.posix.isAbsolute(pattern) || pattern === '..' || pattern.startsWith('../') || pattern.includes('/../')) {
      warnings.push(warning(`package.json#workspaces[${index}]`, 'workspace pattern must stay inside the repository'));
      continue;
    }

    patterns.push(`${negated ? '!' : ''}${pattern}`);
  }

  return [...new Set(patterns)];
}

function globRegex(pattern) {
  let source = '^';

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];

    if (character === '*') {
      if (pattern[index + 1] === '*') {
        source += '.*';
        index += 1;
      } else {
        source += '[^/]*';
      }
      continue;
    }

    if (character === '?') {
      source += '[^/]';
      continue;
    }

    source += character.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }

  return new RegExp(`${source}$`);
}

function matchesPatterns(relativeRoot, patterns) {
  const includes = patterns.filter((pattern) => !pattern.startsWith('!')).map(globRegex);
  const excludes = patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => globRegex(pattern.slice(1)));

  return includes.some((pattern) => pattern.test(relativeRoot))
    && !excludes.some((pattern) => pattern.test(relativeRoot));
}

function findManifestDirectories(root) {
  const directories = [];

  function visit(directory, relativeDirectory) {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    if (relativeDirectory && entries.some((entry) => entry.isFile() && entry.name === 'package.json')) {
      directories.push(relativeDirectory);
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || SKIPPED_DIRECTORIES.has(entry.name)) continue;
      const childRelative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      visit(path.join(directory, entry.name), childRelative);
    }
  }

  visit(root, '');
  return directories.sort();
}

function packageRecord(manifest, relativeRoot, source) {
  return {
    name: typeof manifest.name === 'string' && manifest.name.trim() ? manifest.name.trim() : null,
    root: relativeRoot,
    manifestPath: `${relativeRoot}/package.json`,
    source,
    workspace: source === 'workspace',
    private: manifest.private === true
  };
}

export function detectNpmWorkspaces(cwd = process.cwd()) {
  const root = path.resolve(cwd);
  const warnings = [];
  const rootManifestPath = path.join(root, 'package.json');
  let rootManifest = null;

  if (fs.existsSync(rootManifestPath)) {
    rootManifest = readManifest(rootManifestPath, 'package.json', warnings);
  }

  const workspacePatterns = normalizeWorkspacePatterns(rootManifest?.workspaces, warnings);
  const activePatterns = workspacePatterns.length ? workspacePatterns : FALLBACK_LAYOUTS;
  const source = workspacePatterns.length ? 'workspace' : 'layout';
  const packages = [];

  for (const relativeRoot of findManifestDirectories(root)) {
    const normalizedRoot = posixPath(relativeRoot);
    if (!matchesPatterns(normalizedRoot, activePatterns)) continue;

    const manifestPath = path.join(root, relativeRoot, 'package.json');
    const manifest = readManifest(manifestPath, `${normalizedRoot}/package.json`, warnings);
    if (!manifest) continue;

    packages.push(packageRecord(manifest, normalizedRoot, source));
  }

  packages.sort((left, right) => left.root.localeCompare(right.root));
  warnings.sort((left, right) => left.path.localeCompare(right.path) || left.message.localeCompare(right.message));

  const rootPackage = rootManifest
    ? {
        name: typeof rootManifest.name === 'string' && rootManifest.name.trim() ? rootManifest.name.trim() : null,
        root: '.',
        manifestPath: 'package.json',
        private: rootManifest.private === true
      }
    : null;

  return {
    kind: workspacePatterns.length
      ? 'npm-workspaces'
      : packages.length
        ? 'npm-monorepo-layout'
        : rootPackage
          ? 'single-package'
          : 'unknown',
    rootPackage,
    workspacePatterns,
    packages,
    warnings
  };
}
