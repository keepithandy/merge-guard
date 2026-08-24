# Roadmap Execution Plan

## Delivery sequence

1. Stabilize merged main under [v0.2](https://github.com/keepithandy/merge-guard/issues/38).
2. Expand read-only repository intelligence under [v0.3](https://github.com/keepithandy/merge-guard/issues/39).
3. Introduce versioned policy packs under [v0.4](https://github.com/keepithandy/merge-guard/issues/40).
4. Improve GitHub-native review output under [v0.5](https://github.com/keepithandy/merge-guard/issues/41).
5. Continue through the local dashboard, baselines, plugins, release candidate, and v1.0 epics tracked by [#47](https://github.com/keepithandy/merge-guard/issues/47).

## Current delivery queue

### v0.2

- #50 — Integration and release-readiness suite
- #51 — Schema and suppression snapshots
- #52 — Node and operating-system matrix
- #53 — Documentation reconciliation
- #54 — Release notes and final stabilization gate

### v0.3

- #55 — Workspace and monorepo boundaries
- #56 — Python and mixed-project checks
- #57 — Affected-package mapping
- #58 — Explanations and conformance

### v0.4

- #59 — Policy schema
- #60 — Starter policy packs
- #61 — Protected paths and CODEOWNERS guidance
- #62 — Inheritance and expiring exceptions

### v0.5

- #63 — Pull-request summaries
- #64 — Annotations and SARIF
- #65 — Push-to-push comparisons
- #66 — End-to-end review fixtures

### v0.6

- #68 — Dashboard architecture and security boundary
- #69 — Local diff and report import contracts
- #70 — File-risk explorer and verification checklist
- #71 — Accessible responsive layout and exports

### v0.7

- #72 — Immutable report artifact manifests
- #73 — Deterministic report comparison
- #74 — Accepted legacy-risk model
- #75 — Trends and retention rules

### v0.8

- #76 — Rule-plugin manifest
- #77 — Isolated plugin worker boundary
- #78 — Checksums and artifact attestation
- #79 — Plugin conformance kit

### v0.9

- #80 — Cross-platform installation and packaging
- #81 — Security, dependency, and provenance review
- #82 — Performance budgets and soak
- #83 — Release-candidate examples, docs, and gate

### v1.0

- #84 — Stable public-contract freeze
- #85 — Gated release artifacts and signing
- #86 — npm and GitHub Marketplace listings
- #87 — Post-release support and deprecation

## Definition of ready

An issue is ready when it has:

- one parent epic;
- a concrete outcome;
- deterministic acceptance criteria;
- explicit dependencies;
- safety guardrails;
- exact verification expectations.

## Definition of done

A delivery issue is done when:

- implementation and focused fixtures are committed;
- relevant smoke and contract suites pass;
- report or configuration compatibility is documented;
- user-facing documentation is current;
- publishing, tagging, and external-service behavior remains explicitly controlled;
- the parent epic checklist is updated.

## Parallelism rules

- Documentation and fixtures may run alongside implementation.
- Policy work waits for repository-intelligence contracts.
- GitHub presentation work waits for stable schema and policy contracts.
- Dashboard, baseline, and plugin work must not weaken CLI determinism.
