# Changelog

All notable Merge Guard changes are recorded here. Dates record when source work was consolidated; they do not imply publication. No npm package, GitHub release, or release tag has been created by this history.

## Unreleased

No changes are recorded beyond the current `1.1.0` source version.

## 1.1.0 - 2026-08-27 (unpublished source version)

Status: current source identity only. Signing, tag creation, npm publication, GitHub release creation, Action-reference changes, and Marketplace publication remain separately owner-controlled.

### Added

- Read-only `merge-guard --doctor` diagnostics in stable text and JSON forms for Node runtime, package/SBOM identity, local configuration, selected policy and plugin manifests, current-directory repository context, bundled Action inputs, and caller-supplied Action input files.
- Actionable doctor next steps, deterministic check ordering, output redaction, and strict rejection of incompatible output modes, diff arguments, unsupported Action input names, and parent-directory Action paths.
- Supported journey matrix for source checkout, local archive, future npm, GitHub Action, local dashboard, policy, and plugin adoption with failure recovery and rollback guidance.
- Public, metadata-only consumer fixtures for standalone Node, npm workspace, Python, mixed project, forked pull request, and restricted-permission Action paths.
- Privacy-safe adoption and doctor issue templates plus no-telemetry troubleshooting guidance.
- Versioning policy, complete version ledger, current v1.1.0 release-note and decision templates, and automated verification of current identity versus preserved history.

### Fixed

- Rejected unsafe repository-controlled regular expressions in custom rules, suppressions, policy packs, and policy exceptions before matching.
- Made release staging derive its owner-packet title from the package version instead of a hard-coded release number.

### Compatibility and verification

- Requires Node.js 18 or newer; the v1 compatibility range remains Node 18, 20, 22, and 24 on Ubuntu and Windows.
- JSON report schema remains version 1; doctor exposes a separate additive diagnostic schema version 1.
- Starter policies and the reference plugin remain compatible with Merge Guard `>=1.0.0 <2.0.0`.

## 1.0.0 - 2026-08-25 through 2026-08-27 (prepared candidate, unpublished)

Status: historical prepared candidate. The repaired candidate source and its checksum-bound evidence remain recorded, but no external release action was approved or performed.

### Added

- Repository intelligence for npm workspaces, Node, Python, and mixed repositories; affected-package mapping; explicit source explanations; and deterministic repository contract snapshots.
- Versioned policy-pack schema, five explicit starter policy packs, protected-path and CODEOWNERS guidance, root/package policy inheritance, and expiring annotation-only policy exceptions.
- Compact pull-request summaries, changed-line GitHub annotations, optional SARIF generation without upload, stable finding identity, immutable prior-report comparison, and two-push review fixtures.
- Bounded local dashboard architecture, import, risk explorer, accessibility, export, and no-network/no-persistence contract coverage.
- Immutable artifact manifests, accepted legacy-risk compatibility, report trends/retention rules, plugin manifests, worker isolation, plugin attestations, and a plugin conformance kit.
- Installation, security/provenance, performance/soak, release-candidate, public-contract, artifact, distribution, support, package, SBOM, reproducibility, and Node/OS release gates.
- Non-publishing release staging, checksum manifests, provenance records, owner decision packets, and documented publication, abort, rollback, revocation, and support handoff procedures.

### Fixed

- Corrected stale runtime, policy, plugin, report, documentation, package, and SBOM `0.1.0` identifiers in the v1 candidate path.
- Made package rebuild evidence byte-identical from a detached checkout and kept staged artifacts out of the packed package.
- Rejected unsafe regular expressions before matching and made installation/release checks portable on Windows.

### Compatibility

- Requires Node.js 18 or newer and preserves the v1 CLI, report, policy, plugin, artifact, and Action contracts.
- JSON report schema remains version 1; Action and CLI usage remain local-first and do not execute discovered project commands.

## 0.2.0 - 2026-08-24 (historical candidate, unpublished)

Status: historical stabilization candidate. Package publication was not authorized; the package metadata remained `0.1.0` at the time.

### Added

- Reusable composite GitHub Action with report, threshold, and stable pull-request-comment modes.
- Safe, bounded project-defined custom rules; pull-request title/body context; repository-aware suggested checks; and expiring non-destructive suppressions.
- Structured configuration diagnostics, schema-versioned JSON reports, deterministic report/suppression snapshots, CLI contracts, release readiness, package checks, and Node/OS compatibility coverage.

### Fixed

- Restored valid Action metadata and CLI configuration handling.
- Made no-context CLI execution safe, normalized CRLF diff and custom-rule parsing, and made package dry runs portable on Windows.

### Compatibility

- Requires Node.js 18 or newer; Node 18, 20, 22, and 24 on Ubuntu and Windows passed the candidate matrix.
- No intentional built-in scoring or preset-threshold change was introduced during stabilization.

## 0.1.0 - 2026-07-06 (historical development baseline, unpublished)

### Added

- Rules-based diff scanner with plain-text, Markdown, and JSON reports.
- CI mode and GitHub pull-request comment workflow support.
- Documentation-only change detection, per-file risk breakdowns, safe/standard/strict presets, rule explanations, configurable high-risk paths, and configurable suggested test commands.
- Optional local AI-ready review-summary prompt output without an AI provider or API key.

## Release checklist

Before staging a candidate:

- run `npm run smoke`;
- run `npm run test:cli`, `npm run test:snapshots`, `npm run test:repository`, `npm run test:policies`, `npm run test:guidance`, and `npm run test:policy-resolution`;
- run `npm run test:pr-summary`, `npm run test:github-review`, `npm run test:finding-comparison`, and `npm run test:review-e2e`;
- run dashboard, artifact, legacy-risk, report-trend, plugin, installation, security, performance, public-contract, distribution, support, and version gates;
- run `npm run test:doctor`, `npm run test:consumer-fixtures`, and `npm run release:check`;
- verify CLI text, Markdown, JSON, package dry-run, documentation, and current version history;
- stage to a new `release/v<package-version>` path from an immutable reviewed commit;
- do not publish automatically from a passing issue, pull request, or validation command.
