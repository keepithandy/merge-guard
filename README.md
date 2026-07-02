# merge-guard

**AI-powered pull request risk scanner for safer merges.**

`merge-guard` is a lightweight developer tool that reviews code changes before they are merged. It scans git diffs, commits, or pull requests and creates a plain-English safety report showing what changed, what might break, which files look risky, and what tests should be run before merging.

The goal is simple: **protect the main branch before you hit merge.**

## What it answers

`merge-guard` focuses on five questions:

1. What changed?
2. Why does it matter?
3. What might break?
4. What tests should I run?
5. Is this safe to merge?

It does not replace human review. It gives developers a second set of eyes before shipping.

## Current version

This version is a rules-based CLI scanner with optional Markdown, CI, per-file risk, docs-only detection, AI-ready review summaries, and GitHub pull request comment updates. It can inspect a diff and produce a merge-readiness report without requiring an AI API key.

Future versions can add richer provider-backed AI summaries, rule presets, and a simple web dashboard.

## Example output

```txt
merge-guard report

Risk level: MEDIUM
Merge readiness: NEEDS_REVIEW
Risk score: 4

Summary:
- 4 file(s) changed
- 86 added line(s)
- 22 removed line(s)

Per-file risk:
- MEDIUM src/saveState.js - State or persistence logic changed
- MEDIUM package.json - Dependency or config file changed
- LOW README.md - Documentation/comment-only change

Risk flags:
- State or persistence logic changed
- Config file changed
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

## Output modes

Plain text output is the default:

```bash
node src/cli.js examples/sample.diff
```

Markdown output is useful for pasting into pull requests:

```bash
node src/cli.js --markdown examples/sample.diff
```

JSON output includes the same risk data, including the per-file breakdown:

```bash
node src/cli.js --json examples/sample.diff
```

CI mode prints Markdown, writes to the GitHub Actions step summary when available, and exits with a failure when the report reaches the configured `failThreshold`:

```bash
node src/cli.js --ci examples/sample.diff
```

Optional AI-ready summary mode adds a structured review summary and adapted prompt package on top of the rules-based scanner:

```bash
node src/cli.js --ai --markdown examples/sample.diff
```

Normal CLI mode does not require an API key. The optional AI section organizes the scanner findings and provides a prompt package for a future AI reviewer; it does not prove a change is safe and does not replace human review.

## Pull request comment mode

Create a Markdown report and post it back to the pull request:

```bash
node src/cli.js --markdown pr.diff > merge-guard-report.md
node scripts/pr-comment.js --report merge-guard-report.md
```

The comment script adds a hidden marker to the comment. When the workflow runs again, it updates the existing merge-guard comment instead of creating duplicates.

Preview the comment body without calling GitHub:

```bash
node scripts/pr-comment.js --report merge-guard-report.md --dry-run
```

In GitHub Actions, the workflow needs read access to contents and write access to pull request or issue comments. See `docs/GITHUB_ACTIONS.md` and `examples/actions-report-mode.yml`.

## Per-file risk scoring

Every report includes a `files` breakdown. Each changed file receives:

- `path`
- `riskLevel`
- `riskScore`
- `reason`
- added and removed line counts
- matched file-specific flags

The text and Markdown reports show the riskiest files first. File risk comes from the same rules used by the overall scan:

- save, state, storage, persistence, migration, ledger, and cache paths are higher risk
- dependency and config files are moderate risk
- routing, app entry, async, network, service worker, and API files receive extra attention
- configured `highRiskPaths` increase file risk
- test changes lower risk when implementation changed with tests
- docs, examples, Markdown, and comment-only diffs are treated as low risk unless a configured high-risk signal is present

## Docs-only detection

If a diff only touches docs, Markdown, examples, or comment-only changes, `merge-guard` marks the report as docs-only and normally returns `LOW` risk.

Docs-only reports include the flag:

```txt
Docs-only change detected
```

The sample diff at `examples/docs-only.diff` demonstrates this path.

## GitHub Actions

See `docs/GITHUB_ACTIONS.md` and `examples/actions-report-mode.yml` for a copyable workflow.

Minimal CI usage:

```bash
node src/cli.js --ci pr.diff
```

This mode works without an AI provider.

## Configuration

`merge-guard` works without configuration. If a `merge-guard.config.json` file exists in the current directory, the CLI reads it automatically.

Example:

```json
{
  "highRiskPaths": ["src/save", "src/auth", "src/payments"],
  "testCommands": ["npm test", "npm run smoke"],
  "failThreshold": 7
}
```

Config fields:

- `highRiskPaths` marks matching changed files as extra risky. A path matches when the changed file starts with one of these values.
- `testCommands` adds project-specific checks to the suggested checks list.
- `failThreshold` controls when the report becomes `HIGH` risk and `DO_NOT_MERGE_YET`. The default is `7`.

A starter config is available at `examples/merge-guard.config.example.json`.

## Sample diffs

The `examples/` folder includes a few ready-made diff shapes for testing the scanner:

- `examples/sample.diff` - default demo diff used by `npm run demo`
- `examples/docs-only.diff` - low-risk documentation-only change
- `examples/app-entry-change.diff` - medium-risk app startup change
- `examples/state-persistence-change.diff` - save/load and persistence-style change
- `examples/config-dependency-change.diff` - config and dependency-style change
- `examples/large-multifile-change.diff` - larger multi-file change touching app, save, config, and docs
- `examples/actions-report-mode.yml` - copyable GitHub Actions report/comment workflow

Run any example directly:

```bash
node src/cli.js examples/docs-only.diff
node src/cli.js examples/state-persistence-change.diff
node src/cli.js examples/large-multifile-change.diff
```

## Commands

```bash
npm run demo
npm run smoke
npm run check
npm run comment -- --report merge-guard-report.md
```

## Merge readiness labels

`SAFE_TO_MERGE` means the diff looks low-risk.

`NEEDS_REVIEW` means the diff has moderate risk or needs more attention.

`DO_NOT_MERGE_YET` means the diff has high-risk signals and should be reviewed before merging.

## Project vision

The bigger version of `merge-guard` should:

- Read local diffs
- Review pull requests
- Produce clear risk reports
- Suggest targeted smoke tests
- Comment on GitHub PRs
- Learn project-specific review rules
- Generate release notes from merged changes

## One-line pitch

**merge-guard scans code changes before merge and tells you what changed, what might break, and what to test next.**
