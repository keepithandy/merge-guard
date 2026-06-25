# merge-guard report format

`merge-guard` produces a small merge-readiness report for a git diff.

## Fields

## `riskLevel`

The overall risk label.

Possible values:

- `LOW`
- `MEDIUM`
- `HIGH`

## `mergeReadiness`

The final merge recommendation.

Possible values:

- `SAFE_TO_MERGE`
- `NEEDS_REVIEW`
- `DO_NOT_MERGE_YET`

## `riskScore`

A simple numeric score based on risk signals found in the diff.

The score is not a guarantee. It is a prioritization aid.

## `summary`

Basic diff metadata:

- changed files
- added lines
- removed lines
- file list

## `flags`

Human-readable warnings found during the scan.

Examples:

- State or persistence logic changed
- Config file changed
- Implementation changed without matching test changes

## `suggestedChecks`

Recommended follow-up checks before merging.

Examples:

- Run the normal test suite
- Run smoke tests related to changed systems
- Manually review changed behavior

## JSON output

Run:

```bash
node src/cli.js examples/sample.diff --json
```

This returns the same report as structured JSON.
