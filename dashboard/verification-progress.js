import { RUNTIME_DEFECT_SEVERITIES, VERIFICATION_NOTE_MAX_LENGTH, VERIFICATION_STATUSES } from './human-verification.js';

export const VERIFICATION_PROGRESS_TOOL = 'merge-guard-verification-progress';
export const VERIFICATION_PROGRESS_SCHEMA_VERSION = 2;
export const VERIFICATION_PROGRESS_SUPPORTED_SCHEMA_VERSIONS = Object.freeze([1, 2]);
export const VERIFICATION_PROGRESS_MAX_CHECKS = 50000;
export const VERIFICATION_PROGRESS_MAX_DEFECTS = 10000;
export const VERIFICATION_PROGRESS_MAX_NOTE_LENGTH = VERIFICATION_NOTE_MAX_LENGTH;

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validBinding(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function validNullableText(value, max = 8000) {
  return value === null || (typeof value === 'string' && value.length <= max);
}

function validateLegacy(progress) {
  if (!Array.isArray(progress.checks) || progress.checks.length > VERIFICATION_PROGRESS_MAX_CHECKS) return { valid: false, message: 'progress.checks must be an array within the supported limit' };
  const identities = new Set();
  for (const [index, check] of progress.checks.entries()) {
    if (!plainObject(check)) return { valid: false, message: `progress.checks[${index}] must be an object` };
    if (typeof check.findingIdentity !== 'string' || !check.findingIdentity) return { valid: false, message: `progress.checks[${index}].findingIdentity must be a non-empty string` };
    if (typeof check.completed !== 'boolean') return { valid: false, message: `progress.checks[${index}].completed must be boolean` };
    if (typeof check.note !== 'string' || check.note.length > VERIFICATION_PROGRESS_MAX_NOTE_LENGTH) return { valid: false, message: `progress.checks[${index}].note must be text within ${VERIFICATION_PROGRESS_MAX_NOTE_LENGTH} characters` };
    if (identities.has(check.findingIdentity)) return { valid: false, message: `progress.checks[${index}].findingIdentity is duplicated` };
    identities.add(check.findingIdentity);
  }
  return { valid: true, value: Object.freeze(progress), legacySchemaVersion: 1 };
}

function validateMetadata(metadata) {
  if (!plainObject(metadata)) return 'progress.session.metadata must be an object';
  for (const field of ['projectName', 'branch', 'buildLabel', 'commitSha', 'tester', 'dateTime', 'device', 'operatingSystem', 'browserRuntime', 'objective', 'environmentNote']) {
    if (typeof metadata[field] !== 'string' || metadata[field].length > 8000) return `progress.session.metadata.${field} must be bounded text`;
  }
  if (!(metadata.pullRequestNumber === null || (Number.isInteger(metadata.pullRequestNumber) && metadata.pullRequestNumber > 0))) return 'progress.session.metadata.pullRequestNumber must be a positive integer or null';
  return null;
}

function validateItem(item, index, identities) {
  if (!plainObject(item)) return `progress.session.items[${index}] must be an object`;
  if (typeof item.id !== 'string' || !item.id || identities.has(item.id)) return `progress.session.items[${index}].id must be unique non-empty text`;
  identities.add(item.id);
  if (!['merge-guard', 'user'].includes(item.kind)) return `progress.session.items[${index}].kind is invalid`;
  if (typeof item.title !== 'string' || !item.title || item.title.length > 8000) return `progress.session.items[${index}].title is invalid`;
  if (typeof item.instruction !== 'string' || item.instruction.length > 8000) return `progress.session.items[${index}].instruction is invalid`;
  if (typeof item.reason !== 'string' || item.reason.length > 8000) return `progress.session.items[${index}].reason is invalid`;
  if (!Array.isArray(item.affectedFiles) || item.affectedFiles.some((value) => typeof value !== 'string')) return `progress.session.items[${index}].affectedFiles is invalid`;
  if (typeof item.provenance !== 'string' || !item.provenance) return `progress.session.items[${index}].provenance is invalid`;
  if (!validNullableText(item.findingIdentity) || !validNullableText(item.ruleId)) return `progress.session.items[${index}] finding provenance is invalid`;
  if (!['new', 'current'].includes(item.comparisonState)) return `progress.session.items[${index}].comparisonState is invalid`;
  if (!VERIFICATION_STATUSES.includes(item.status)) return `progress.session.items[${index}].status is invalid`;
  if (typeof item.note !== 'string' || item.note.length > VERIFICATION_PROGRESS_MAX_NOTE_LENGTH) return `progress.session.items[${index}].note must be text within ${VERIFICATION_PROGRESS_MAX_NOTE_LENGTH} characters`;
  if (item.kind === 'user' && item.provenance !== 'User-added check') return `progress.session.items[${index}] user-added provenance is required`;
  return null;
}

function validateDefect(defect, index, identities) {
  if (!plainObject(defect)) return `progress.session.runtimeDefects[${index}] must be an object`;
  if (typeof defect.id !== 'string' || !defect.id || identities.has(defect.id)) return `progress.session.runtimeDefects[${index}].id must be unique non-empty text`;
  identities.add(defect.id);
  if (defect.kind !== 'human-runtime-defect') return `progress.session.runtimeDefects[${index}].kind is invalid`;
  if (typeof defect.title !== 'string' || !defect.title || defect.title.length > 8000) return `progress.session.runtimeDefects[${index}].title is invalid`;
  if (!RUNTIME_DEFECT_SEVERITIES.includes(defect.severity)) return `progress.session.runtimeDefects[${index}].severity is invalid`;
  for (const field of ['component', 'expectedBehavior', 'actualBehavior', 'reproductionSteps', 'environmentNote', 'evidenceReference']) {
    if (typeof defect[field] !== 'string' || defect[field].length > 8000) return `progress.session.runtimeDefects[${index}].${field} is invalid`;
  }
  if (!validNullableText(defect.relatedVerificationItem) || !validNullableText(defect.relatedFinding)) return `progress.session.runtimeDefects[${index}] relationship is invalid`;
  if (!['new', 'reopened'].includes(defect.observationState)) return `progress.session.runtimeDefects[${index}].observationState is invalid`;
  return null;
}

function validateCurrent(progress) {
  if (!plainObject(progress.reportIdentity)) return { valid: false, message: 'progress.reportIdentity must be an object' };
  for (const field of ['repository', 'branch', 'commitSha']) if (!validNullableText(progress.reportIdentity[field])) return { valid: false, message: `progress.reportIdentity.${field} is invalid` };
  if (!(progress.reportIdentity.pullRequestNumber === null || (Number.isInteger(progress.reportIdentity.pullRequestNumber) && progress.reportIdentity.pullRequestNumber > 0))) return { valid: false, message: 'progress.reportIdentity.pullRequestNumber is invalid' };
  const session = progress.session;
  if (!plainObject(session)) return { valid: false, message: 'progress.session must be an object' };
  if (typeof session.id !== 'string' || !session.id) return { valid: false, message: 'progress.session.id must be non-empty text' };
  if (!validNullableText(session.createdAt) || !validNullableText(session.updatedAt)) return { valid: false, message: 'progress session timestamps must be text or null' };
  const metadataError = validateMetadata(session.metadata);
  if (metadataError) return { valid: false, message: metadataError };
  if (!Array.isArray(session.items) || session.items.length > VERIFICATION_PROGRESS_MAX_CHECKS) return { valid: false, message: 'progress.session.items must be an array within the supported limit' };
  const identities = new Set();
  for (const [index, item] of session.items.entries()) {
    const error = validateItem(item, index, identities);
    if (error) return { valid: false, message: error };
  }
  if (!Array.isArray(session.runtimeDefects) || session.runtimeDefects.length > VERIFICATION_PROGRESS_MAX_DEFECTS) return { valid: false, message: 'progress.session.runtimeDefects must be an array within the supported limit' };
  const defectIdentities = new Set();
  for (const [index, defect] of session.runtimeDefects.entries()) {
    const error = validateDefect(defect, index, defectIdentities);
    if (error) return { valid: false, message: error };
  }
  return { valid: true, value: Object.freeze(progress), legacySchemaVersion: null };
}

export function validateVerificationProgress(progress) {
  if (!plainObject(progress)) return { valid: false, message: 'progress root must be an object' };
  if (progress.tool !== VERIFICATION_PROGRESS_TOOL) return { valid: false, message: `progress.tool must be ${VERIFICATION_PROGRESS_TOOL}` };
  if (!VERIFICATION_PROGRESS_SUPPORTED_SCHEMA_VERSIONS.includes(progress.schemaVersion)) return { valid: false, message: `progress schema version ${progress.schemaVersion} is unsupported; supported versions are ${VERIFICATION_PROGRESS_SUPPORTED_SCHEMA_VERSIONS.join(', ')}` };
  if (!validBinding(progress.reportBinding)) return { valid: false, message: 'progress.reportBinding must be a SHA-256 digest' };
  return progress.schemaVersion === 1 ? validateLegacy(progress) : validateCurrent(progress);
}

export function progressByFinding(progress) {
  if (progress.schemaVersion === 1) {
    return new Map(progress.checks.map((check) => [check.findingIdentity, { status: check.completed ? 'pass' : 'untested', note: check.note, migratedFromLegacyCompleted: check.completed }]));
  }
  return new Map(progress.session.items.filter((item) => item.findingIdentity).map((item) => [item.findingIdentity, { status: item.status, note: item.note }]));
}

export function createVerificationProgress(reportBinding, reportIdentity, session) {
  return {
    tool: VERIFICATION_PROGRESS_TOOL,
    schemaVersion: VERIFICATION_PROGRESS_SCHEMA_VERSION,
    reportBinding,
    reportIdentity: {
      repository: reportIdentity?.repository ?? null,
      branch: reportIdentity?.branch ?? null,
      pullRequestNumber: reportIdentity?.pullRequestNumber ?? null,
      commitSha: reportIdentity?.commitSha ?? null
    },
    session
  };
}
