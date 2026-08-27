# Merge Guard Roadmap

This is the canonical roadmap for work after the v1.0 release candidate. It describes direction and sequencing, not a promise to ship on a particular date.

## Current state

The v1.0 launch gate is active. The prior `9fc0891743d27d65a889fc93fab5d8bca67e8cde` main commit passed its configured CI matrix but was rejected as a release candidate after package inspection found stale `0.1.0` runtime and compatibility identifiers beside `1.0.0` package metadata. The replacement candidate is immutable commit `636a1e9812bb017dae69be122b36555b89db5e77`: a clean detached staging run passed 108/108 local checks, two package builds were byte-identical, the staged package and SBOM identify `1.0.0`, and the exact commit passed the eight-job Node 18/20/22/24 × Ubuntu/Windows matrix. Its auditable evidence was merged through PR #133 at `33345e1855028163f72034c16ffb933bdafc7d66`. It is prepared but unsigned, unapproved for external release actions, unpublished, and unverified. Tagging, publishing to npm, creating a GitHub release, and moving a major-version Action tag remain manual owner decisions.

Owner-directed v1.1 preparation is implemented at immutable commit `c9fc6be3ec0c0543cea6e722f0c67a2ca5b458f3`. Its local `npm run release:check` result is 114/114 passing, including deterministic doctor, consumer-fixture, public-contract, support, installation, security, performance, distribution, and artifact gates. This does not close the v1.1 milestone or change the v1.0 release state: the final commit still needs its GitHub Node/OS matrix, and the public npm journey cannot be verified until a separately approved publication exists. See [v1.1 preparation evidence](docs/validation/V1.1_ADOPTION_DIAGNOSTICS.md).

The pre-v1 milestones are complete. Their delivery history remains available in closed GitHub issues and pull requests; the detailed plan for the next milestones lives in [the roadmap execution plan](docs/ROADMAP_EXECUTION.md).

## Active priority

### v1.0 launch gate — publish deliberately

Validate the release candidate from its immutable commit, rehearse install and rollback paths, and assemble the owner approval packet. Validation must never publish, tag, or move a release reference by itself.

Exit gate: the documented release checks pass against the exact candidate, artifacts and checksums are reproducible, rollback is rehearsed, and an owner explicitly approves each external release action.

## Planned milestones

| Version | Focus | Outcome |
| --- | --- | --- |
| v1.1 | Adoption and diagnostics | New users can install, configure, and troubleshoot Merge Guard from actionable, privacy-safe output. |
| v1.2 | Repository impact fidelity | Explicit repository metadata can improve affected-package reasoning without executing project code or guessing dependency edges. |
| v1.3 | Durable review evidence | Teams can carry immutable Merge Guard evidence across pull-request pushes and CI runs with clear provenance and failure semantics. |
| v1.4 | Trusted extension lifecycle | Locally installed policies and rule plugins have explicit discovery, compatibility, integrity, and upgrade workflows. |

Milestone versions are directional. Patch releases may ship independently when they are compatible, narrowly scoped fixes.

## Milestone boundaries

### v1.1 — Adoption and diagnostics

- Reconcile install, Action, dashboard, migration, and troubleshooting journeys around the published v1 contract.
- Add deterministic `doctor`-style diagnostics for runtime, configuration, policy, plugin, and repository-context problems.
- Expand representative consumer fixtures and failure messages based on real adoption blockers.
- Define a privacy-preserving feedback process; the CLI and dashboard remain telemetry-free by default.

Exit gate: clean-machine and representative-repository fixtures cover the supported setup paths, diagnostics name the failed contract and next action, and the v1 public schemas remain compatible.

### v1.2 — Repository impact fidelity

- Accept explicit, versioned dependency and ownership metadata for supported monorepos.
- Explain direct, transitive, shared-file, and unknown impact as separate states with source provenance.
- Improve rename, generated-file, binary, submodule, and large-diff handling without hiding uncertainty.
- Preserve the current read-only rule: discovered commands and changed project code are never executed.

Exit gate: every impact claim is deterministic and traceable to checked-in evidence; absent or invalid metadata degrades to an explicit unknown state rather than an inferred graph.

### v1.3 — Durable review evidence

- Define an explicit workflow for selecting prior immutable reports and artifact manifests.
- Make comparison, annotations, SARIF, and managed comments resilient to reruns, forks, missing permissions, and unavailable history.
- Add auditable retention and handoff guidance without silently deleting, uploading, or rewriting artifacts.
- Exercise the workflow in end-to-end multi-push and failure-injection fixtures.

Exit gate: a reviewer can identify the exact current and prior evidence, understand unavailable or untrusted history, and reproduce comparison output locally.

### v1.4 — Trusted extension lifecycle

- Add explicit local discovery and selection for policy packs and rule plugins.
- Verify compatibility, checksums, attestations, permissions, and limits before execution.
- Define install, upgrade, rollback, and conformance workflows without automatic remote code retrieval.
- Keep third-party code outside the core trust boundary and make unsupported guarantees clear.

Exit gate: extensions are never fetched or activated implicitly, incompatible or unverifiable inputs fail closed, and the conformance kit covers lifecycle and isolation failures.

## v2 decision checkpoint

A v2 roadmap begins only when accumulated evidence shows that a breaking contract is necessary. Collaboration, hosted storage, automatic remote discovery, durable dashboard workspaces, native packaging, or automatic command execution each require a separate architecture decision, security and privacy review, migration plan, and explicit user consent model.

## Roadmap rules

- A milestone begins only after the preceding exit gate is satisfied or an explicit exception is documented.
- Delivery work is split into narrow issues with deterministic acceptance criteria and rollback notes.
- Additive v1 changes preserve frozen CLI, report, policy, plugin, artifact, and Action contracts.
- Risk-scoring changes require fixtures, compatibility notes, and a clear explanation of score movement.
- Unknown, unavailable, and untrusted evidence must remain distinct from clean or safe evidence.
- Merge Guard remains useful without AI, hosted storage, telemetry, or external services.
- Publishing, tagging, permissions, network access, persistence, and code execution always require explicit authorization.
