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

- plain text, Markdown, and schema-versioned JSON reports
- CI-oriented output
- per-file risk scoring
- docs-only detection
- risk presets
- rule explanations
- project-defined custom rules
- non-destructive rule suppressions with expiry
- structured configuration diagnostics
- optional pull request title/body context
- repository-aware suggested checks with source/reason metadata
- npm workspace boundaries and affected-package mapping
- a versioned, validated policy-pack schema
- explicit frontend, backend, library, browser-game, and infrastructure starter policies
- protected-path and CODEOWNERS guidance that is separate from scoring and approval
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

## Compatibility checks

Merge Guard supports Node.js 18 or newer. The repository runs its smoke and CLI contract checks on Node 18, 20, 22, and 24 across Ubuntu and Windows through GitHub Actions.

The matrix checks:

- smoke and CLI contract tests
- deterministic report, suppression, and repository-intelligence snapshots
- the complete release-readiness suite
- CLI help and sample diff analysis
- JSON output
- `npm pack --dry-run`

The workflow installs with `npm install --no-package-lock`, uses the package metadata for npm cache configuration, and never publishes packages or creates releases. The current evidence is recorded in [the v0.2 compatibility matrix](docs/validation/V0.2_COMPATIBILITY_MATRIX.md).

## Release verification

Run the local contract gate before tagging or publishing:

```bash
npm run smoke
npm run test:cli
npm run test:snapshots
npm run test:repository
npm run test:policies
npm run test:guidance
npm run release:check
```

See [package and release verification](docs/package-and-action.md) for the complete checklist. These commands inspect and validate artifacts; they do not publish.

## Output modes

Plain text output is the default:

```bash
node src/cli.js examples/sample.diff
```

Markdown output is useful for pasting into pull requests:

```bash
node src/cli.js --markdown examples/sample.diff
```

JSON output includes the same risk data, including the per-file breakdown and rule explanations. Reports declare `schemaVersion: 1` and required machine-readable fields documented in [the report contract](docs/REPORT_FORMAT.md):

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
- `weight`: integer score adjustment from `0` to `10`; negative, fractional, string, non-finite, and extreme values are rejected.
- `check`: suggested verification command or review step.

A rule must define `pathPattern`, `linePattern`, or both. When both are present, the same changed file must match the path and contain a matching added line. Triggered custom rules appear in the normal `rules`, flags, file breakdown, and suggested-check output. A weight of `0` records an informational match without changing risk. Duplicate rule IDs and invalid weights are ignored without stopping the scan and are listed under **Custom rule warnings**.

See [custom rules](docs/custom-rules.md) for the authoritative field and validation contract.

## Rule suppressions

Suppressions are report annotations only: they never delete findings, change risk scores, or bypass configured failure thresholds.

Each suppression requires a rule ID, reason, owner, and expiration date:

```json
{
  "suppressions": [
    {
      "ruleId": "custom:known-legacy-path",
      "pathPattern": "^src/legacy/",
      "reason": "Tracked migration with approved follow-up.",
      "owner": "team-tools",
      "expires": "2026-12-31"
    }
  ]
}
```

Expired, malformed, duplicate, or invalid suppressions remain visible as warnings. Matching findings appear separately in `suppressedFindings`.

Expiry uses UTC calendar dates. See [rule suppressions](docs/suppressions.md) for active, expired, unmatched, and malformed behavior.

## Configuration diagnostics

Merge Guard validates `merge-guard.config.json` before scanning. Fatal errors exit non-zero; `--json` emits an `INVALID_CONFIGURATION` error payload with structured diagnostics. Non-fatal custom-rule warnings remain in `configDiagnostics` and `customRuleWarnings`.

See [configuration diagnostics](docs/configuration-diagnostics.md) for fatal fields, warning behavior, and the diagnostic schema.

## Project-specific suggested checks

Before formatting a report, merge-guard performs read-only repository inspection. It never executes a discovered command.

Detection covers:

- root npm scripts for test, smoke, check, verification, lint, typecheck, build, migration, database, and deployment work;
- root JavaScript smoke files and exact supported README commands;
- pytest, unittest, Ruff, Black, mypy, Flake8, Python build, and tox metadata;
- mixed JavaScript/Python repositories with deterministic deduplication;
- npm workspace arrays/objects, nested package roots, and common `apps/*`, `packages/*`, and `services/*` layouts;
- modified, added, deleted, and renamed diff paths mapped to the longest owning package root.

Detected commands still appear first under **Suggested checks** and remain available as the compatible `projectChecks` string array. JSON, text, and Markdown output also explain every command through `projectCheckDetails`. JSON exposes package boundaries and direct versus potential shared impact under `repository`.

Repository-level files are reported explicitly. Potential shared impact never claims a dependency relationship. When no supported project command exists, the generic suggested checks remain unchanged.

See [repository intelligence](docs/repository-intelligence.md) for the exact supported layouts, unsupported cases, report fields, and conformance fixtures.

## Policy-pack schema

Merge Guard defines a versioned reusable-policy contract for identity, compatibility, risk rules, protected paths, and required checks. Validation is read-only and does not select a pack, execute a command, or change built-in scoring defaults.

```js
import { validatePolicyPack } from './src/policyPacks.js';

const result = validatePolicyPack(policyData);
if (!result.valid) {
  console.error(result.fatal);
}
```

Schema version 1 rejects missing, malformed, legacy, future, and runtime-incompatible packs with structured fatal diagnostics. Unknown fields, missing descriptions, duplicate command strings, and empty behavior produce warnings. The machine-readable schema is `schemas/policy-pack-v1.schema.json`.

Run `npm run test:policies` for the compatibility gate. See [the policy-pack contract](docs/policy-packs.md) and [migration rules](docs/policy-pack-migrations.md). Pack selection remains explicit; validation alone never applies policy behavior.

Five starter packs are available only by explicit ID:

```bash
node src/cli.js --policy frontend examples/sample.diff
node src/cli.js --policy backend change.diff
node src/cli.js --policy library change.diff
node src/cli.js --policy browser-game change.diff
node src/cli.js --policy infrastructure change.diff
```

Selected packs add namespaced policy findings and reasoned required checks. They never execute those checks. See [starter policy packs](docs/starter-policy-packs.md) for assumptions and exact behavior.

## Protected paths and CODEOWNERS guidance

Merge Guard reports selected-policy protected-path matches and reads the first CODEOWNERS file found in `.github/`, the repository root, or `docs/`. Matching is case-sensitive and last-match wins. Unsupported negation, bracket ranges, escaped patterns, malformed lines, and invalid owners are skipped with warnings.

CODEOWNERS output is intentionally labeled as unverified guidance. Merge Guard does not assign reviewers, verify access, request reviews, read approvals, or claim that a requirement has been satisfied. The checked-out CODEOWNERS file may also differ from the pull request base branch used by GitHub.

See [protected-path and CODEOWNERS guidance](docs/review-guidance.md) for the supported syntax, limitations, report fields, and fixture gate.

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
          policy: infrastructure
          comment: "true"
          fail-threshold: "5"
```

Action inputs:

- `preset`: `safe`, `standard`, or `strict`.
- `policy`: optional explicit starter policy ID (`frontend`, `backend`, `library`, `browser-game`, or `infrastructure`).
- `comment`: post or update the stable merge-guard PR comment.
- `fail-threshold`: optional positive integer override.
- `diff-path`: optional path to a prebuilt diff.
- `markdown`: retained for compatibility; CI and comment reports are Markdown.

When comment mode is enabled, the workflow needs `pull-requests: write`. The Action records the scan result, posts the report, and then enforces the failure exit code so high-risk reports are not lost.

On `pull_request` events, the Action automatically forwards the event title and body as context. PR prose appears in reports but never changes diff-based scoring or thresholds. See [GitHub Actions and composite Action behavior](docs/GITHUB_ACTIONS.md).

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
