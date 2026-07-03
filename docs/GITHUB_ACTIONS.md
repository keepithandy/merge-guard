# GitHub Actions report mode

`merge-guard` can run in CI without an AI provider or API key.

Use `--ci` to:

- print a Markdown merge-readiness report to the job log
- write the same report to the GitHub Actions step summary when available
- fail the job when the report score reaches the configured `failThreshold`

The default preset is `standard`. Use `--preset safe`, `--preset standard`, or `--preset strict` to choose how sensitive CI should be.

Examples:

```bash
node src/cli.js --ci pr.diff
node src/cli.js --ci --preset strict pr.diff
```

## Pull request comments

Use `scripts/pr-comment.js` to post the Markdown report to the pull request conversation.

The comment script uses a hidden marker so rerunning the workflow updates the previous merge-guard comment instead of adding a duplicate comment.

```bash
node src/cli.js --markdown --preset strict pr.diff > merge-guard-report.md
node scripts/pr-comment.js --report merge-guard-report.md
```

The workflow needs read access to contents and write access to pull request or issue comments. The script reads the standard GitHub Actions repository, event, and token environment values.

Use `--dry-run` to preview the exact comment body without calling GitHub:

```bash
node scripts/pr-comment.js --report merge-guard-report.md --dry-run
```

## Example workflow

See `examples/actions-report-mode.yml` for a copyable workflow.

The workflow checks out the pull request, installs Node, builds a pull request diff into `pr.diff`, creates `merge-guard-report.md`, posts or updates a pull request comment, and runs:

```bash
node src/cli.js --ci pr.diff
```

## Optional AI-ready summary

Add `--ai` when you want the report to include an AI-ready review summary and adapted review prompt:

```bash
node src/cli.js --ci --ai pr.diff
```

This mode still runs without an API key. The AI section organizes the rules-based findings and includes a prompt package that can be sent to an AI reviewer later. It does not replace human review and does not prove a pull request is safe.
