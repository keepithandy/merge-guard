# Merge Guard Roadmap

**Roadmap status (October 20, 2026):** See the [audited post-Phase-5 plan](docs/POST_P5_ROADMAP.md) for source evidence, dependency order, proposed P6–P9 slices and separate Free versus commercial launch gates. **P5A/P5B/P5C are merged; a production Pro/Team launch is not greenlit.** This roadmap is direction, not an automatic authorization for new issues, service deployment, checkout, publication, or release.

This is the canonical roadmap for work after the v1.0 release candidate. It describes direction and sequencing, not a promise to ship on a particular date.

## Current state

**Fresh source state:** `main` was confirmed at `520f4527d93e46d8b008759bfad4024b909706c8` after merged P5A [#200](https://github.com/keepithandy/merge-guard/pull/200), P5B [#201](https://github.com/keepithandy/merge-guard/pull/201), P5C [#202](https://github.com/keepithandy/merge-guard/pull/202), and P5B support-security follow-up [#203](https://github.com/keepithandy/merge-guard/pull/203). The PR heads passed required GitHub Actions; a release candidate must **revalidate one exact frozen commit and artifact**. Current declared source package version remains `1.3.0-beta.2` (unpublished). P5 commercial tests are mocked; live dual-tier Sandbox proof and operational readiness remain outstanding. [Issue #190](https://github.com/keepithandy/merge-guard/issues/190) (intermittent CI) and legacy [PR #189](https://github.com/keepithandy/merge-guard/pull/189) remain open for review, not automatic integration.

The historical v1.0 candidate at `636a1e9812bb017dae69be122b36555b89db5e77` passed its release gates and reproducible staging checks but remained unsigned, unapproved for external release actions, unpublished, and unverified. Its evidence remains immutable history; it is not the active product milestone. Tagging, npm publication, GitHub release creation, and stable Action-reference movement remain manual owner decisions for any version.

The current `main` source identity is `1.3.0-beta.2`; it consolidates completed v1.1, v1.2, and v1.3 source work into an explicit unpublished beta without changing historical candidates or authorizing an external release. Current versus historical version identity is defined in [the versioning policy](docs/versioning.md).

The v1.1, v1.2, and v1.3 source milestones are implemented and release-gated. The reviewer-signal cleanup, companion-change contracts, and browser-game save compatibility slices are also implemented. Their completion does not claim that Merge Guard is useful enough for broad adoption; the active field-validation milestone exists to measure that.

The pre-v1 milestones are complete. Their delivery history remains available in closed GitHub issues and pull requests; the detailed plan for the next milestones lives in [the roadmap execution plan](docs/ROADMAP_EXECUTION.md). The [active solo-maintainer Free beta roadmap](docs/PHASE_ROADMAP.md) supersedes the old mandatory four-phase independent-evaluation sequence for normal development and preview distribution. The previous strict protocol remains [optional for independently verified statistical accuracy claims](docs/OPTIONAL_INDEPENDENT_EVALUATION_PROTOCOL.md). The broader [long-horizon roadmap](docs/LONG_HORIZON_ROADMAP.md) remains an unapproved idea registry.

## Active priority

**Two independent active/planning lanes:** (1) the authorized solo Free repair/preview workflow in [`docs/PHASE_ROADMAP.md`](docs/PHASE_ROADMAP.md) and (2) **planning** for post-P5 commercial readiness, with P6–P9 proposed—not started—in [`docs/POST_P5_ROADMAP.md`](docs/POST_P5_ROADMAP.md). The [commercial checklist](docs/commercial-release-checklist.md) is the release gate; neither source merges nor mocked CI certify checkout, sale or support availability. Major hosted/paid features require separate scope and security decisions.

### Owner-directed additive slice — Commercial Foundation

On 2026-10-16 the owner explicitly authorized an additive commercialization slice for Free/Pro/Team packaging through Polar. This is a documented exception to the normal expansion sequence and does not change analyzer scoring, usefulness claims, or the beta-recovery evidence gate.

Scope:

- preserve the entire existing MIT feature set as Free;
- add centralized plan/capability modeling rather than scattered plan checks;
- add Polar public-client license activation, validation, deactivation, and local cached state;
- expose `plan`, `activate`, `license`, and `account` CLI commands;
- document $9/month Pro and $29/month Team targets, Polar setup, smoke testing, and release gates;
- keep production checkout, publication, tags, and stable Action-reference movement as explicit owner actions;
- do not advertise paid benefits until their actual delivery path exists and is tested.

The commercial slice is additive to the scanner. Missing or unavailable licensing must not stop Free analysis, and no Polar organization access token is embedded in the distributed CLI.


### Solo-maintainer Free beta: targeted fixes first, field learning afterward

The owner directed on October 19, 2026 that independent human reviewers **must no longer be a prerequisite to development, rule-fix merges or publishing a clearly labeled Free beta**. The active workflow is [the solo-maintainer roadmap](docs/PHASE_ROADMAP.md). Reproducible positive/negative fixtures, green required CI, contract compatibility, automated privacy/security checks and rollback plans replace mandatory human-review gates and preregistered efficacy gate for ordinary Free releases. External publication still needs its own exact approval.

Merge Guard's existing MIT scanner is Free and must remain usable offline, without a paid entitlement or third-party service. Its Free beta is **experimental review decision support**, not a confirmed defect detector or a guarantee of no missed risks.

The first independently preregistered pilot remains an immutable historical **stop** decision from September 3, 2026:

- product commit `e63bf37a84dae314965c98dfe9387b6a0db833bf`; preregistration `6be3c252d0ffbdbbf96ca05e0a39af4e400250efddf512cc8b0bac4fad4df564`;
- 50 held-out cases from five aliases, with 35 supported concerns and 15 low-risk controls;
- actionable precision **12/140 (8.6%)** against the former 70% formal pilot gate;
- overall supported-scope recall **12/35 (34.3%)**, diagnosed as low without a separate numeric gate;
- critical recall **insufficient evidence** (zero high-severity denominator);
- median unmatched findings 1, clean-PR specificity 11/15 (73.3%), median setup 1 minute and p95 runtime 4 ms passed their former preregistered checks.

Do not alter, relabel, rerun for tuning or describe the old pilot as passing. Improvements in targeted fixtures or self-selected feedback reports are **not estimates of general precision or recall**.

The practical work order is:

1. Fix clear, bounded rule/recommendation defects using minimal positive and negative regression cases, an explained expected score change, full CI, and rollback. PR [#193](https://github.com/keepithandy/merge-guard/pull/193) was merged at `864fadb` after required automated gates; its fixture results demonstrate only the targeted behaviors, not general accuracy.
2. Verify representative Free installs/Action use, supported platforms, deterministic reports, frozen public interfaces, security, package contents and documented limitations on the exact candidate before any separately authorized external release.
3. Collect **voluntary** Free-user feedback using the privacy-safe [feedback guide](docs/FREE_BETA_FEEDBACK.md) and GitHub issue form. Users need not publish proprietary diffs or identifying details; avoid passive telemetry.
4. Convert reproduced user issues into focused tests and future fixes. Track unverified versus confirmed reports; avoid deriving population accuracy percentages from self-selected issues.

A full dual-human-labeled calibration / fresh held-out study remains available only as an **optional future evidence program** when the owner wants externally supportable quantified accuracy claims. Its implementation retains the strict integrity, thresholds and two-label requirements; it is not invoked to authorize Free fixes or Free preview publication.

No hosted/AI/remote code execution or unrelated expansion is authorized by this direction. Commercial products and external release actions retain their separate permission gates.

### Owner-directed additive slice — Human Verification evidence

The owner has explicitly authorized a bounded dashboard/evidence improvement during beta validation: **Human Verification**. This is not a new analysis system and does not reopen the expansion queue.

The slice builds directly on the existing local dashboard, report comparison, verification-progress, and durable-evidence work. It allows a person to record current-build Pass / Fail / N/A / Untested results, environment metadata, user-added manual checks, and human-observed runtime defects, then export that report-bound evidence as Markdown or JSON.

Roadmap integrity constraints for this slice are explicit:

- deterministic risk scoring, thresholds, findings, and review-decision semantics do not change;
- no discovered or imported project command is executed;
- no hosted service, account, telemetry, remote storage, media upload, or GitHub write is added;
- Merge Guard report schema v1, CLI, Action, comparison, and existing evidence provenance remain compatible;
- verification-progress v1 remains loadable with an explicit migration notice, while v2 carries richer Human Verification evidence;
- previous human Pass evidence never becomes current-build Pass through report comparison;
- the work does not constitute proof of safety, CI replacement, code-review replacement, or merge approval.

This owner-directed slice is complete only when its dashboard architecture, import, comparison, verification-progress, review-focus, explorer, accessibility, public-contract, security, and full repository gates remain green. It does not change the beta recovery exit gate above.

## Planned milestones

| Version | Focus | Outcome |
| --- | --- | --- |
| v1.1 | Adoption and diagnostics | New users can install, configure, and troubleshoot Merge Guard from actionable, privacy-safe output. |
| v1.2 | Repository impact fidelity | Explicit repository metadata can improve affected-package reasoning without executing project code or guessing dependency edges. |
| v1.3 | Durable review evidence | Teams can carry immutable Merge Guard evidence across pull-request pushes and CI runs with clear provenance and failure semantics. |
| v1.3.0-beta.2 | Reviewer signal cleanup | Human-facing reports show conservative decisions, three primary checks, and fewer keyword-driven false positives while preserving the v1 JSON contract. |
| Browser-game save slice (source) | Save compatibility guidance | An implemented opt-in browser-game policy identifies literal storage-key and save-version compatibility gaps; **not** proof that version `1.3.0-beta.3` was published or even selected. |
| Beta validation | Free preview readiness and voluntary field learning | A bounded, reproducible Free candidate can receive an explicit preview decision; new independent labels are optional for statistical efficacy claims, not a prerequisite. |
| P5 commercial source (complete) | Customer diagnostics, support queue operations, Pro/Team mock lifecycle | Merged #200–#203; paid operational launch remains unverified. |
| Proposed P6–P9 (not active) | Hardened candidate, Free preview, actual Team fulfillment, production rollout | Follow the separate authorizations and exact evidence gates in [the post-P5 plan](docs/POST_P5_ROADMAP.md). |

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

Exit gate for the **Free preview**: an immutable candidate passes required CI/release checks, security, consumer/installation fixtures, compatibility and rollback review; accurately discloses unvalidated field accuracy; and receives separate exact owner authorization before external publication. The preregistered dual-reviewer threshold study remains optional for statistical efficacy claims, not a preview gate.

## v2 decision checkpoint

A v2 roadmap begins only when accumulated evidence shows that a breaking contract is necessary. Collaboration, hosted storage, automatic remote discovery, durable dashboard workspaces, native packaging, or automatic command execution each require a separate architecture decision, security and privacy review, migration plan, and explicit user consent model.

## Roadmap rules

- A milestone begins only after the preceding exit gate is satisfied or an explicit exception is documented.
- Delivery work is split into narrow issues with deterministic acceptance criteria and rollback notes.
- Additive v1 changes preserve frozen CLI, report, policy, plugin, artifact, and Action contracts.
- Risk-scoring changes require fixtures, compatibility notes, and a clear explanation of score movement.
- Ordinary Free source fixes can merge after required automated tests, security/compatibility checks and rollback evidence; manual or peer code-review signoff is not mandatory.
- User-submitted field feedback is voluntary and self-selected, not a statistical accuracy estimate.
- Unknown, unavailable, and untrusted evidence must remain distinct from clean or safe evidence.
- Merge Guard remains useful without AI, hosted storage, telemetry, or external services.
- Publishing, tagging, permissions, network access, persistence, and code execution always require explicit authorization.
