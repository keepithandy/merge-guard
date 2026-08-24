# Pull request context mode

Merge Guard can include a pull request title and body alongside its diff-authoritative report.

## CLI usage

```bash
node src/cli.js \
  --pr-title "Harden save migration boundaries" \
  --pr-body notes/pr-body.md \
  change.diff
```

- `--pr-title <text>` accepts optional title text.
- `--pr-body <path>` reads optional UTF-8 text or Markdown.
- A missing title and body leaves `prContext` as `null`.
- A missing body file is an error.

Context appears in plain text, Markdown, JSON, and AI-ready review output. When `--ai` is used, the title/body are appended to the review prompt with an explicit context-only warning.

## Composite Action behavior

On `pull_request` events, `action.yml` automatically passes the event title and body to the CLI. On other events, it runs without PR context. See `docs/GITHUB_ACTIONS.md`.

## Scoring boundary

PR prose never changes:

- matched rules;
- risk score or risk level;
- merge readiness;
- preset thresholds;
- CI failure behavior.

The diff remains authoritative. Context explains why a change exists; it cannot override or suppress a finding.

## Availability

PR context works with file and stdin diff workflows and requires no GitHub API access in direct CLI mode. The composite Action obtains context only from the event payload.
