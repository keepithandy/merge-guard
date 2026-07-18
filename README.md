# merge-guard

`merge-guard` is a lightweight pull request and diff risk scanner for safer merges. It reviews changed files and creates a plain-English merge-readiness report showing what changed, what might break, which files look risky, and what checks should be run before merging.

The goal is simple: **protect the main branch before you merge.**

## Try It First

Install dependencies and run the bundled demo:

```bash
git clone https://github.com/keepithandy/merge-guard.git
cd merge-guard
npm install
npm run demo
```

Scan the sample diff:

```bash
node src/cli.js examples/sample.diff
```

Generate Markdown output:

```bash
node src/cli.js --markdown examples/sample.diff
```

Current status: active developer-tool prototype. The current CLI is rules-based and can produce useful merge-readiness reports without requiring an API key.

## What it answers

`merge-guard` focuses on five questions:

1. What changed?
2. Why does it matter?
3. What might break?
4. What checks should I run?
5. Is this safe to merge?

It does not replace human review. It gives developers a second set of eyes before shipping.

## Current version

This version supports:

- plain text, Markdown, and JSON reports
- CI-oriented output
- per-file risk scoring
- docs-only detection
- risk presets
- rule explanations
- project-defined custom rules
- optional pull request title/body context
- repository-aware suggested checks
- structured review summaries
- pull request comment update helpers
- npm/npx-compatible package metadata
- a reusable composite GitHub Action

Future versions can add richer summaries and a simple web dashboard.

## Example output

```txt
merge-guard report

Risk level: MEDIUM
Merge readiness: NEEDS_REVIEW
Risk score: 4
Preset: standard

Summary:
- 4 file(s) changed
- 86 added line(s)
- 22 removed line(s)

Per-file risk:
- MEDIUM src/saveState.js - State or persistence logic changed.
- MEDIUM package.json - Dependency or config file changed.
- LOW README.md - Documentation-only file.

Risk flags:
- State or persistence logic changed
- Dependency or config file changed
- Implementation changed without matching test changes

Suggested checks:
- Run the normal test suite
- Run smoke tests related to changed systems
- Manually review save/load behavior
```

## Install locally

```bash
git clone https://github.com/keepithandy/merge-guard.git
cd merge-guard
npm install
npm run demo
```

Scan a diff file:

```bash
node src/cli.js path/to/change.diff
```

Pipe in your current diff:

```bash
git diff | node src/cli.js
```

## npm and npx usage

The package exposes the `merge-guard` executable through `bin.merge-guard` and includes the CLI, scripts, examples, Action wrapper, README, changelog, and license in the package payload.

Install from a local checkout:

```bash
npm install --global .
merge-guard --help
```

Test an npm-style invocation without publishing:

```bash
npm pack --dry-run
npx --package . merge-guard --help
npx --package . merge-guard --markdown examples/sample.diff
```

Publishing is intentionally manual. Before publishing, inspect the `npm pack --dry-run` file list and follow the release checklist in `CHANGELOG.md`.

## Output modes

Plain text output is the default:

```bash
node src/cli.js examples/sample.diff
```

Markdown output is useful for pasting into pull requests:

```bash
node src/cli.js --markdown examples/sample.diff
```

JSON output includes the same risk data, including the per-file breakdown and rule explanations:

```bash
node src/cli.js --json examples/sample.diff
```

CI mode prints Markdown and exits with a failure when the report reaches the configured `failThreshold`:

```bash
node src/cli.js --ci examples/sample.diff
node src/cli.js --ci --fail-threshold 5 examples/sample.diff
```

## Pull request title and body context

PR text can be included as context without changing how risk rules score the diff.

```bash
node src/cli.js \
  --markdown \
  --pr-title "Harden save migration boundaries" \
  --pr-body notes/pr-body.md \
  change.diff
```

- `--pr-title <text>` adds the title to text, Markdown, JSON, and AI-ready output.
- `--pr-body <path>` reads the body from a UTF-8 text or Markdown file.
- PR text is explicitly labeled **context only**.
- Rule matches, risk score, readiness, and per-file findings continue to come from the diff and configuration.
- When `--ai` is used, PR context is appended to the review prompt with the same diff-authority warning.

## Risk presets

Use `--preset` to change how sensitive the scanner should be:

```bash
node src/cli.js --preset safe examples/sample.diff
node src/cli.js --preset standard examples/sample.diff
node src/cli.js --preset strict examples/sample.diff
```

Presets:

- `safe` - relaxed scoring, useful for casual projects or early exploration.
- `standard` - default scoring, balanced for normal review.
- `strict` - sharper scoring, useful for release branches or risky systems.

## Custom rules

Add a `customRules` array to `merge-guard.config.json` when a project has risky paths or line patterns that the built-in rules do not cover.

```json
{
  "preset": "standard",
  "customRules": [
    {
      "id": "payment-provider-change",
      "label": "Payment provider integration changed",
      "pathPattern": "^src/payments/",
      "linePattern": "fetch\\(|Authorization|webhook",
      "weight": 4,
      "check": "Run the payment-provider sandbox smoke and verify webhook signatures."
    }
  ]
}
```

Each rule supports:

- `id`: stable project-specific identifier.
- `label`: human-readable risk flag.
- `pathPattern`: optional case-insensitive regular expression matched against changed file paths.
- `linePattern`: optional case-insensitive regular expression matched against added lines.
- `weight`: finite numeric score adjustment.
- `check`: suggested verification command or review step.

A rule must define `pathPattern`, `linePattern`, or both. When both are present, the same changed file must match the path and contain a matching added line. Triggered custom rules appear in the normal `rules`, flags, file breakdown, and suggested-check output. Invalid rules are ignored without stopping the scan and are listed under **Custom rule warnings**.

## Project-specific suggested checks

Before formatting a report, merge-guard inspects the current repository for likely verification commands. Detection is read-only and never executes a command.

It looks for:

- `package.json` scripts named or containing `smoke`, `test`, `check`, `verify`, or `validate`;
- common supporting scripts such as `lint` and `build`;
- root files matching `smoke*.js`, `smoke*.mjs`, or `smoke*.cjs`;
- exact `npm test`, `npm run ...`, and `node smoke...` commands documented in a root README.

Detected commands appear first under **Suggested checks** and are exposed as `projectChecks` in JSON output. When no project-specific command is found, the existing generic suggested checks remain unchanged.

## Rule explanations

Every triggered rule includes explanation metadata so reviewers can see why a warning fired instead of guessing.

## Pull request comment mode

Create a Markdown report, then use the comment helper to post or update the report in a pull request discussion:

```bash
node src/cli.js --markdown pr.diff > merge-guard-report.md
node scripts/pr-comment.js --report merge-guard-report.md
```

Preview the comment body without calling GitHub:

```bash
node scripts/pr-comment.js --report merge-guard-report.md --dry-run
```

See `docs/GITHUB_ACTIONS.md` and `examples/actions-report-mode.yml` for workflow examples.

## Reusable GitHub Action

The repository root contains a composite `action.yml`. A consuming workflow must check out the pull request with enough history for a base comparison.

Minimal report-only usage:

```yaml
name: Merge Guard

on:
  pull_request:

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
```

Strict usage with a PR comment and explicit failure score:

```yaml
name: Strict Merge Guard

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
          preset: strict
          comment: "true"
          fail-threshold: "5"
```

Action inputs:

- `preset`: `safe`, `standard`, or `strict`.
- `comment`: post or update the stable merge-guard PR comment.
- `fail-threshold`: optional positive integer override.
- `diff-path`: optional path to a prebuilt diff.
- `markdown`: retained for compatibility; CI and comment reports are Markdown.

When comment mode is enabled, the workflow needs `pull-requests: write`. The Action records the scan result, posts the report, and then enforces the failure exit code so high-risk reports are not lost.

## Per-file risk scoring

Every report includes a `files` breakdown. Each changed file receives:

- `path`
- `riskLevel`
- `riskScore`
- `reason`
- added and removed line counts
- matched file-specific flags
- matched file-specific rules

The text and Markdown reports show the riskiest files first.
