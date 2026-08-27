# Post-release support and maintenance

The maintainer supports the current major release and the immediately preceding minor line while security fixes are assessed for every supported line. Triage acknowledges security reports within 3 business days, assigns severity and an owner, and publishes a fix or mitigation plan. Patches require the full compatibility/conformance suite, smoke, security, installation, and release-readiness checks.

## Release support handoff

Before any external publication, the release owner hands support the immutable source SHA, signed-subject status, checksum manifest, publication identifiers, validated Node/OS matrix, known limitations, last verified fallback, and contact path. Support records whether each channel is prepared, approved, published, and verified; a published package without post-publication installation evidence is not verified.

For a release incident, support first preserves the evidence and classifies the scope: pre-publication staging issue, signed-subject/provenance issue, npm package issue, GitHub attachment issue, stable Action-reference issue, or Marketplace issue. It then stops unapproved remaining mutations, gives consumers the last verified fallback, and routes every registry, release, reference, revocation, or notification operation to the release owner for explicit authorization. The incident record includes affected versions, source commit, artifact hashes, channels, decision time, owner, remediation, and follow-up verification.

Deprecated CLI flags, Action inputs, and schema fields receive at least one minor-release notice plus migration guidance before removal. The post-release checklist records CI health, issue/PR queue, dependency and provenance review, failed scans, artifact integrity, release adoption, support handoff, and any incident. Incidents are contained, affected artifacts are revoked, owners are notified, and a postmortem records the corrective action.
