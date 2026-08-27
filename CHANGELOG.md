# Changelog

## Unreleased

- Reject unsafe repository-controlled regular expressions in custom rules, suppressions, policy packs, and policy exceptions before matching.

## 1.0.0 - 2026-08-25

Release decision: `docs/releases/V0.2.0_RELEASE_DECISION.md`.

### Added

- Reusable composite GitHub Action with report-only, threshold, and stable PR-comment modes.
- Project-defined custom rules with path and added-line expressions.
- Optional PR title/body context while keeping diff scoring authoritative.
- Repository-aware suggested-check detection.
- Expiring, non-destructive rule suppressions.
- Structured configuration diagnostics.
- Schema-versioned JSON reports and deterministic contract snapshots.
- Node 18/20/22/24 compatibility coverage on Ubuntu and Windows.
- Repository-intelligence layouts, command explanations, and affected-package mapping.
- Versioned policy-pack validation contract and machine-readable schema.
- Explicit frontend, backend, library, browser-game, and infrastructure starter policy packs.
- Guidance-only protected-path and CODEOWNERS matching with safe parser warnings.
- Deterministic root/package policy inheritance with provenance and expiring annotation-only exceptions.
- Versioned compact pull-request summaries with risk-first files and expandable deterministic detail.
- Deduplicated changed-line workflow annotations and optional fingerprinted SARIF 2.1.0 generation.
- Versioned stable finding identity and immutable report comparison with explicit missing-history semantics.
- End-to-end two-push GitHub review fixtures covering report/comment modes, annotations, SARIF, comparison, managed-comment updates, and threshold exits.
- Versioned local dashboard architecture, accepted ADR, threat model, bounded input contract, and no-network/no-persistence conformance gate.

### Changed

- Bounded custom-rule weights to integer values from 0 through 10.
- Rejected duplicate and malformed custom rules safely with warnings.
- Expanded release readiness to smoke, CLI, snapshot, package, and Action contracts.
- Reconciled README and supporting docs with the consolidated implementation.

### Fixed

- Restored valid composite Action metadata.
- Restored the CLI configuration-diagnostics integration.
- Made no-context CLI use safe.
- Made diff and custom-rule parsing consistent for LF and CRLF input.
- Made the release-readiness package dry run portable on Windows.
- Corrected the Action threshold fixture to exercise a scored diff.

### Compatibility

- Requires Node.js 18 or newer.
- Preserves built-in scoring intent and preset thresholds.
- Public CLI, JSON report, policy, plugin, artifact, and Action contracts are frozen for v1.0.
- Release publication remains manually owner-gated.

## 0.1.0 - MVP CLI foundation

Initial usable merge-guard MVP.

Included features:

- rules-based diff scanner
- plain text reports
- Markdown reports
- JSON reports
- CI mode
- GitHub PR comment workflow support
- docs-only change detection
- per-file risk breakdown
- risk presets: safe, standard, strict
- rule explanations
- configurable high-risk paths
- configurable test commands
- optional AI-ready review summary prompt output

## Release checklist

Before cutting a release:

- run `npm run smoke`
- run `npm run test:cli`
- run `npm run test:snapshots`
- run `npm run test:repository`
- run `npm run test:policies`
- run `npm run test:guidance`
- run `npm run test:policy-resolution`
- run `npm run test:pr-summary`
- run `npm run test:github-review`
- run `npm run test:finding-comparison`
- run `npm run test:review-e2e`
- run `npm run test:dashboard-architecture`
- run `npm run release:check`
- run `npm run demo`
- verify `node src/cli.js --markdown examples/sample.diff`
- verify `node src/cli.js --json examples/sample.diff`
- confirm README usage still matches CLI behavior
- update this changelog
- do not publish automatically from an issue pass
