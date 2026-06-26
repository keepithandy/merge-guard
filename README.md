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

This first version is a rules-based CLI scanner. It can inspect a diff and produce a basic merge-readiness report without requiring an AI API key.

Future versions can add AI summaries, GitHub pull request comments, GitHub Actions support, and a simple web dashboard.

## Example output

```txt
merge-guard report

Risk level: MEDIUM
Merge readiness: NEEDS_REVIEW

Summary:
- 4 files changed
- 86 added lines
- 22 removed lines

Risk flags:
- State or persistence logic changed
- Config file changed
- Test coverage was not changed in this diff

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