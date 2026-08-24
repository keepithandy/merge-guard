# GitHub Actions and composite Action

Merge Guard runs in CI without an AI provider or API key.

## Reusable composite Action

The repository root contains `action.yml`.

```yaml
name: Merge Guard

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: keepithandy/merge-guard@main
        with:
          preset: standard
          comment: "true"
```

Full history is required when the Action creates the pull request diff. If `diff-path` is supplied, the caller is responsible for creating that diff file.

## Inputs

- `preset`: `safe`, `standard`, or `strict`; default `standard`.
- `policy`: optional explicit starter policy ID: `frontend`, `backend`, `library`, `browser-game`, or `infrastructure`.
- `policy-config`: optional repository-relative policy manifest path; cannot be combined with `policy`.
- `comment`: post or update the stable Merge Guard pull request comment; default `false`.
- `fail-threshold`: optional positive integer that overrides the preset failure score.
- `diff-path`: optional path to a prebuilt diff.
- `markdown`: print Markdown instead of plain text; default `true`. Comment mode always uses Markdown.

When `comment: "true"` is used, grant `pull-requests: write`. The Action captures the scan output, posts or updates the report, and then enforces the CLI exit code.

## Pull request context

On `pull_request` events, the Action passes `github.event.pull_request.title` and `github.event.pull_request.body` to the CLI. The body is written to a UTF-8 file before being passed through `--pr-body`.

PR context appears in text, Markdown, JSON, and AI-ready output. It is context only: rules, scores, readiness, and failure thresholds remain diff-authoritative. On events without pull request metadata, the Action runs without PR context.

Comment mode uses the compact summary contract: highest-risk files first, followed by expandable files, rules, and checks. CI writes the same compact view to `GITHUB_STEP_SUMMARY`, while report-only stdout remains the full Markdown report. See [compact pull-request summaries](pull-request-summaries.md).

Set `annotations: "true"` to emit deduplicated native workflow annotations for findings with valid added-line anchors. Set `sarif: "true"` to generate, but not upload, `merge-guard.sarif`. The Action outputs `report-path`, `annotations-path`, and `sarif-path`; generation requires no extra secrets. SARIF upload is deliberately separate and may require `security-events: write` plus repository code-scanning availability. See [GitHub annotations and SARIF](github-review-outputs.md).

## Direct CI mode

The equivalent CLI mode is:

```bash
node src/cli.js --ci --preset standard pr.diff
node src/cli.js --ci --preset strict --fail-threshold 5 pr.diff
```

`--ci` prints Markdown, writes to `GITHUB_STEP_SUMMARY` when available, and exits non-zero when the report reaches `failThreshold`.

## Pull request comment helper

The composite Action uses `scripts/pr-comment.js`. The helper includes a stable hidden marker, so reruns update the prior Merge Guard comment instead of creating duplicates.

```bash
node src/cli.js --pr-summary pr.diff > merge-guard-report.md
node scripts/pr-comment.js --report merge-guard-report.md --dry-run
```

Remove `--dry-run` inside an authenticated GitHub Actions job to create or update the comment.

## Optional AI-ready summary

```bash
node src/cli.js --ci --ai pr.diff
```

This organizes rules-based findings and emits a prompt package. It makes no network call, requires no API key, and does not replace human review.
