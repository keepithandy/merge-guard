import fs from 'node:fs';
import path from 'node:path';
import { parseDiffFileChanges } from './affectedPackages.js';

const CODEOWNERS_LOCATIONS = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS'];
const CODEOWNERS_MAX_BYTES = 3 * 1024 * 1024;
const HANDLE_PATTERN = /^@[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:\/[A-Za-z0-9_.-]+)?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISCLAIMER = 'Guidance only: owners are unverified suggestions and do not prove assignment, write access, a review request, or approval.';

function warning(sourcePath, line, code, message) {
  return { severity: 'warning', sourcePath, line, code, message };
}

function normalizeRepositoryPath(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\//, '');
  if (
    !normalized
    || normalized.startsWith('/')
    || normalized.split('/').some((part) => part === '..')
    || normalized.includes('\0')
  ) {
    return null;
  }
  return normalized;
}

function escapeRegex(character) {
  return /[|\\{}()[\]^$+?.]/.test(character) ? `\\${character}` : character;
}

function globSource(pattern) {
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        if (pattern[index + 2] === '/') {
          source += '(?:.*/)?';
          index += 2;
        } else {
          source += '.*';
          index += 1;
        }
      } else {
        source += '[^/]*';
      }
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += escapeRegex(character);
    }
  }
  return source;
}

function compileCodeOwnersPattern(pattern) {
  const rooted = pattern.startsWith('/');
  const directoryPattern = pattern.endsWith('/');
  const normalized = pattern.replace(/^\//, '').replace(/\/$/, '');
  const containsSlash = normalized.includes('/');
  const body = globSource(normalized);

  if (!body) return null;
  if (directoryPattern) {
    return new RegExp(`${rooted || containsSlash ? '^' : '(?:^|/)'}${body}(?:/.*)?$`);
  }
  return new RegExp(`${rooted || containsSlash ? '^' : '(?:^|/)'}${body}(?:$|/)`);
}

function stripTrailingComment(line) {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '#' && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index).trimEnd();
    }
  }
  return line;
}

function validOwner(owner) {
  return HANDLE_PATTERN.test(owner) || EMAIL_PATTERN.test(owner);
}

export function parseCodeOwners(content, sourcePath = 'CODEOWNERS') {
  const entries = [];
  const warnings = [];

  if (typeof content !== 'string') {
    warnings.push(warning(sourcePath, null, 'invalid-content', 'CODEOWNERS content must be UTF-8 text.'));
    return { sourcePath, entries, warnings };
  }

  for (const [index, rawLine] of content.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('\\#')) {
      warnings.push(warning(sourcePath, lineNumber, 'unsupported-escaped-comment', 'Escaping a leading # pattern is not supported by CODEOWNERS.'));
      continue;
    }

    const uncommented = stripTrailingComment(trimmed);
    if (!uncommented) continue;
    const tokens = uncommented.split(/\s+/);
    const pattern = tokens[0];
    const owners = tokens.slice(1);

    if (pattern.startsWith('!')) {
      warnings.push(warning(sourcePath, lineNumber, 'unsupported-negation', 'CODEOWNERS does not support negated patterns.'));
      continue;
    }
    if (pattern.includes('[') || pattern.includes(']')) {
      warnings.push(warning(sourcePath, lineNumber, 'unsupported-character-range', 'CODEOWNERS does not support bracket character ranges.'));
      continue;
    }
    if (pattern.includes('\\')) {
      warnings.push(warning(sourcePath, lineNumber, 'unsupported-escape', 'Escaped CODEOWNERS patterns are outside this parser subset.'));
      continue;
    }
    if (pattern.includes('//')) {
      warnings.push(warning(sourcePath, lineNumber, 'malformed-pattern', 'CODEOWNERS pattern contains an empty path segment.'));
      continue;
    }

    const invalidOwners = owners.filter((owner) => !validOwner(owner));
    if (invalidOwners.length) {
      warnings.push(warning(
        sourcePath,
        lineNumber,
        'invalid-owner',
        `CODEOWNERS line was skipped because these owners are invalid: ${invalidOwners.join(', ')}.`
      ));
      continue;
    }

    const matcher = compileCodeOwnersPattern(pattern);
    if (!matcher) {
      warnings.push(warning(sourcePath, lineNumber, 'malformed-pattern', 'CODEOWNERS pattern is empty after normalization.'));
      continue;
    }

    entries.push({
      line: lineNumber,
      pattern,
      owners: [...new Set(owners)],
      matcher
    });
  }

  return { sourcePath, entries, warnings };
}

export function findCodeOwners(cwd = process.cwd()) {
  const root = path.resolve(cwd);
  const discoveryWarnings = [];

  for (const sourcePath of CODEOWNERS_LOCATIONS) {
    const filePath = path.join(root, sourcePath);
    let stats;
    try {
      stats = fs.lstatSync(filePath);
    } catch {
      continue;
    }
    if (stats.isSymbolicLink()) {
      discoveryWarnings.push(warning(
        sourcePath,
        null,
        'symbolic-link-unsupported',
        'Symbolic-link CODEOWNERS files are not followed by Merge Guard.'
      ));
      continue;
    }
    if (!stats.isFile()) continue;
    if (stats.size >= CODEOWNERS_MAX_BYTES) {
      return {
        sourcePath,
        entries: [],
        warnings: [
          ...discoveryWarnings,
          warning(
            sourcePath,
            null,
            'file-too-large',
            'CODEOWNERS is 3 MB or larger and was not parsed.'
          )
        ]
      };
    }
    try {
      const parsed = parseCodeOwners(fs.readFileSync(filePath, 'utf8'), sourcePath);
      parsed.warnings = [...discoveryWarnings, ...parsed.warnings];
      return parsed;
    } catch (error) {
      return {
        sourcePath,
        entries: [],
        warnings: [
          ...discoveryWarnings,
          warning(sourcePath, null, 'read-error', `Unable to read CODEOWNERS: ${error.message}`)
        ]
      };
    }
  }

  return { sourcePath: null, entries: [], warnings: discoveryWarnings };
}

function changedPathEndpoints(diffText) {
  const paths = [];
  for (const change of parseDiffFileChanges(diffText)) {
    if (change.status === 'renamed' && change.previousPath) paths.push(change.previousPath);
    paths.push(change.path);
  }
  return [...new Set(paths.map(normalizeRepositoryPath).filter(Boolean))].sort();
}

export function matchCodeOwners(paths, parsed) {
  const suggestions = [];
  const unownedPaths = [];
  const unmatchedPaths = [];

  for (const filePath of [...new Set(paths)].sort()) {
    let match = null;
    for (const entry of parsed.entries || []) {
      if (entry.matcher.test(filePath)) match = entry;
    }

    if (!match) {
      unmatchedPaths.push(filePath);
    } else if (!match.owners.length) {
      unownedPaths.push({ path: filePath, pattern: match.pattern, line: match.line });
    } else {
      suggestions.push({
        path: filePath,
        owners: match.owners,
        pattern: match.pattern,
        line: match.line,
        sourcePath: parsed.sourcePath,
        status: 'suggested-unverified'
      });
    }
  }

  return {
    sourcePath: parsed.sourcePath,
    suggestions,
    unownedPaths,
    unmatchedPaths,
    warnings: parsed.warnings || []
  };
}

function policyScopes(paths, policies) {
  return policies.map((item) => {
    if (item?.policy?.identity) {
      return {
        policy: item.policy,
        paths: new Set(Array.isArray(item.paths) ? item.paths : paths),
        pathAliases: item.pathAliases && typeof item.pathAliases === 'object'
          ? item.pathAliases
          : {}
      };
    }
    return { policy: item, paths: new Set(paths), pathAliases: {} };
  }).filter((item) => item.policy?.identity);
}

function matchProtectedPaths(paths, policies) {
  const matches = [];

  for (const scope of policyScopes(paths, policies)) {
    const policy = scope.policy;
    for (const protectedPath of policy.protectedPaths || []) {
      let matcher;
      try {
        matcher = new RegExp(protectedPath.pattern, 'i');
      } catch {
        continue;
      }

      for (const filePath of paths) {
        if (!scope.paths.has(filePath)) continue;
        const matchPath = scope.pathAliases[filePath] || filePath;
        if (!matcher.test(matchPath)) continue;
        const requiredChecks = (policy.requiredChecks || [])
          .filter((check) => protectedPath.requiredCheckIds.includes(check.id))
          .map((check) => ({ id: check.id, command: check.command, reason: check.reason }));
        matches.push({
          path: filePath,
          matchedPath: matchPath,
          policyPackId: policy.identity.id,
          policyPackVersion: policy.identity.version,
          protectedPathId: protectedPath.id,
          pattern: protectedPath.pattern,
          reason: protectedPath.reason,
          requiredChecks,
          status: 'specialized-review-suggested'
        });
      }
    }
  }

  return matches.sort((left, right) =>
    left.path.localeCompare(right.path)
    || left.policyPackId.localeCompare(right.policyPackId)
    || left.protectedPathId.localeCompare(right.protectedPathId)
  );
}

export function inspectReviewGuidance(diffText, policies = [], cwd = process.cwd()) {
  const changedPaths = changedPathEndpoints(diffText);
  const parsedCodeOwners = findCodeOwners(cwd);

  return {
    changedPaths,
    protectedPaths: matchProtectedPaths(changedPaths, Array.isArray(policies) ? policies : []),
    codeOwners: matchCodeOwners(changedPaths, parsedCodeOwners),
    disclaimer: DISCLAIMER
  };
}

export function applyReviewGuidance(report, guidance) {
  report.reviewGuidance = guidance && typeof guidance === 'object'
    ? guidance
    : {
        changedPaths: [],
        protectedPaths: [],
        codeOwners: {
          sourcePath: null,
          suggestions: [],
          unownedPaths: [],
          unmatchedPaths: [],
          warnings: []
        },
        disclaimer: DISCLAIMER
      };
  return report;
}
