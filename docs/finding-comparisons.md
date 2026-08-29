# Finding comparison across pull-request pushes

Tracking: #41, #65, and #140

Merge Guard compares two immutable JSON reports and classifies rule findings as new, unchanged, or resolved:

```bash
node scripts/compare-reports.js \
  --previous previous-report.json \
  --previous-manifest previous-report.manifest.json \
  --expected-repository owner/repository \
  --expected-branch main \
  --expected-commit abc123 \
  --current current-report.json \
  --output merge-guard-comparison.json \
  --markdown
```

Comparison output and finding identity both use contract version 1. The machine-readable output is documented by `schemas/finding-comparison-v1.schema.json`.

## Stable finding identity

A finding identity is a SHA-256 digest of:

1. identity contract version;
2. source (`builtin`, `custom`, or a policy-pack ID);
3. stable rule ID;
4. normalized repository path, or an explicit global marker.

Reason text, check text, weight, matched-line count, and exception annotations remain report detail and do not change identity. An unchanged identity can therefore record `detailsChanged: true`. A multi-file rule produces one finding identity per path. Duplicate rule records are collapsed.

## Immutable report evidence

The comparator does not mutate either report. It canonicalizes every JSON object by sorted keys and records a SHA-256 content hash for the complete previous and current reports. Hashes make the exact comparison inputs auditable; they do not sign or authenticate those files.

Both inputs must be Merge Guard report schema version 1. Missing, malformed, future, or mismatched schemas fail with structured diagnostics instead of guessing.

## Verified prior-evidence selection

Supplying `--previous-manifest` enables the v1.3 verification path. Merge Guard validates the manifest identity, binds its report hash to the selected previous report, and optionally checks `--expected-repository`, `--expected-branch`, and `--expected-commit`. It never searches for an artifact or fills in an expected identity automatically.

The additive `priorEvidence.status` is one of:

- `verified`: the report and manifest match, and every supplied identity assertion matches;
- `missing`: neither prior input was supplied;
- `stale`: the manifest commit differs from the explicitly expected prior commit;
- `cross-branch`: the repository or branch differs from the explicit expectation;
- `incompatible`: the selected report or manifest uses an unsupported contract;
- `unverifiable`: an input is absent, malformed, or fails its identity or content hash.

Only `verified` evidence is classified. Every other status produces `history-unavailable`, null counts, empty classification arrays, and a non-clean exit. The legacy report-only path remains supported for v1 compatibility, but it does not claim manifest verification.

## Classification semantics

- `new`: identity exists only in the current report;
- `unchanged`: identity exists in both reports, with previous/current detail retained;
- `resolved`: identity exists only in the previous report.

Resolved means absent from the current report. It does not prove that a defect was fixed, reviewed, or safe to merge. Renaming a finding's path intentionally appears as one resolved identity and one new identity unless a future version defines explicit rename provenance.

Comparison is projection-only. It does not add or remove report findings, change risk scores or readiness, lower thresholds, or affect the scanner exit code.

## Missing history is unknown

Omitting `--previous` produces a valid `history-unavailable` document with `classificationAvailable: false`, null counts, empty classification arrays, and a warning that the result must not be treated as clean. The helper exits with code 2 so automation can distinguish unavailable history from both a completed comparison and invalid input.

## Composite Action

The Action accepts an explicitly supplied previous report:

```yaml
- uses: keepithandy/merge-guard@main
  id: merge_guard
  with:
    compare: "true"
    previous-report: path/from/a/previous-workflow/report.json
```

It writes `merge-guard-comparison.json`, appends the Markdown comparison to the job summary and managed comment content, and exposes `comparison-path` and `comparison-status`. If `previous-report` is omitted, the Action emits a visible warning and reports `history-unavailable` without claiming zero new findings.

Merge Guard does not search workflow history, download artifacts, or choose a previous run automatically. The caller must retrieve and supply the intended immutable report. That explicit boundary prevents accidental comparison against the wrong branch, pull request, or configuration.

The composite Action generates a manifest for its current report and exposes `manifest-path`. It accepts `previous-manifest`, the three optional expected-identity inputs, and exposes `prior-evidence-status`. Upload and retrieval remain separate caller-owned steps; use the [least-privilege explicit handoff example](examples/github-actions-explicit-evidence-handoff.yml) as a starting point.

## Conformance

```bash
npm run test:finding-comparison
```

Fixtures cover new, unchanged, resolved, global, custom, and policy findings; changed details under stable identity; canonical report hashes; duplicate records; malformed and future schemas; missing, verified, stale, cross-branch, incompatible, and unverifiable prior evidence; deterministic JSON snapshots; Markdown output; and the file-based CLI helper. No network access, external service, or secret is required.

`npm run test:review-e2e` adds a complete two-push path: each report is generated from a cumulative diff, the first immutable report is supplied to the second comparison, and exact `2 new / 2 unchanged / 2 resolved` classifications are locked in the committed review snapshot.
