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
  "version": "0.1.0",
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
- `prContext`

`prContext` is `null` when no title or body was supplied. Context never changes risk scoring.

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
