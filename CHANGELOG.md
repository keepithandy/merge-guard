# Changelog

Merge Guard release notes are kept intentionally user-facing. This history focuses on features, visible improvements, and hotfixes that matter when using the CLI, GitHub Action, reports, or local dashboard.

Internal refactors, test-suite expansion, release engineering, and maintenance-only changes are omitted.

> **Release status:** some historical versions below were source or prerelease milestones and were not published to npm.

## Unreleased

### Features

- **Human Verification in the local dashboard.** Record Untested, Pass, Fail, or N/A results against a report, add your own checks, capture runtime defects, include optional environment details, and export the evidence as Markdown or JSON.
- **Safer policy review for pull requests.** Merge Guard can verify the policy baseline from the exact base commit so policy changes made inside the same pull request do not silently redefine the rules being used to review that pull request.
- **Clearer pull-request decisions.** Review output now emphasizes a small set of primary checks and provides a conservative review-decision label so the important result is easier to find.
- **Explainable repository impact.** Projects can opt in to checked-in impact metadata that describes package roots, dependencies, ownership paths, generated paths, and repository-wide paths. Merge Guard uses that information to explain direct, transitive, generated, repository-wide, and unknown impact instead of pretending to infer a dependency graph.
- **Verified previous-report comparison.** Prior reports can be checked against their artifacts and repository context before comparison, helping distinguish valid previous evidence from stale, incompatible, cross-branch, or unverifiable evidence.
- **CI evidence handoff.** GitHub Action users can carry explicitly supplied review evidence between runs while keeping the handoff caller-controlled and read-only.
- **Browser-game save compatibility checks.** Opt-in checks can flag literal storage-key changes, save-version changes, and missing migration evidence when reviewing changes that may affect existing saves.

### Improvements

- Human Verification keeps automated analysis separate from human-observed runtime evidence, making it clearer which conclusions came from Merge Guard and which came from manual testing.
- Text, Markdown, and pull-request summaries are shorter by default and prioritize the three most important checks before optional detail.
- Routing, persistence, async, and network signals are more selective, reducing noisy matches from fixtures, data files, and unrelated text.

### Hotfixes

- A human **Pass** from an older report is no longer carried onto a changed/current report.
- Resolved findings remain comparison history instead of being incorrectly treated as a new manual Pass.

## 1.3.0-beta.2 - 2026-09-07

### Features

- Added `merge-guard --version` so the installed Merge Guard version can be checked without supplying a diff.

### Hotfixes

- Unknown command-line options continue to fail validation instead of being silently accepted.

## 1.3.0-beta.1 - 2026-08-29 (unpublished beta source version)

### Features

- Added richer repository-impact evidence for complex changes such as renames, copies, generated files, binary files, submodules, oversized files, and partial-history diffs.
- Expanded durable review evidence so repeated reviews and prior-result comparisons can carry more useful context without changing the established risk-scoring model.

### Improvements

- Repository-impact reporting became more explicit about what Merge Guard knows, what was declared by the repository, and what remains unknown.

## 1.1.0 - 2026-08-27 (unpublished source version)

### Features

- Added `merge-guard --doctor` with text and JSON output for diagnosing Node runtime, package identity, local configuration, policy/plugin manifests, repository context, and GitHub Action inputs.
- Doctor output now provides actionable next steps when setup or configuration is incomplete.
- Added supported setup guidance for source checkout, local archives, GitHub Actions, the local dashboard, policies, and plugins.

### Hotfixes

- Unsafe repository-controlled regular expressions in custom rules, suppressions, policy packs, and policy exceptions are rejected before matching.

## 1.0.0 - 2026-08-25 through 2026-08-27 (prepared candidate, unpublished)

### Features

- Added repository intelligence for npm workspaces, Node, Python, and mixed repositories, including affected-package mapping and explanations for why an area is considered impacted.
- Added versioned policy packs with starter policies, protected-path guidance, CODEOWNERS-aware review guidance, inherited policy configuration, and expiring annotation-only exceptions.
- Added compact pull-request summaries, changed-line GitHub annotations, optional SARIF output, stable finding identities, and previous-report comparison.
- Added the local dashboard for importing reports, exploring risk, comparing results, and exporting review evidence without requiring a hosted service.
- Added report trends, artifact manifests, plugin manifests, plugin isolation, and plugin compatibility checks for teams extending Merge Guard locally.

### Hotfixes

- Unsafe regular expressions are rejected before they can be evaluated.
- Windows users no longer hit the earlier portability problems in installation and release-validation paths.
- Version identifiers shown by the v1 candidate were corrected so reports and package metadata no longer referenced the old `0.1.0` identity.

## 0.2.0 - 2026-08-24 (historical candidate, unpublished)

### Features

- Added a reusable composite GitHub Action with report output, threshold checks, and pull-request comment support.
- Added bounded project-defined custom rules.
- Added pull-request title/body context, repository-aware suggested checks, and expiring non-destructive suppressions.
- Added structured configuration diagnostics and schema-versioned JSON reports.

### Hotfixes

- Fixed invalid GitHub Action metadata and CLI configuration handling.
- Running the CLI without repository context is now handled safely.
- Fixed CRLF diff parsing and custom-rule parsing edge cases.
- Fixed Windows package dry-run portability issues.

## 0.1.0 - 2026-07-06 (historical development baseline, unpublished)

### Features

- Introduced the rules-based diff scanner with plain-text, Markdown, and JSON reports.
- Added CI mode and GitHub pull-request comment support.
- Added documentation-only change detection, per-file risk breakdowns, safe/standard/strict presets, rule explanations, configurable high-risk paths, and suggested test commands.
- Added optional local AI-ready review-summary prompt output without requiring an AI provider or API key.

<!-- Maintainer contract: npm run release:check -->
