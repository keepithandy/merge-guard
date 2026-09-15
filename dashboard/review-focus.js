export function buildReviewFocus({ report, findings, progress, comparison, expiringSuppressions }) {
  const items = [];
  const completed = findings.filter((finding) => progress.get(finding.identity)?.completed).length;
  const remaining = findings.length - completed;

  if (comparison?.configurationChanged) {
    items.push({
      key: 'configuration-changed',
      priority: 'context',
      title: 'Reconfirm policy context first',
      detail: 'The selected reports use different configuration. Compare finding identities before interpreting score movement or tuning policy.'
    });
  }
  if (comparison?.summary.new) {
    items.push({
      key: 'new-findings',
      priority: 'high',
      title: `Review ${comparison.summary.new} new finding${comparison.summary.new === 1 ? '' : 's'} first`,
      detail: 'New findings are the first review queue; record the verification performed for each applicable finding.'
    });
  }
  if (remaining) {
    items.push({
      key: 'verification-pending',
      priority: 'high',
      title: `Record verification for ${remaining} finding${remaining === 1 ? '' : 's'}`,
      detail: `${completed} of ${findings.length} finding${findings.length === 1 ? '' : 's'} have recorded verification in this session.`
    });
  } else if (findings.length) {
    items.push({
      key: 'verification-recorded',
      priority: 'context',
      title: `Verification recorded for all ${findings.length} finding${findings.length === 1 ? '' : 's'}`,
      detail: 'Recorded progress is a review work log, not an approval or a change to Merge Guard results.'
    });
  }
  if (comparison?.summary.unchanged) {
    items.push({
      key: 'recurring-findings',
      priority: 'medium',
      title: `Revisit ${comparison.summary.unchanged} repeated finding${comparison.summary.unchanged === 1 ? '' : 's'}`,
      detail: 'Decide whether the repeated signal needs remediation or is a candidate for an evidence-backed policy adjustment.'
    });
  }
  if (expiringSuppressions.length) {
    items.push({
      key: 'expiring-suppressions',
      priority: 'medium',
      title: `Review ${expiringSuppressions.length} expiring suppression${expiringSuppressions.length === 1 ? '' : 's'}`,
      detail: 'Renewal should be explicit; remove the suppression when its original justification no longer applies.'
    });
  }
  items.push({
    key: 'reported-readiness',
    priority: 'context',
    title: `Reported readiness: ${report.mergeReadiness}`,
    detail: 'This is the imported report value. Team policy and reviewer judgment still determine the merge decision.'
  });

  return Object.freeze({
    verification: Object.freeze({ total: findings.length, completed, remaining }),
    items: Object.freeze(items.map((item) => Object.freeze(item)))
  });
}
