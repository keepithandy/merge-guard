# Merge Guard report contract

Merge Guard emits the same underlying report as plain text, Markdown, or JSON. JSON is the machine-readable contract.

```bash
node src/cli.js --json examples/sample.diff
```

## Schema version

Every CLI JSON report contains:

```json
{
  "tool": "merge-guard",
  "version": "1.1.0",
  "schemaVersion": 1
}
```

Consumers should check `schemaVersion` before interpreting the payload. Additive fields may be introduced within schema version 1; removals, renames, type changes, semantic reinterpretations, or incompatible nesting require a schema-version increment. See `docs/REPORT_CONTRACT_SNAPSHOTS.md`.

## Required top-level fields

- `tool` and `version`: producer identity.
- `schemaVersion`: machine-readable contract version.
- `riskLevel`: `LOW`, `MEDIUM`, or `HIGH`.
- `mergeReadiness`: `SAFE_TO_MERGE`, `NEEDS_REVIEW`, or `DO_NOT_MERGE_YET`.
- `riskScore`: numeric score used with the configured thresholds.
- `docsOnly`: whether every changed file is documentation, an example, Markdown, or comment-only content.
- `config`: resolved preset, thresholds, custom rules, and suppressions.
- `summary`: changed-file and line totals.
- `files`: per-file risk breakdown.
- `rules`: normalized rule findings and explanations.
- `flags`: human-readable finding labels.
- `suggestedChecks`: recommended verification steps.
- `configDiagnostics`: non-fatal configuration diagnostics.

## Enriched fields

Normal CLI reports also expose:

- `customRuleWarnings`
- `suppressionWarnings`
- `suppressedFindings`
- `projectChecks`
- `projectCheckDetails`
- `repository`
- `policyPacks`
- `policyRequiredChecks`
- `reviewGuidance`
- `policyResolution`
- `policyExceptions`
- `prContext`

`prContext` is `null` when no title or body was supplied. Context never changes risk scoring.

`projectChecks` remains the ordered string-command compatibility field. `projectCheckDetails` adds category, ecosystem, and `sources[]` records containing a repository-relative path and reason for every detected CLI command.

`repository` contains detected package-layout metadata, warnings, `affectedPackages`, and optional `impactMetadata`. Direct ownership, repository-level shared files, and potential shared-impact packages are separate. Potential shared impact does not assert a dependency graph. `impactMetadata` is `not-provided`, `invalid`, or `valid`; only an explicit local file can make it valid, and its first v1.2 contract slice does not yet infer dependency impact. See `docs/repository-intelligence.md` and `docs/impact-metadata.md`.

`policyPacks` and `policyRequiredChecks` appear only after explicit policy selection. Policy findings use namespaced IDs, retain their pack ID/version, and are separate from project custom rules. Required checks are suggestions with reasons; they are never executed automatically. See `docs/starter-policy-packs.md`.

`reviewGuidance` separates selected-policy protected-path matches and unverified CODEOWNERS suggestions from scoring. It includes unmatched/unowned paths, parser warnings, and an explicit no-assignment/no-approval disclaimer. See `docs/review-guidance.md`.

`policyResolution` records root/package precedence and per-path provenance after explicit manifest selection. `policyExceptions` records active and unmatched reasoned/owned/expiring annotations. Exceptions never change score, checks, guidance, or CI thresholds. See `docs/policy-inheritance.md`.

## Pull-request summary view

`--pr-summary` is a deterministic Markdown projection of the completed report, not a second report schema or scoring path. Contract version 1 puts risk and the highest-risk files first, then exposes expandable files, rules, and checks. It never mutates report values or derives risk from PR text. See `docs/pull-request-summaries.md` and the committed `test/snapshots/pr-summary-*.md` fixtures.

`--annotations` and `--sarif` are optional projections of a completed report onto valid added-line locations from the authoritative diff. The annotation bundle has schema version 1; SARIF uses 2.1.0 and embeds the projection version. Findings without an eligible location remain in the normal report and are recorded as unsupported rather than dropped. See `docs/github-review-outputs.md`.

Finding comparison output uses schema version 1 and identity version 1. It records canonical hashes of the complete previous/current reports and classifies stable rule/source/path identities as new, unchanged, or resolved. Missing history produces explicit unknown classifications and a distinct exit code. See `docs/finding-comparisons.md`.

The complete projection path is exercised by the deterministic two-push fixture described in `docs/review-experience-fixtures.md`; the fixture does not introduce another report schema.

## Files and rules

Each `files` entry contains its path, risk level, risk score, changed-line counts, reason, flags, and matched rules. Each rule finding includes a stable ID, label, weight, reason, suggested check, matched files, and matched added-line count.

## Suppression semantics

Suppressions annotate matching findings in `suppressedFindings`. They do not remove entries from `rules`, reduce `riskScore`, or bypass CI thresholds. Expired and malformed suppressions appear in `suppressionWarnings`. See `docs/suppressions.md`.

## Configuration diagnostics

Fatal configuration errors do not emit a normal report. With `--json`, the CLI writes an error payload to stderr and exits non-zero:

```json
{
  "error": "invalid merge-guard.config.json",
  "code": "INVALID_CONFIGURATION",
  "diagnostics": []
}
```

Non-fatal diagnostics remain in `configDiagnostics`. See `docs/configuration-diagnostics.md`.
