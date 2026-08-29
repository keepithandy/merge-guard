export const REVIEW_PROJECTION_SCHEMA_VERSION = 1;

const CHANNEL_STATUSES = new Set(['produced', 'skipped', 'unavailable', 'failed', 'incomplete']);

function channel(status, path = null, reason = null, result = null) {
  if (!CHANNEL_STATUSES.has(status)) throw new Error(`unsupported review projection status: ${status}`);
  return { status, path, reason, result };
}

function requestedChannel(requested, available, path, failure, unavailableReason) {
  if (!requested) return channel('skipped', null, 'not requested');
  if (failure) return channel('failed', null, failure);
  if (available) return channel('produced', path);
  return channel('unavailable', null, unavailableReason);
}

export function createReviewProjection(input = {}) {
  const attemptOutcome = input.attemptOutcome || 'completed';
  const canceled = attemptOutcome === 'cancelled';
  const report = canceled
    ? channel('incomplete', null, 'the workflow attempt was canceled; no completeness claim is made')
    : input.reportAvailable
      ? channel('produced', input.reportPath || 'merge-guard-report.json')
      : channel('failed', null, 'the authoritative JSON report was not produced');
  const manifest = canceled
    ? channel('incomplete', null, 'the workflow attempt was canceled')
    : input.manifestAvailable
      ? channel('produced', input.manifestPath || 'merge-guard-report.manifest.json')
      : channel('unavailable', null, 'the report manifest was not produced');

  const annotations = canceled
    ? channel('incomplete', null, 'the workflow attempt was canceled')
    : requestedChannel(input.annotationsRequested, input.annotationsAvailable, input.annotationsPath, input.reviewFailure, 'annotations were requested but not produced');
  const sarif = canceled
    ? channel('incomplete', null, 'the workflow attempt was canceled')
    : requestedChannel(input.sarifRequested, input.sarifAvailable, input.sarifPath, input.reviewFailure, 'SARIF was requested but not produced');

  let comparison;
  if (canceled) comparison = channel('incomplete', null, 'the workflow attempt was canceled');
  else if (!input.comparisonRequested) comparison = channel('skipped', null, 'not requested');
  else if (input.comparisonFailure) comparison = channel('failed', null, input.comparisonFailure);
  else if (input.comparisonAvailable) comparison = channel('produced', input.comparisonPath, null, input.comparisonStatus || 'compared');
  else comparison = channel('unavailable', null, 'comparison was requested but no comparison document was produced');

  let comment;
  if (canceled) comment = channel('incomplete', null, 'the workflow attempt was canceled');
  else if (!input.commentRequested) comment = channel('skipped', null, 'not requested');
  else if (!input.commentEligible) comment = channel('skipped', null, 'the event is not eligible for pull-request comments');
  else if (input.commentStatus === 'produced') comment = channel('produced', null, null, input.commentResult || 'published');
  else if (input.commentStatus === 'unavailable') comment = channel('unavailable', null, input.commentReason || 'GitHub comment permission or availability prevented publication');
  else if (input.commentStatus === 'failed') comment = channel('failed', null, input.commentReason || 'managed comment projection failed');
  else comment = channel('unavailable', null, 'managed comment projection did not report an outcome');

  const threshold = canceled
    ? channel('incomplete', null, 'the workflow attempt was canceled')
    : channel('produced', null, null, Number(input.scanExitCode || 0) === 0 ? 'passed' : 'failed');
  const channels = { report, manifest, comment, annotations, sarif, comparison, threshold };
  const statuses = Object.values(channels).map((entry) => entry.status);
  const status = statuses.includes('incomplete') ? 'incomplete'
    : statuses.includes('failed') ? 'failed'
      : statuses.includes('unavailable') ? 'degraded'
        : 'complete';

  return {
    schemaVersion: REVIEW_PROJECTION_SCHEMA_VERSION,
    status,
    attemptOutcome,
    channels,
    semantics: 'Projection status describes evidence availability only. It does not change findings, risk scoring, merge readiness, or the configured threshold result.'
  };
}
