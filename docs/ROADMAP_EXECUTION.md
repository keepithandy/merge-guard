# Roadmap Execution Plan

This plan turns the [post-v1 roadmap](../ROADMAP.md) into bounded delivery slices. Issue numbers are assigned only when a slice is accepted into the active queue.

## Delivery sequence

1. Complete the manually approved v1.0 launch gate.
2. Remove adoption blockers and improve diagnostics in v1.1.
3. Add evidence-based repository impact fidelity in v1.2.
4. Make review evidence durable across CI runs in v1.3.
5. Validate usefulness and adoption readiness with a labeled historical-PR beta evaluation.
6. Use adoption, compatibility, and security evidence to decide whether v2 work is justified.

Only one milestone is active at a time. Beta field validation is active. Historical release evidence remains preserved, while every publication, signing, tagging, release, Marketplace, and stable Action-reference decision stays separately owner-controlled.

Source-only sequencing exception: until a release owner separately authorizes an external v1.0 action, roadmap implementation may proceed through reviewed GitHub pull requests and approved merges. This exception does not authorize publication, signing, tagging, release creation, Marketplace changes, or stable Action-reference movement.

## Historical queue — v1.0 launch gate

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

## Completed queue — v1.1 adoption and diagnostics

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

## Completed queue — v1.2 repository impact fidelity

### Impact metadata contract

Define a versioned, optional checked-in format for package dependencies, ownership, generated paths, and repository-wide paths. Validate it without executing package managers or project scripts.

Implemented by the source-only v1.2 contract slice: `--impact-metadata <path>` validates one explicitly selected repository-relative JSON file and reports valid, invalid, or not-provided state. It deliberately does not yet calculate dependency impact; see [impact metadata](impact-metadata.md).

### Explainable impact graph

Report direct, transitive, shared, and unknown impact separately. Every edge includes its source and reason; cycles, missing nodes, and ambiguous ownership produce diagnostics rather than guessed results.

Implemented by #138 using only valid, explicitly selected impact metadata. The additive graph preserves existing v1 ownership output and scoring.

### Diff edge cases

Add deterministic contracts for renames, copies, binary changes, submodules, generated files, oversized diffs, and partial history. Preserve evidence when analysis is intentionally incomplete.

Implemented by #144 with bounded diff evidence, explicit rename/copy/binary/submodule records, retained generated sources, and partial diagnostics for oversized or header-incomplete inputs.

### Compatibility and performance gate

Prove that repositories without impact metadata retain v1 behavior and that large explicit graphs stay within documented time and memory budgets.

Implemented by #146 with a release-blocking compatibility projection and a three-run, 750-package explicit-graph soak capped at 3,000 ms and 128 MB heap growth per run. The gate runs across Node 18/20/22/24 on Ubuntu and Windows.

v1.2 repository impact fidelity is complete: all four roadmap slices are implemented and release-gated.

## Completed queue — v1.3 durable review evidence

### Prior-evidence selection

Define how a caller explicitly identifies and supplies a previous report and artifact manifest. Missing, stale, cross-branch, incompatible, or unverifiable evidence must be distinguishable.

Implemented by #140 with opt-in report-to-manifest verification and explicit repository, branch, and commit assertions. The report-only comparison path remains available for v1 compatibility.

### CI artifact handoff

Provide least-privilege examples for storing and retrieving evidence in caller-owned CI. Merge Guard must not silently search, upload, retain, or delete workflow artifacts.

Implemented by #142 with Action-generated manifests, strict prior-evidence wiring, and a caller-owned example that selects one exact run ID and artifact name. The composite Action performs no artifact storage or retrieval.

### Review projection resilience

Exercise managed comments, annotations, SARIF, comparisons, and threshold results across reruns, fork permissions, canceled jobs, duplicate events, and partial failures.

Implemented by #148 with a versioned channel-by-channel projection result, non-destructive comment permission degradation, one-comment duplicate/rerun convergence, retained threshold evidence, and explicit canceled-attempt recovery semantics.

### Reproducibility gate

Given the same current and prior evidence, local and CI comparison results must be byte-stable apart from explicitly documented generated metadata.

Implemented by #150 with three isolated generation lanes, ten byte-compared durable-review artifacts, committed SHA-256 baselines, and the full Node 18/20/22/24 × Ubuntu/Windows release matrix. Only `manifest.generated.at` and its derived `manifest.artifactId` are documented as variable when a caller does not provide an explicit timestamp.

v1.3 durable review evidence is complete: all four roadmap slices are implemented, release-gated, and preserve the frozen v1 behavior.

## Active queue — beta field validation and adoption readiness

### Beta identity and packaging

Align package, runtime, report, SBOM, release notes, decision packet, staging path, and current documentation to one explicit unpublished beta identity. No source change authorizes publication.

Implemented by #152 as `1.3.0-beta.1`, with prerelease-aware version contracts and preserved historical identities. Publication remains pending a separate owner decision.

### Historical-PR evaluation harness

Implement the accepted [evaluation harness design](EVALUATION_HARNESS_DESIGN.md): a bounded local corpus, independent labels, calibration/held-out partitions, deterministic matching, and content-free aggregate results.

Implemented by #154 with versioned corpus, labels, case-result, and aggregate schemas; path-safe bounded local loading; independent-label controls; deterministic exact matching; content-free JSON results; and release-blocking privacy, safety, and cross-platform contracts. A caller-owned pilot corpus and its results remain pending.

### Golden-path GitHub experience

Use pilot evidence to reduce default setup and review noise while keeping advanced evidence available and frozen v1 behavior compatible.

### Pilot and calibration gate

Run the preregistered held-out evaluation, publish a content-free results report, and choose improve, proceed, or stop without moving thresholds after results are known.

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
- Extension lifecycle work is deferred until field evidence shows repeated demand and the beta usefulness gate passes.
- No milestone may weaken CLI determinism, local usefulness, or the frozen v1 contracts to accelerate delivery.
