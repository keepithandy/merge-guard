import { validateArtifactManifest } from './artifactManifest.js';
import {
  compareFindingReports,
  FindingComparisonError,
  hashImmutableReport
} from './findingComparison.js';

const STATUS_MESSAGES = {
  missing: 'No previous report or artifact manifest was supplied; finding changes are unknown.',
  stale: 'The selected prior evidence does not match the expected prior commit; finding changes are unknown.',
  'cross-branch': 'The selected prior evidence belongs to a different repository or branch; finding changes are unknown.',
  incompatible: 'The selected prior evidence uses an incompatible contract; finding changes are unknown.',
  unverifiable: 'The selected prior report and artifact manifest could not be verified together; finding changes are unknown.'
};
const SHA256 = /^[a-f0-9]{64}$/;

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function diagnostic(path, code, message, expected = null, actual = null) {
  return { path, code, message, expected, actual };
}

function result(status, manifest = null, expected = {}, diagnostics = []) {
  return {
    status,
    usable: status === 'verified',
    artifactId: SHA256.test(manifest?.artifactId || '') ? manifest.artifactId : null,
    source: manifest?.evidence ? {
      repository: text(manifest.evidence.repository),
      branch: text(manifest.evidence.branch),
      commit: text(manifest.evidence.commit)
    } : null,
    expected: {
      repository: text(expected.repository),
      branch: text(expected.branch),
      commit: text(expected.commit)
    },
    diagnostics: diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code))
  };
}

export function selectPriorEvidence({ previousReport = null, manifest = null, expected = {} } = {}) {
  if (previousReport === null && manifest === null) {
    return result('missing', null, expected, [diagnostic('$', 'missing-prior-evidence', STATUS_MESSAGES.missing)]);
  }
  if (previousReport === null || manifest === null) {
    return result('unverifiable', manifest, expected, [diagnostic(
      previousReport === null ? '$.previousReport' : '$.manifest',
      previousReport === null ? 'missing-previous-report' : 'missing-artifact-manifest',
      'A previous report and its artifact manifest must be supplied together.'
    )]);
  }

  try {
    hashImmutableReport(previousReport);
  } catch (error) {
    const diagnostics = error instanceof FindingComparisonError
      ? error.diagnostics
      : [diagnostic('$.previousReport', 'invalid-report', 'The previous report is not compatible.')];
    return result('incompatible', manifest, expected, diagnostics);
  }

  const validation = validateArtifactManifest(manifest, { report: previousReport });
  if (!validation.valid) {
    const incompatible = validation.diagnostics.some((entry) =>
      entry.code === 'unsupported-schema' || entry.code === 'invalid-report-reference'
    );
    return result(incompatible ? 'incompatible' : 'unverifiable', manifest, expected, validation.diagnostics);
  }

  const expectedRepository = text(expected.repository);
  const expectedBranch = text(expected.branch);
  const expectedCommit = text(expected.commit);
  const sourceRepository = text(manifest.evidence.repository);
  const sourceBranch = text(manifest.evidence.branch);
  const sourceCommit = text(manifest.evidence.commit);
  const crossBranch = [];
  if (expectedRepository && expectedRepository !== sourceRepository) {
    crossBranch.push(diagnostic('$.evidence.repository', 'repository-mismatch', 'Prior evidence repository does not match the expected repository.', expectedRepository, sourceRepository));
  }
  if (expectedBranch && expectedBranch !== sourceBranch) {
    crossBranch.push(diagnostic('$.evidence.branch', 'branch-mismatch', 'Prior evidence branch does not match the expected branch.', expectedBranch, sourceBranch));
  }
  if (crossBranch.length) return result('cross-branch', manifest, expected, crossBranch);

  if (expectedCommit && expectedCommit !== sourceCommit) {
    return result('stale', manifest, expected, [diagnostic(
      '$.evidence.commit',
      'commit-mismatch',
      'Prior evidence commit does not match the explicitly expected commit.',
      expectedCommit,
      sourceCommit
    )]);
  }

  return result('verified', manifest, expected);
}

export function compareWithPriorEvidence(previousReport, currentReport, priorEvidence) {
  if (priorEvidence?.status === 'verified') {
    return { ...compareFindingReports(previousReport, currentReport), priorEvidence };
  }
  const comparison = compareFindingReports(null, currentReport);
  const status = priorEvidence?.status || 'unverifiable';
  return {
    ...comparison,
    priorEvidence: priorEvidence || result('unverifiable'),
    warning: `${STATUS_MESSAGES[status] || STATUS_MESSAGES.unverifiable} This unavailable state must not be treated as a clean comparison.`
  };
}
