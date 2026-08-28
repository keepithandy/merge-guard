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
- `impact-metadata`: optional repository-relative path to explicit, checked-in impact metadata. It is read only and does not infer dependency impact yet.
- `comment`: post or update the stable Merge Guard pull request comment; default `false`.
- `comment-dry-run`: render comment mode without calling GitHub; default `false` and intended for fixture/workflow validation.
- `fail-threshold`: optional positive integer that overrides the preset failure score.
- `annotations`: emit deduplicated workflow annotations for eligible changed lines; default `false`.
- `sarif`: generate `merge-guard.sarif` without uploading it; default `false`.
- `compare`: compare current findings with an explicitly supplied prior report; default `false`.
- `previous-report`: optional path to that immutable prior report.
- `diff-path`: optional path to a prebuilt diff.
- `markdown`: print Markdown instead of plain text; default `true`. Comment mode always uses Markdown.

When live `comment: "true"` is used, grant `pull-requests: write`. The Action captures the scan output, posts or updates the report, and then enforces the CLI exit code. `comment-dry-run: "true"` prints the marker-prefixed body and performs no API request, so it does not need write permission.

## Least-privilege adoption path

Start with a report-only workflow. It needs only `contents: read`; comments, uploads, and external services remain disabled:

```yaml
permissions:
  contents: read

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: keepithandy/merge-guard@<reviewed-commit-sha>
        with:
          comment: "false"
          annotations: "true"
          sarif: "true"
```

Use an immutable reviewed commit while the v1.0 publication decision remains pending. Enable `comment: "true"` only after separately deciding to grant `pull-requests: write`; passing a scan or doctor check does not grant or imply that permission.

To include explicit repository-impact metadata in an Action report, keep the file in the checked-out repository and select it directly:

```yaml
      - uses: keepithandy/merge-guard@<reviewed-commit-sha>
        with:
          impact-metadata: .merge-guard/impact.json
```

Invalid or unavailable metadata remains explicit unknown evidence in the report; the Action does not discover another file, fetch metadata, or execute a package manager. See [impact metadata](impact-metadata.md).

For an offline configuration review, create a secret-free JSON object with the intended Action inputs and run `merge-guard --doctor --json --action-inputs action-inputs.json`. Doctor validates the input contract locally; it does not read a live workflow, invoke the Action, or inspect credentials.

## Pull request context

On `pull_request` events, the Action passes `github.event.pull_request.title` and `github.event.pull_request.body` to the CLI. The body is written to a UTF-8 file before being passed through `--pr-body`.

PR context appears in text, Markdown, JSON, and AI-ready output. It is context only: rules, scores, readiness, and failure thresholds remain diff-authoritative. On events without pull request metadata, the Action runs without PR context.

Comment mode uses the compact summary contract: highest-risk files first, followed by expandable files, rules, and checks. CI writes the same compact view to `GITHUB_STEP_SUMMARY`, while report-only stdout remains the full Markdown report. See [compact pull-request summaries](pull-request-summaries.md).

Set `annotations: "true"` to emit deduplicated native workflow annotations for findings with valid added-line anchors. Set `sarif: "true"` to generate, but not upload, `merge-guard.sarif`. The Action outputs `report-path`, `annotations-path`, and `sarif-path`; generation requires no extra secrets. SARIF upload is deliberately separate and may require `security-events: write` plus repository code-scanning availability. See [GitHub annotations and SARIF](github-review-outputs.md).

Set `compare: "true"` and pass `previous-report` to classify current findings against an explicitly retrieved prior JSON report. The Action exposes `comparison-path` and `comparison-status` and appends the comparison to the job summary and managed comment content. Without a previous report, status is `history-unavailable` and a warning is emitted; missing history is not reported as clean. Merge Guard never chooses or downloads prior artifacts automatically. See [finding comparison across pushes](finding-comparisons.md).

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

## End-to-end fixture

`npm run test:review-e2e` replays opened and synchronize events with two cumulative pull-request diffs. It validates report and comment rendering, changed-line annotations, SARIF, new/unchanged/resolved comparison, missing-history exit 2, threshold exit 1 with a retained report, and create-then-update comment behavior through an injected offline request adapter.

`.github/workflows/review-experience-fixture.yml` also invokes the composite Action in report mode and dry-run comment mode. It supplies the first report explicitly to the second Action invocation, enables annotations and SARIF, and asserts all outputs. The workflow has only `contents: read`, uses no third-party secret or service, never uploads SARIF, and never writes a pull-request comment. See [review experience fixtures](review-experience-fixtures.md).

## Optional AI-ready summary

```bash
node src/cli.js --ci --ai pr.diff
```

This organizes rules-based findings and emits a prompt package. It makes no network call, requires no API key, and does not replace human review.
