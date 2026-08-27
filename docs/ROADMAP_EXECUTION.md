# Roadmap Execution Plan

This plan turns the [post-v1 roadmap](../ROADMAP.md) into bounded delivery slices. Issue numbers are assigned only when a slice is accepted into the active queue.

## Delivery sequence

1. Complete the manually approved v1.0 launch gate.
2. Remove adoption blockers and improve diagnostics in v1.1.
3. Add evidence-based repository impact fidelity in v1.2.
4. Make review evidence durable across CI runs in v1.3.
5. Add an explicit, trustworthy extension lifecycle in v1.4.
6. Use adoption, compatibility, and security evidence to decide whether v2 work is justified.

Only one milestone is active at a time. Documentation, fixtures, and design work for the next milestone may proceed when they do not freeze an implementation contract early. Owner-directed v1.1 preparation is recorded below, but v1.0 remains the active release priority until its separate external decisions are made.

## Active queue — v1.0 launch gate

### Candidate validation

Outcome: the exact release-candidate commit passes the full release, installation, security, performance, public-contract, artifact, distribution, and support gates.

Evidence status: `9fc0891743d27d65a889fc93fab5d8bca67e8cde` is not a v1.0 candidate. Although its configured Node/OS workflow passed, exact package inspection found stale `0.1.0` runtime and compatibility identifiers. A new candidate requires a clean v1.0 runtime-identity repair, fresh artifact hashes, and fresh validation; passing older checks does not carry forward.

Acceptance:

- the candidate commit and generated artifact hashes are recorded;
- package contents and SBOM identify version `1.0.0`;
- supported Node and operating-system paths pass from clean environments;
- validation performs no tag, package, Marketplace, or release mutation.

### Release and rollback rehearsal

Outcome: an owner can follow one documented sequence to publish or abort the release.

Acceptance:

- npm, GitHub release, Action reference, and Marketplace steps name their required owner approval;
- rollback, revocation, and support handoff paths are rehearsed against non-publishing fixtures;
- no automation can infer approval from passing checks.

### Owner decision packet

Outcome: the release owner receives one auditable summary of candidate identity, checks, known limitations, artifacts, and recovery steps.

Acceptance:

- every external mutation is listed separately;
- the packet distinguishes prepared, approved, published, and verified states;
- the launch gate closes only after the owner records an explicit decision.

## Next queue — v1.1 adoption and diagnostics

Preparation evidence: source commit `8a8bba0b697699571fc8f6814d79c87c15ad069b` passed local `npm run release:check` with 114/114 checks and the pull-request Node 18/20/22/24 × Ubuntu/Windows matrix, smoke, composite-Action, and review-experience workflows. It does not claim a public npm installation result because v1.0 publication remains unapproved and unpublished. See [v1.1 preparation evidence](validation/V1.1_ADOPTION_DIAGNOSTICS.md).

### Supported journey matrix

Cover source checkout, local package, npm package, GitHub Action, dashboard, policy, and plugin entry points. Each journey names prerequisites, successful output, common failures, and uninstall or rollback steps.

Implemented in `docs/adoption-and-diagnostics.md`, including an explicit distinction between available local/source/Action paths and the not-yet-published npm path.

### Deterministic diagnostics

Design a read-only diagnostic command that checks the Node runtime, package identity, configuration, policy manifests, plugin manifests, repository context, and Action inputs. Output must be stable, actionable, redacted, and available as both human-readable text and structured data.

Implemented as `merge-guard --doctor` and `merge-guard --doctor --json`, with contract tests for ordering, failures, selected inputs, and output redaction.

### Consumer conformance fixtures

Add small public fixtures for a standalone Node project, npm workspace, Python project, mixed project, forked pull request, and restricted-permission Action. Keep all examples secret-free and non-publishing.

Implemented under `test/fixtures/consumer-conformance/`, with a metadata-only contract gate that does not run fixture project code.

### Feedback and support loop

Define issue templates and troubleshooting data that users may choose to share. Do not add telemetry or upload repository data; diagnostics should make sensitive fields easy to omit.

Implemented with privacy-safe issue templates, a no-telemetry support process, and doctor guidance that omits supplied values and absolute paths.

## Later queue — v1.2 repository impact fidelity

### Impact metadata contract

Define a versioned, optional checked-in format for package dependencies, ownership, generated paths, and repository-wide paths. Validate it without executing package managers or project scripts.

### Explainable impact graph

Report direct, transitive, shared, and unknown impact separately. Every edge includes its source and reason; cycles, missing nodes, and ambiguous ownership produce diagnostics rather than guessed results.

### Diff edge cases

Add deterministic contracts for renames, copies, binary changes, submodules, generated files, oversized diffs, and partial history. Preserve evidence when analysis is intentionally incomplete.

### Compatibility and performance gate

Prove that repositories without impact metadata retain v1 behavior and that large explicit graphs stay within documented time and memory budgets.

## Later queue — v1.3 durable review evidence

### Prior-evidence selection

Define how a caller explicitly identifies and supplies a previous report and artifact manifest. Missing, stale, cross-branch, incompatible, or unverifiable evidence must be distinguishable.

### CI artifact handoff

Provide least-privilege examples for storing and retrieving evidence in caller-owned CI. Merge Guard must not silently search, upload, retain, or delete workflow artifacts.

### Review projection resilience

Exercise managed comments, annotations, SARIF, comparisons, and threshold results across reruns, fork permissions, canceled jobs, duplicate events, and partial failures.

### Reproducibility gate

Given the same current and prior evidence, local and CI comparison results must be byte-stable apart from explicitly documented generated metadata.

## Later queue — v1.4 trusted extension lifecycle

### Local extension inventory

List explicitly installed policy packs and plugins with identity, source path, compatibility, permissions, checksums, and conformance state. Inventory is local and read-only.

### Install and upgrade contract

Define caller-driven install, upgrade, rollback, and removal procedures. Merge Guard must not discover or fetch executable code from a remote registry.

### Verification and isolation

Enforce compatibility, checksum, attestation, permission, resource-limit, and worker-boundary checks before execution. Failures quarantine the extension without weakening core analysis.

### Ecosystem conformance

Expand the conformance kit with lifecycle, tampering, downgrade, timeout, malformed-output, and incompatible-runtime fixtures.

## Definition of ready

A delivery issue is ready when it has:

- one roadmap milestone and one concrete user outcome;
- deterministic acceptance criteria and exact verification commands;
- dependencies, compatibility impact, and rollback notes;
- privacy, permissions, persistence, network, and execution boundaries;
- explicit treatment of unknown or unavailable evidence.

## Definition of done

A delivery issue is done when:

- implementation and focused fixtures are committed;
- relevant contract, smoke, security, and performance suites pass;
- public behavior and migration guidance are current;
- report or configuration compatibility is documented;
- external mutations remain separately and explicitly authorized;
- the milestone exit gate is updated with evidence.

## Parallelism rules

- Documentation and fixtures may run alongside implementation.
- v1.2 graph work waits for the impact metadata contract.
- v1.3 CI retrieval examples wait for immutable evidence-selection semantics.
- v1.4 activation waits for inventory, compatibility, and integrity checks.
- No milestone may weaken CLI determinism, local usefulness, or the frozen v1 contracts to accelerate delivery.
