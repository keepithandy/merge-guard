# Versioning and history

## Current source version

| Identity | Value |
| --- | --- |
| Current source version | `1.1.0` |
| Runtime report version | `1.1.0` |
| Package and SBOM version | `1.1.0` |
| Report schema version | `1` |
| Publication state | Unpublished; no tag, npm package, GitHub release, Action-reference move, or Marketplace listing is authorized by this source version |

The current source version is verified by `npm run test:version`. The contract checks package metadata, the shared runtime constant, sample report output, SBOM metadata and purl, starter-policy/plugin compatibility, current-version documentation, release-note templates, historical changelog sections, and the release-staging packet title.

## Version ledger

| Version | Date recorded | State | Scope |
| --- | --- | --- |
| `0.1.0` | 2026-07-06 | Historical development baseline; unpublished | Original CLI, reports, CI mode, presets, configuration, and optional AI-ready prompt output |
| `0.2.0` | 2026-08-24 | Historical candidate; unpublished | Action integration, custom rules, PR context, configuration diagnostics, suppressions, report contracts, and cross-platform validation |
| `1.0.0` | 2026-08-25 through 2026-08-27 | Historical prepared candidate; unpublished | Public contract, repository intelligence, policies, review projections, dashboard, plugins, and release/security/support gates |
| `1.1.0` | 2026-08-27 | Current unpublished source version | Deterministic doctor diagnostics, supported adoption journeys, consumer fixtures, privacy-safe feedback, and safe regex rejection |

`CHANGELOG.md` is the user-facing change history. The release decision and release notes for the current source version are preparation documents only: they do not authorize signing, tagging, publication, or any external mutation.

## What must match the current version

The current product identity appears in `package.json`, `src/version.js`, JSON reports, the CycloneDX SBOM, current onboarding/report/migration/release documentation, current release-note templates, and generated package contents. Update these together through the version contract; do not hand-edit a release artifact to make it appear current.

## Historical records and fixtures

Historical release packets, staged artifacts, migration references, and fixture inputs deliberately retain the version they model. In particular, the `release/v1.0.0/` evidence set remains bound to its original `1.0.0` candidate and must not be rewritten. Policy-pack identity versions describe those packs, and compatibility ranges intentionally continue to support Merge Guard `>=1.0.0 <2.0.0`. Some fixtures use legacy or future versions to prove compatibility and rejection behavior.

## Safe version workflow

1. Choose the source version deliberately and update the current identity fields together.
2. Add a dated, status-qualified changelog section covering user-visible changes, fixes, compatibility, and verification.
3. Create or update the matching release-note and decision templates without marking any external state approved or published.
4. Run `npm run test:version`, `npm run test:snapshots`, `npm run test:installation`, and `npm run release:check`.
5. Stage a candidate only from a reviewed immutable commit. Publication, tags, signatures, releases, Action references, and Marketplace actions remain separate owner decisions.
