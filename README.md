# merge-guard

![Merge Guard — deterministic pull request risk analysis](docs/assets/merge-guard-latest-commits-cover-v4.png)

`merge-guard` is a deterministic pull-request review signal and targeted check planner. It identifies specific changed files, likely breakpoints, and the smallest useful checks a reviewer should consider.

It does not require an AI provider or API key, and it never runs discovered project commands.

[Quick start](#quick-start) · [CLI](#cli-usage) · [Configuration](#configuration) · [GitHub Action](#reusable-github-action) · [Documentation](#documentation)

> Current source: `1.3.0-beta.1` (unpublished beta). See the [release notes](docs/releases/V1.3.0-beta.1_RELEASE_NOTES.md) for scope and status.

## What it answers

Merge Guard focuses review on five questions:

1. What changed?
2. Why does it matter?
3. What might break?
4. Which checks should I run?
5. What should I verify first?

The report is decision support, not approval. Tests, human review, and repository protection rules remain authoritative.

## Quick start

Merge Guard requires Node.js 18 or newer.

### Use the GitHub Action

Create `.github/workflows/merge-guard.yml` in the repository you want to scan:

```yaml
name: Merge Guard

on:
  pull_request:

permissions:
  contents: read

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

`@main` is currently a moving pre-release reference. Pin a commit SHA for a reproducible workflow. See [GitHub Action](#reusable-github-action) for comments, thresholds, annotations, SARIF, and report comparison.

### Run the CLI from source

Clone the repository and run the bundled demo:

```bash
git clone https://github.com/keepithandy/merge-guard.git
cd merge-guard
npm run demo
node src/cli.js --doctor
```

Scan a diff file:

```bash
node src/cli.js path/to/change.diff
```

To scan a sibling project while preserving that project's configuration and repository context, run the CLI with the target repository as the current working directory:

```bash
cd ../your-project
git diff origin/main...HEAD | node ../merge-guard/src/cli.js
```

Alternatively, expose the local checkout as a global command:

```bash
cd ../merge-guard
npm install --global .
cd ../your-project
git diff | merge-guard
```

Inspect or exercise the npm package shape locally without publishing it:

```bash
cd ../merge-guard
npm pack --dry-run
npx --package . merge-guard --help
npx --package . merge-guard --markdown examples/sample.diff
```

Merge Guard reads `merge-guard.config.json`, project metadata, package boundaries, and CODEOWNERS from the current working directory.

For a checked-in, explicit description of package relationships, ownership, generated files, and repository-wide files, supply an impact-metadata file. It is read-only input and does not run project code:

```bash
node src/cli.js path/to/change.diff --impact-metadata .merge-guard/impact.json --json
```

See [impact metadata](docs/impact-metadata.md) for its versioned contract. Valid, explicitly selected metadata now produces an explainable direct, transitive, repository-wide, generated, and unknown impact graph without discovering or executing project code.

If a setup does not behave as expected, run the read-only diagnostic command before sharing any details:

```bash
node src/cli.js --doctor
node src/cli.js --doctor --json
```

It checks the runtime, package/SBOM identity, configuration, explicitly selected policy/plugin manifests, repository context, and optional local Action inputs without running project commands or uploading data. See [adoption and diagnostics](docs/adoption-and-diagnostics.md).

## Example output

The bundled `examples/sample.diff` currently produces this abridged report:

```text
merge-guard report

Risk level: LOW
Review decision: NO_CONFIGURED_BLOCKERS
Risk score: 1
Preset: standard

Summary:
- 2 file(s) changed
- 3 added line(s)
- 0 removed line(s)

Changed files:
- src/app.js
- src/app.test.js

Risk flags:
- Routing or entry-point logic changed
- Tests changed with implementation
```

The complete report also includes per-file risk, rule explanations, suggested checks and their sources, and repository impact.

## Capabilities on `main`

- Deterministic, rules-based scoring with docs-only handling, risk presets, per-file findings, and conservative review-decision labels.
- Plain-text, Markdown, compact pull-request summary, schema-versioned JSON, changed-line annotation, and SARIF 2.1.0 outputs.
- Project configuration for high-risk paths, suggested checks, custom rules, and non-destructive suppressions.
- Read-only JavaScript, Python, mixed-project, and npm-workspace inspection with affected-package mapping.
- Explicit starter policy packs, monorepo policy inheritance, protected-path guidance, and CODEOWNERS hints.
- Pull request context, stable managed comments, immutable report comparison, and a reusable composite GitHub Action.
- Optional local dashboard and advanced evidence tooling, documented separately and not required for the core review path.

## How scoring works

Merge Guard parses a unified diff and scores signals such as persistence changes, dependency or configuration changes, routing or entry-point changes, missing matching tests, configured high-risk paths, custom rules, and explicitly selected policy rules.

The default preset is `standard`:

| Preset | Review threshold | Failure threshold | Intended use |
| --- | ---: | ---: | --- |
| `safe` | 4 | 9 | Relaxed exploration |
| `standard` | 3 | 7 | General pull-request review |
| `strict` | 2 | 5 | Release branches and sensitive systems |

Scores at or above the review threshold produce `REVIEW_RECOMMENDED`. Scores at or above the failure threshold produce `CONFIGURED_BLOCKER_FOUND`; `--ci` also exits with status 1 at that threshold. A lower score produces `NO_CONFIGURED_BLOCKERS`, which means no configured threshold was reached—not that the change is proven safe. The legacy `mergeReadiness` field remains in JSON reports for schema-v1 compatibility.

## Configuration

Merge Guard works without configuration. When `merge-guard.config.json` exists in the current working directory, the CLI loads it automatically.

```json
{
  "preset": "standard",
  "highRiskPaths": [
    "src/auth",
    "src/payments"
  ],
  "testCommands": [
    "npm test",
    "npm run smoke"
  ],
  "failThreshold": 7
}
```

| Field | Behavior |
| --- | --- |
| `preset` | Selects `safe`, `standard`, or `strict`. The CLI `--preset` option overrides it. |
| `highRiskPaths` | Adds risk when a changed path starts with one of the configured values. |
| `testCommands` | Adds project-specific commands to suggested checks. Merge Guard reports them but never executes them. |
| `failThreshold` | Sets the positive-integer high-risk and CI failure threshold. `--fail-threshold` overrides it. |
| `customRules` | Adds validated path and/or added-line rules with weights from 0 through 10. |
| `suppressions` | Annotates matching findings with owner, reason, and UTC expiry metadata without changing scores or thresholds. |

Start with [`examples/merge-guard.config.example.json`](examples/merge-guard.config.example.json). Invalid core fields stop the scan with structured diagnostics. Invalid custom rules and suppressions are ignored for scoring and reported as warnings.

### Custom rules

Add `customRules` when a project has risky paths or added-line patterns that the built-in scanner does not cover:

```json
{
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

A custom rule must define `pathPattern`, `linePattern`, or both. If both are present, the same changed file must match the path and contain a matching added line. A weight of `0` records an informational match without increasing risk.

Repository-controlled patterns use a bounded, safe regular-expression subset. Expressions with backreferences, lookarounds, or unsafe repetition are rejected before matching so a configuration change cannot stall CI through catastrophic backtracking.

Advanced configuration:

- [Custom rules](docs/custom-rules.md)
- [Rule suppressions](docs/suppressions.md)
- [Configuration diagnostics](docs/configuration-diagnostics.md)
- [Policy inheritance and expiring exceptions](docs/policy-inheritance.md)

## CLI usage

The CLI accepts a unified-diff file or stdin:

```bash
merge-guard change.diff
git diff | merge-guard
merge-guard --help
merge-guard --doctor
```

When running from a source checkout, replace `merge-guard` with `node src/cli.js`.

### Output modes

```bash
merge-guard --markdown change.diff
merge-guard --json change.diff
merge-guard --pr-summary change.diff
merge-guard --annotations change.diff > merge-guard-annotations.json
merge-guard --sarif change.diff > merge-guard.sarif
```

`--json`, `--markdown`, `--pr-summary`, `--annotations`, and `--sarif` are mutually exclusive stdout modes. Use `--report-json` to preserve the complete schema-version 1 report alongside any projection:

```bash
merge-guard --pr-summary --report-json merge-guard-report.json change.diff
```

With no explicit stdout projection, CI mode prints Markdown. It always appends a compact summary to `GITHUB_STEP_SUMMARY` when available and enforces the resolved failure threshold:

```bash
merge-guard --ci --preset strict --fail-threshold 5 change.diff
```

`--ai` adds local AI-review data to the report. JSON includes the generated prompt package; text and Markdown show the derived summary and possible breakpoints. It makes no model or network call and requires no API key:

```bash
merge-guard --json --ai change.diff > merge-guard-ai-review.json
```

### Other options

| Option | Purpose |
| --- | --- |
| `--preset <name>` | Select `safe`, `standard`, or `strict`. |
| `--fail-threshold <score>` | Override the high-risk and CI failure threshold with a positive integer. |
| `--pr-title <text>` | Add a pull request title as context. |
| `--pr-body <path>` | Read pull request body context from a UTF-8 text or Markdown file. |
| `--policy <id>` | Explicitly apply `frontend`, `backend`, `library`, `browser-game`, or `infrastructure`. |
| `--doctor` | Inspect local setup without requiring or analyzing a diff. Use `--doctor --json` for structured diagnostics. |
| `--plugin-manifest <path>` | Select an explicit local plugin manifest for doctor validation. |
| `--action-inputs <path>` | Select a secret-free JSON Action-input object for doctor validation. |
| `--policy-config <path>` | Apply an explicit root/package policy manifest. It cannot be combined with `--policy`. |
| `--report-json <path>` | Write the complete JSON report in addition to stdout. |
| `--help`, `-h` | Show the current command contract. |

Pull request title and body are context only. They appear in reports and optional AI-ready output but never change rules, risk scores, review decisions, or failure thresholds.

## Targeted checks

Before formatting a report, Merge Guard inspects the current repository without executing anything. It keeps the complete detected command inventory in JSON, but human-facing output selects at most three primary checks from:

- root npm scripts, supported root smoke files, and exact README commands;
- pytest, unittest, Ruff, Black, mypy, Flake8, Python build, and tox metadata;
- mixed JavaScript/Python projects with deterministic deduplication;
- npm workspace arrays or objects, nested packages, and common `apps/*`, `packages/*`, and `services/*` layouts.

Changed paths are mapped to the longest owning package root. Repository-level changes and potential shared impact are labeled explicitly; Merge Guard does not infer dependency relationships.

See [repository intelligence](docs/repository-intelligence.md) for the supported layouts and report fields. Use `npm test` in this repository to run the complete local contract suite; the individual `test:*` scripts remain compatibility entry points for maintainers.

## Advanced: policy packs and review guidance

### Policy-pack schema

Merge Guard validates reusable policies against the versioned [`policy-pack-v1` schema](schemas/policy-pack-v1.schema.json). Validation checks identity, compatibility, rules, protected paths, and required checks; it does not select or apply a pack. Pack selection is always explicit.

### Starter policies

Starter policies are opt-in. No policy is selected by default:

```bash
merge-guard --policy frontend change.diff
merge-guard --policy infrastructure change.diff
```

The five bundled packs are `frontend`, `backend`, `library`, `browser-game`, and `infrastructure`. Selected packs add namespaced findings and reasoned required checks; they never execute a command.

The explicit `browser-game` pack also surfaces literal storage-key and save-version changes, migration evidence, and an old-save compatibility check in the focused reviewer plan. It does not inspect browser data or claim a migration is correct.

For monorepos, `--policy-config merge-guard.policies.json` resolves explicit root and package policy scopes. Expiring exceptions are annotations only: they do not remove findings or checks, change scores, bypass thresholds, or imply approval.

### Expiring policy exceptions

Every exception needs a narrow path expression, reason, owner, real UTC expiry date, and an existing rule, protected-path, or required-check target. Blanket, expired, and malformed exceptions are rejected.

Protected-path matches and CODEOWNERS results are also guidance only. Merge Guard does not assign reviewers, verify repository access, read approvals, or claim that an ownership requirement has been satisfied.

See [starter policy packs](docs/starter-policy-packs.md), [policy inheritance](docs/policy-inheritance.md), and [protected-path/CODEOWNERS guidance](docs/review-guidance.md).

## Reusable GitHub Action

The root [`action.yml`](action.yml) wraps the same CLI. When it builds the pull-request diff, the consuming checkout needs full history (`fetch-depth: 0`). Supplying `diff-path` makes the caller responsible for the diff and removes that requirement from Merge Guard itself.

Enable a stable managed pull-request comment and a strict threshold like this:

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

Live comments require `pull-requests: write`. Report-only mode does not. To render a comment without writing to GitHub, set both `comment: "true"` and `comment-dry-run: "true"`; that dry-run combination does not need write permission.

### Inputs

| Input | Default | Purpose |
| --- | --- | --- |
| `preset` | `standard` | Risk preset. |
| `policy` | empty | Explicit starter policy ID. |
| `policy-config` | empty | Repository-relative policy manifest; conflicts with `policy`. |
| `comment` | `false` | Post or update the managed pull-request comment. |
| `comment-dry-run` | `false` | With `comment: "true"`, render comment mode without a GitHub write. |
| `fail-threshold` | empty | Positive-integer override. |
| `annotations` | `false` | Emit eligible deduplicated changed-line workflow annotations. |
| `sarif` | `false` | Generate `merge-guard.sarif`; it is not uploaded automatically. |
| `compare` | `false` | Compare the current report with an explicitly supplied prior report. |
| `previous-report` | empty | Optional immutable prior JSON report. If omitted while comparison is enabled, history is reported as unavailable. |
| `previous-manifest` | empty | Optional artifact manifest bound to `previous-report`; enables strict v1.3 verification. |
| `expected-previous-repository` | empty | Optional repository identity asserted for prior evidence. |
| `expected-previous-branch` | empty | Optional branch identity asserted for prior evidence. |
| `expected-previous-commit` | empty | Optional commit identity asserted for prior evidence. |
| `diff-path` | empty | Path to a caller-created diff. |
| `markdown` | `true` | Compatibility input; CI and comment reports remain Markdown. |

### Outputs

| Output | Meaning |
| --- | --- |
| `report-path` | Complete JSON report generated from the authoritative diff. |
| `manifest-path` | Immutable artifact manifest bound to the generated JSON report. |
| `annotations-path` | Annotation bundle path when annotations are enabled. |
| `sarif-path` | SARIF file path when SARIF generation is enabled. |
| `comparison-path` | Finding-comparison JSON path when comparison is enabled. |
| `comparison-status` | `compared`, `history-unavailable`, or `report-unavailable`; empty when comparison is disabled. |
| `prior-evidence-status` | Strict prior-evidence status; empty for report-only comparison. |
| `projection-path` | Versioned machine-readable status for every review-output channel. |
| `projection-status` | `complete`, `degraded`, `failed`, or `incomplete`. |

The Action generates the report and optional projections before enforcing the scan exit code, so evidence remains available when the threshold fails. It can generate annotations and SARIF together, even though their direct CLI stdout flags are mutually exclusive.

Every run also produces a review-projection document covering the report, manifest, managed comment, annotations, SARIF, comparison, and threshold result. Missing comment permissions degrade publication without erasing valid local evidence. Canceled attempts make no completeness claim; a rerun reconstructs projection state from immutable inputs.

On `pull_request` events, the Action forwards the event title and body as context only. Comparison is also explicit: Merge Guard never searches workflow history or downloads a previous artifact. Missing previous history is reported as unknown, not clean.

See [GitHub Actions behavior](docs/GITHUB_ACTIONS.md), the [caller-owned evidence handoff example](docs/examples/github-actions-explicit-evidence-handoff.yml), [pull-request summaries](docs/pull-request-summaries.md), [GitHub annotations and SARIF](docs/github-review-outputs.md), and [finding comparison](docs/finding-comparisons.md).

## Advanced: finding comparison

From the Merge Guard source checkout, compare two immutable schema-version 1 reports from successive pushes:

```bash
node scripts/compare-reports.js \
  --previous previous-report.json \
  --previous-manifest previous-report.manifest.json \
  --expected-repository owner/repository \
  --expected-branch main \
  --expected-commit abc123 \
  --current current-report.json \
  --output merge-guard-comparison.json \
  --markdown
```

Findings are classified as new, unchanged, or resolved using stable identities. Comparison does not change either report, scoring, review decisions, or the scanner's threshold/CI outcome. If `--previous` is omitted, the comparison helper emits `history-unavailable` and exits with status 2.

## Safety boundaries

The core path is the CLI plus the reusable Action. Dashboard, plugin, provenance, and trend features are optional advanced subsystems; they are not required to get a useful review signal.

- Merge Guard analyzes diffs; it does not replace tests, reviewers, branch protection, or deployment controls.
- Discovered and configured commands are suggestions only and are never executed.
- PR prose is context only; the diff and explicit configuration remain authoritative.
- Suppressions and policy exceptions annotate evidence but never lower scores or bypass thresholds.
- CODEOWNERS and protected paths provide unverified guidance, not proof of approval.
- SARIF generation is local; upload and code-scanning permissions remain the caller's responsibility.
- The local dashboard accepts selected `.diff`, `.patch`, and Merge Guard v1 `.json` report files through a browser file picker or drag-and-drop. It validates them in a dedicated worker, keeps them in memory, and serves only bundled assets from loopback; it does not upload, persist, or execute anything.
- Imported reports are displayed as read-only risk-ranked file and rule evidence with suggested checks, warnings, and suppressions. Checklist state is local UI state and never changes report scores or review decisions.

The dashboard boundary is documented in [the architecture overview](docs/architecture/dashboard-architecture.md).

## Development and verification

Use the small public command surface first:

```bash
npm test
npm run smoke
npm run demo
npm run eval:historical-prs -- --corpus ./corpus --mode validate
npm run release:check
```

`npm test` runs the complete local contract suite. `npm run release:check` adds package/runtime/SBOM consistency, installation, security, performance, public-contract, artifact, distribution, and support gates. Neither command publishes packages, creates tags, signs artifacts, or creates releases. See [historical-PR evaluation](docs/historical-pr-evaluation.md) for calibration, preregistration, held-out commands, and their local-only privacy boundary.

After committing a reviewed candidate, `npm run release:stage -- release/v1.3.0-beta.1` creates a detached, two-build, checksum-bound evidence packet without publishing. The compatibility workflow runs the contract suite on Node.js 18, 20, 22, and 24 across Ubuntu and Windows; a configured matrix is not evidence that a particular candidate passed. See the [live Node matrix](.github/workflows/node-lts.yml) and [v1.3.0-beta.1 decision packet](docs/releases/V1.3.0-beta.1_RELEASE_DECISION.md).

## Documentation

| Topic | Reference |
| --- | --- |
| Project direction | [Post-v1 roadmap](ROADMAP.md) |
| Current source | [Beta release notes](docs/releases/V1.3.0-beta.1_RELEASE_NOTES.md) |
| Version policy | [Versioning](docs/versioning.md) |
| Installation and diagnostics | [Supported journeys and doctor](docs/adoption-and-diagnostics.md) |
| Report contract | [Report format](docs/REPORT_FORMAT.md) |
| Composite Action | [GitHub Actions](docs/GITHUB_ACTIONS.md) |
| Targeted checks | [Repository intelligence](docs/repository-intelligence.md) |
| Custom rules | [Custom rules](docs/custom-rules.md) |
| Policies and ownership | [Policy-pack contract](docs/policy-packs.md) |
| Browser-game saves | [Save compatibility evidence](docs/browser-game-save-compatibility.md) |
| PR summaries | [Pull-request summaries](docs/pull-request-summaries.md) |
| Beta evaluation | [Historical-PR evaluation](docs/historical-pr-evaluation.md) |
| Pilot corpus intake | [Local intake and labeling guide](docs/pilot-corpus-intake.md) |
| Security | [Security baseline](docs/security/threat-model.md) |
| Release history | [Changelog](CHANGELOG.md) |
| Contributing | [Contributing guide](CONTRIBUTING.md) |
| License | [MIT License](LICENSE) |

Advanced implementation references for the local dashboard, durable evidence, report trends, and plugins remain under `docs/`; they are optional and are not part of the core adoption path.
