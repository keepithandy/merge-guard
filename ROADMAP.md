# Merge Guard Roadmap

This is the canonical roadmap for work after the v1.0 release candidate. It describes direction and sequencing, not a promise to ship on a particular date.

## Current state

The historical v1.0 candidate at `636a1e9812bb017dae69be122b36555b89db5e77` passed its release gates and reproducible staging checks but remained unsigned, unapproved for external release actions, unpublished, and unverified. Its evidence remains immutable history; it is not the active product milestone. Tagging, npm publication, GitHub release creation, and stable Action-reference movement remain manual owner decisions for any version.

The current `main` source identity is `1.3.0-beta.1`; it consolidates the completed v1.1, v1.2, and v1.3 source work into an explicit unpublished beta without changing historical candidates or authorizing an external release. Current versus historical version identity is defined in [the versioning policy](docs/versioning.md).

The v1.1, v1.2, and v1.3 source milestones are implemented and release-gated. Their completion does not claim that Merge Guard is useful enough for broad adoption; the active beta usefulness cleanup and subsequent field-validation milestone exist to prove that.

The pre-v1 milestones are complete. Their delivery history remains available in closed GitHub issues and pull requests; the detailed plan for the next milestones lives in [the roadmap execution plan](docs/ROADMAP_EXECUTION.md).

## Active priority

### Browser-game save compatibility — protect existing player progress

The reviewer-signal cleanup is complete. The next usefulness slice turns a common browser-game failure mode into explicit, opt-in review evidence: changing a storage key or save version without showing how existing saves migrate.

The browser-game slice:

- activates only when the caller explicitly selects the `browser-game` starter policy;
- records literal `localStorage` and `sessionStorage` key changes from the supplied diff;
- records numeric save-version changes and whether migration paths or calls are present;
- puts old-save loading or migration verification into the three-check reviewer plan;
- preserves scoring and labels unknown compatibility instead of claiming that a migration is correct.

Exit gate: focused fixtures cover key replacement, version changes with and without migration evidence, unrelated diffs remain quiet, and the full release gate passes without changing default behavior.

## Planned milestones

| Version | Focus | Outcome |
| --- | --- | --- |
| v1.1 | Adoption and diagnostics | New users can install, configure, and troubleshoot Merge Guard from actionable, privacy-safe output. |
| v1.2 | Repository impact fidelity | Explicit repository metadata can improve affected-package reasoning without executing project code or guessing dependency edges. |
| v1.3 | Durable review evidence | Teams can carry immutable Merge Guard evidence across pull-request pushes and CI runs with clear provenance and failure semantics. |
| v1.3.0-beta.2 | Reviewer signal cleanup | Human-facing reports show conservative decisions, three primary checks, and fewer keyword-driven false positives while preserving the v1 JSON contract. |
| v1.3.0-beta.3 | Browser-game save compatibility | The opt-in browser-game policy identifies literal storage-key and save-version compatibility gaps and prioritizes old-save verification. |
| Beta validation | Field validation and adoption readiness | A labeled historical-PR evaluation demonstrates whether findings are actionable, sufficiently complete within supported scope, and easy to adopt. |

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

### Beta validation — Field validation and adoption readiness

- Align source, package, runtime, SBOM, notes, and decision templates to one explicit beta identity.
- Build a local, labeled historical-PR evaluation harness with calibration and held-out partitions.
- Measure actionability, supported-scope recall, noise, specificity, setup effort, and runtime without telemetry or uploads.
- Simplify defaults or improve core analysis according to preregistered results before expanding the extension surface.

Exit gate: an immutable beta passes release gates and a preregistered held-out evaluation reaches the documented usefulness thresholds, or the milestone records an honest no-go result and the measured corrective plan.

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
