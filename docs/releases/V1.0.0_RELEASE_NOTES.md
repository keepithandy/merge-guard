# Merge Guard v1.0.0 candidate release notes

Status: **unpublished candidate**

These notes describe the v1.0 candidate. They do not prove approval, signing, tagging, npm publication, a GitHub release, or a Marketplace listing. See the [release decision packet](V1.0.0_RELEASE_DECISION.md) for the required evidence and owner decision.

## Highlights

Merge Guard v1.0.0 provides deterministic, local-first pull-request risk analysis through a CLI and reusable composite GitHub Action. It produces plain text, Markdown, pull-request summaries, schema-versioned JSON, changed-line annotations, and SARIF 2.1.0 without calling an AI provider or executing project commands it discovers.

The candidate includes configurable risk presets, project-defined custom rules and diagnostics, repository-aware check suggestions, starter policy packs and inheritance, stable finding comparisons, managed PR comments, a bounded local dashboard, and versioned artifact, plugin, installation, security, performance, distribution, and support contracts.

## Compatibility and migration

- Node.js 18 or newer is required.
- The supported workflow matrix is Node.js 18, 20, 22, and 24 on Ubuntu and Windows.
- The JSON report remains schema version 1; consumers should use the schema version for payload compatibility and tolerate documented additive fields.
- Starter policies and the reference plugin support Merge Guard `>=1.0.0 <2.0.0` and report schema version 1.
- Until publication is explicitly approved and verified, use a reviewed source checkout or pin the composite Action to an immutable commit SHA.

## Security boundaries and known limitations

- Merge Guard is decision support; it does not prove a change safe or replace tests, review, or branch protection.
- It reads diffs and explicit local configuration but does not execute suggested project commands.
- Repository impact uses explicit layouts and metadata; it does not infer a dependency graph.
- CODEOWNERS suggestions do not prove assignment, access, review request, or approval.
- SARIF is generated but never uploaded automatically; report comparison never fetches history or artifacts.
- The dashboard is local, bounded, and non-persistent; plugin workers have bounded contracts but are not a hostile-code sandbox.

## Recovery

For source or Action use, return to the last reviewed immutable commit. For an approved future npm publication, restore the last verified package version in the consumer and rerun the same gates. Registry deprecation, release edits, Action-reference repair, revocation, and user notification are separate owner-controlled actions; see the [decision packet](V1.0.0_RELEASE_DECISION.md#abort-rollback-revocation-and-support-handoff).
