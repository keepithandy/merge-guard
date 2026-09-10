import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const EVALUATION_CONTEXT_SCHEMA_VERSION = 1;

const COMMIT = /^[a-f0-9]{40,64}$/i;
const HASH = /^[a-f0-9]{64}$/i;
const MAX_CONTEXT_BYTES = 1024 * 1024;

export class EvaluationContextError extends Error {
  constructor(message, diagnostics = []) {
    super(message);
    this.name = 'EvaluationContextError';
    this.diagnostics = diagnostics;
  }
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function diagnostic(pathValue, code, message, value, expected) {
  return { severity: 'fatal', path: pathValue, code, message, value, expected };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizedPath(value) {
  if (typeof value !== 'string') return null;
  const candidate = value.trim().replaceAll('\\', '/');
  if (!candidate || candidate.startsWith('/') || candidate.includes('\0')) return null;
  const parts = candidate.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  return candidate;
}

function validateCommit(value, fieldPath, diagnostics) {
  if (typeof value !== 'string' || !COMMIT.test(value)) {
    diagnostics.push(diagnostic(fieldPath, 'invalid-commit', `${fieldPath} must be a full Git object ID.`, value, '40- or 64-character hexadecimal commit ID'));
    return null;
  }
  return value.toLowerCase();
}

function validatePolicySource(value, diagnostics) {
  if (!isObject(value)) {
    diagnostics.push(diagnostic('$.policySource', 'invalid-policy-source', '$.policySource must be an object.', value, 'object with path, revision, and sha256'));
    return null;
  }
  const unknown = Object.keys(value).filter((key) => !['path', 'revision', 'sha256'].includes(key));
  if (unknown.length) {
    diagnostics.push(diagnostic('$.policySource', 'unknown-policy-source-fields', '$.policySource contains unsupported fields.', unknown, 'path, revision, sha256'));
  }
  const sourcePath = normalizedPath(value.path);
  if (!sourcePath) {
    diagnostics.push(diagnostic('$.policySource.path', 'invalid-policy-source-path', '$.policySource.path must be a safe repository-relative path.', value.path, 'relative path without traversal'));
  }
  const revision = validateCommit(value.revision, '$.policySource.revision', diagnostics);
  const digest = typeof value.sha256 === 'string' && HASH.test(value.sha256) ? value.sha256.toLowerCase() : null;
  if (!digest) {
    diagnostics.push(diagnostic('$.policySource.sha256', 'invalid-policy-source-digest', '$.policySource.sha256 must be a SHA-256 digest.', value.sha256, '64-character lowercase hexadecimal SHA-256'));
  }
  return sourcePath && revision && digest ? { path: sourcePath, revision, sha256: digest } : null;
}

function validatePolicyChanges(value, diagnostics) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic('$.policyChanges', 'invalid-policy-changes', '$.policyChanges must be an array.', value, 'array of safe repository-relative paths'));
    return [];
  }
  const paths = [];
  for (const [index, candidate] of value.entries()) {
    const normalized = normalizedPath(candidate);
    if (!normalized) {
      diagnostics.push(diagnostic(`$.policyChanges[${index}]`, 'invalid-policy-change-path', 'Policy-change paths must be safe repository-relative paths.', candidate, 'relative path without traversal'));
    } else {
      paths.push(normalized);
    }
  }
  if (new Set(paths).size !== paths.length) {
    diagnostics.push(diagnostic('$.policyChanges', 'duplicate-policy-change-path', '$.policyChanges must not contain duplicates.', value, 'unique paths'));
  }
  return [...new Set(paths)].sort();
}

export function validateEvaluationContext(value) {
  const diagnostics = [];
  if (!isObject(value)) {
    return { valid: false, context: null, diagnostics: [diagnostic('$', 'invalid-evaluation-context', 'Evaluation context must be an object.', value, 'object')] };
  }
  const unknown = Object.keys(value).filter((key) => !['schemaVersion', 'baseSha', 'headSha', 'testedSha', 'inputType', 'policySource', 'starterPolicyRevision', 'policyChanges'].includes(key));
  if (unknown.length) {
    diagnostics.push(diagnostic('$', 'unknown-evaluation-context-fields', 'Evaluation context contains unsupported fields.', unknown, 'schemaVersion, baseSha, headSha, testedSha, inputType, policySource, starterPolicyRevision, policyChanges'));
  }
  if (value.schemaVersion !== EVALUATION_CONTEXT_SCHEMA_VERSION) {
    diagnostics.push(diagnostic('$.schemaVersion', 'unsupported-schema-version', `Evaluation context schemaVersion must be ${EVALUATION_CONTEXT_SCHEMA_VERSION}.`, value.schemaVersion, EVALUATION_CONTEXT_SCHEMA_VERSION));
  }
  const baseSha = validateCommit(value.baseSha, '$.baseSha', diagnostics);
  const headSha = validateCommit(value.headSha, '$.headSha', diagnostics);
  const testedSha = validateCommit(value.testedSha, '$.testedSha', diagnostics);
  const inputType = value.inputType === undefined ? null : value.inputType;
  if (inputType !== null && !['git-range', 'prebuilt-diff'].includes(inputType)) {
    diagnostics.push(diagnostic('$.inputType', 'invalid-input-type', '$.inputType must be git-range or prebuilt-diff.', inputType, 'git-range or prebuilt-diff'));
  }
  const policySource = value.policySource === undefined ? null : validatePolicySource(value.policySource, diagnostics);
  const starterPolicyRevision = value.starterPolicyRevision === undefined
    ? null
    : validateCommit(value.starterPolicyRevision, '$.starterPolicyRevision', diagnostics);
  const policyChanges = validatePolicyChanges(value.policyChanges, diagnostics);
  if (policySource && baseSha && policySource.revision !== baseSha) {
    diagnostics.push(diagnostic('$.policySource.revision', 'policy-source-not-at-base', 'The trusted policy source revision must equal baseSha.', policySource.revision, baseSha));
  }
  if (starterPolicyRevision && baseSha && starterPolicyRevision !== baseSha) {
    diagnostics.push(diagnostic('$.starterPolicyRevision', 'starter-policy-not-at-base', 'The trusted starter-policy revision must equal baseSha.', starterPolicyRevision, baseSha));
  }
  const valid = diagnostics.length === 0;
  return {
    valid,
    context: valid
      ? {
          schemaVersion: EVALUATION_CONTEXT_SCHEMA_VERSION,
          baseSha,
          headSha,
          testedSha,
          ...(inputType ? { inputType } : {}),
          policySource,
          ...(starterPolicyRevision ? { starterPolicyRevision } : {}),
          policyChanges
        }
      : null,
    diagnostics
  };
}

export function createEvaluationContext(value) {
  const result = validateEvaluationContext(value);
  if (!result.valid) {
    throw new EvaluationContextError('Evaluation context is invalid.', result.diagnostics);
  }
  return result.context;
}

export function loadEvaluationContext(filePath, { cwd = process.cwd() } = {}) {
  const repositoryRoot = path.resolve(cwd);
  const absolutePath = path.resolve(repositoryRoot, filePath);
  const relativePath = path.relative(repositoryRoot, absolutePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new EvaluationContextError(`Evaluation context "${filePath}" must stay inside the repository.`);
  }
  let raw;
  try {
    const stats = fs.lstatSync(absolutePath);
    if (stats.isSymbolicLink()) throw new Error('symbolic links are not followed');
    if (!stats.isFile()) throw new Error('path is not a regular file');
    if (stats.size > MAX_CONTEXT_BYTES) throw new Error('file exceeds the 1 MB context limit');
    const realRoot = fs.realpathSync(repositoryRoot);
    const realContext = fs.realpathSync(absolutePath);
    const realRelative = path.relative(realRoot, realContext);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw new Error('resolved path escapes the repository');
    raw = fs.readFileSync(absolutePath, 'utf8');
  } catch (error) {
    throw new EvaluationContextError(`Unable to read evaluation context "${filePath}": ${error.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new EvaluationContextError(`Unable to parse evaluation context "${filePath}": ${error.message}`);
  }
  return createEvaluationContext(parsed);
}
