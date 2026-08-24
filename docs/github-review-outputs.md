# GitHub changed-line annotations and SARIF

Tracking: #41 and #64

Merge Guard can project an already completed report onto changed lines. The projection is optional and cannot alter findings, risk scores, readiness, or CI thresholds.

```bash
node src/cli.js --annotations change.diff > merge-guard-annotations.json
node src/cli.js --sarif change.diff > merge-guard.sarif
```

The annotation bundle uses schema version 1, documented by `schemas/github-review-output-v1.schema.json`. SARIF output uses SARIF 2.1.0 and records the Merge Guard projection contract as `mergeGuardSchemaVersion: 1`.

## Eligible locations

A rule finding is eligible when it can be tied to a changed file with at least one added line in the authoritative unified diff. Merge Guard anchors that rule/file pair to the file's first added line and records `anchor: first-added-line`; it does not claim that this line alone caused the finding.

Candidate paths come from the finding's `matchedFiles` and the per-file rule breakdown. Each `ruleId + path + line` tuple is emitted once. Stable SHA-256 IDs and path-based finding fingerprints are included for deterministic consumers.

Findings without a changed-file anchor, and findings on deletion-only files, remain in the normal report and are listed under `unsupported` in the annotation bundle. They are never discarded merely because GitHub cannot display them inline.

## Workflow annotations

The composite Action accepts:

```yaml
- uses: keepithandy/merge-guard@main
  id: merge_guard
  with:
    annotations: "true"
    sarif: "true"
```

`annotations: "true"` emits GitHub `warning` or `notice` workflow commands with repository path and one-based line positions. Command data and properties are escaped before emission. GitHub documents the native command shape in [Workflow commands for GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands).

The Action outputs:

- `report-path`: complete JSON report built once from the authoritative diff;
- `annotations-path`: annotation bundle when enabled;
- `sarif-path`: SARIF file when enabled.

No extra token scope or third-party secret is needed to generate these files or emit workflow annotations.

## SARIF generation and upload boundary

SARIF results include one physical location, a stable `ruleId`, and `partialFingerprints.primaryLocationLineHash`. GitHub uses locations to display results and fingerprints to reduce duplicate alerts, as described in [SARIF support for code scanning](https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support).

Merge Guard only generates `merge-guard.sarif`; it does not upload it. Upload is a separate repository-owner decision because GitHub code-scanning availability and `security-events: write` permissions vary. See [Uploading a SARIF file to GitHub](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file) before adding an upload step.

## One-report Action path

The Action scan writes `merge-guard-report.json` while producing its normal stdout and exit code. Optional annotations and SARIF are then derived from that immutable report and the same diff. The threshold result is enforced after optional review output generation, preserving failure behavior.

For manual projection from stored files:

```bash
node scripts/github-review-outputs.js \
  --report merge-guard-report.json \
  --diff change.diff \
  --annotations merge-guard-annotations.json \
  --sarif merge-guard.sarif \
  --emit-commands
```

The helper rejects symbolic-link inputs, limits report input to 10 MB and diff input to 20 MB, performs no network calls, and never executes suggested checks.

## Conformance

```bash
npm run test:github-review
```

Fixtures cover changed-line parsing, CRLF input, quoted paths, line-only rules, deletion-only unsupported locations, duplicate rule records, workflow-command escaping, SARIF locations and fingerprints, immutable score/report data, helper file output, schema metadata, and deterministic snapshots. The composite Action fixture enables both outputs without third-party services.
