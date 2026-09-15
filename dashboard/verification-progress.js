export const VERIFICATION_PROGRESS_TOOL = 'merge-guard-verification-progress';
export const VERIFICATION_PROGRESS_SCHEMA_VERSION = 1;
export const VERIFICATION_PROGRESS_MAX_CHECKS = 50000;
export const VERIFICATION_PROGRESS_MAX_NOTE_LENGTH = 2000;

function text(value) {
  return typeof value === 'string' ? value : '';
}

export function validateVerificationProgress(progress) {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return { valid: false, message: 'progress root must be an object' };
  if (progress.tool !== VERIFICATION_PROGRESS_TOOL) return { valid: false, message: `progress.tool must be ${VERIFICATION_PROGRESS_TOOL}` };
  if (progress.schemaVersion !== VERIFICATION_PROGRESS_SCHEMA_VERSION) return { valid: false, message: `only progress schema version ${VERIFICATION_PROGRESS_SCHEMA_VERSION} is supported` };
  if (typeof progress.reportBinding !== 'string' || !/^[a-f0-9]{64}$/.test(progress.reportBinding)) return { valid: false, message: 'progress.reportBinding must be a SHA-256 digest' };
  if (!Array.isArray(progress.checks) || progress.checks.length > VERIFICATION_PROGRESS_MAX_CHECKS) return { valid: false, message: 'progress.checks must be an array within the supported limit' };
  const identities = new Set();
  for (const [index, check] of progress.checks.entries()) {
    if (!check || typeof check !== 'object' || Array.isArray(check)) return { valid: false, message: `progress.checks[${index}] must be an object` };
    if (typeof check.findingIdentity !== 'string' || !check.findingIdentity) return { valid: false, message: `progress.checks[${index}].findingIdentity must be a non-empty string` };
    if (typeof check.completed !== 'boolean') return { valid: false, message: `progress.checks[${index}].completed must be boolean` };
    if (typeof check.note !== 'string' || check.note.length > VERIFICATION_PROGRESS_MAX_NOTE_LENGTH) return { valid: false, message: `progress.checks[${index}].note must be text within ${VERIFICATION_PROGRESS_MAX_NOTE_LENGTH} characters` };
    if (identities.has(check.findingIdentity)) return { valid: false, message: `progress.checks[${index}].findingIdentity is duplicated` };
    identities.add(check.findingIdentity);
  }
  return { valid: true, value: Object.freeze(progress) };
}

export function progressByFinding(progress) {
  return new Map(progress.checks.map((check) => [check.findingIdentity, { completed: check.completed, note: check.note }]));
}

export function createVerificationProgress(reportBinding, findings, progress) {
  return {
    tool: VERIFICATION_PROGRESS_TOOL,
    schemaVersion: VERIFICATION_PROGRESS_SCHEMA_VERSION,
    reportBinding,
    checks: findings.map((finding) => {
      const record = progress.get(finding.identity) || { completed: false, note: '' };
      return { findingIdentity: finding.identity, completed: Boolean(record.completed), note: text(record.note) };
    })
  };
}
