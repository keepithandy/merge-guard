# Post-release support and maintenance

The maintainer supports the current major release and the immediately preceding minor line while security fixes are assessed for every supported line. Triage acknowledges security reports within 3 business days, assigns severity and an owner, and publishes a fix or mitigation plan. Patches require the full compatibility/conformance suite, smoke, security, installation, and release-readiness checks.

## Release support handoff

Before any external publication, the release owner hands support the immutable source SHA, signed-subject status, checksum manifest, publication identifiers, validated Node/OS matrix, known limitations, last verified fallback, and contact path. Support records whether each channel is prepared, approved, published, and verified; a published package without post-publication installation evidence is not verified.

For a release incident, support first preserves the evidence and classifies the scope: pre-publication staging issue, signed-subject/provenance issue, npm package issue, GitHub attachment issue, stable Action-reference issue, or Marketplace issue. It then stops unapproved remaining mutations, gives consumers the last verified fallback, and routes every registry, release, reference, revocation, or notification operation to the release owner for explicit authorization. The incident record includes affected versions, source commit, artifact hashes, channels, decision time, owner, remediation, and follow-up verification.

Deprecated CLI flags, Action inputs, and schema fields receive at least one minor-release notice plus migration guidance before removal. The post-release checklist records CI health, issue/PR queue, dependency and provenance review, failed scans, artifact integrity, release adoption, support handoff, and any incident. Incidents are contained, affected artifacts are revoked, owners are notified, and a postmortem records the corrective action.

## Privacy-preserving feedback and troubleshooting

Merge Guard collects no telemetry and does not upload diagnostics, diffs, reports, configuration, or repository metadata. Users may choose to open an issue using the adoption-feedback or doctor-report templates. The templates ask for a minimal reproduction, Merge Guard and Node versions, doctor check IDs/statuses, and a description of the expected and actual behavior. They explicitly ask users to omit tokens, secrets, private URLs, absolute paths, repository contents, and customer data.

Before sharing a report, run `merge-guard --doctor --json` locally. Doctor intentionally omits supplied values and absolute filesystem paths. A user may share only the relevant check IDs/statuses and their own redacted context; full diagnostic output is never required for triage. Support treats missing or redacted evidence as unavailable rather than clean, and offers the supported journey matrix and next action without requesting sensitive data.
