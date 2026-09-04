# Merge Guard Phase Roadmap

Status: **proposal for owner approval**. This document converts the long-horizon capability map into a gated execution sequence. It does not mark any future phase approved, authorize publication, or turn every candidate initiative into committed work.

The sequence is intentionally front-loaded around the failed first pilot. Merge Guard should earn the right to expand by repairing evidence quality, precision, and supported-scope recall, then passing a second independently preregistered held-out pilot.

## Relationship to the other roadmaps

- [The canonical roadmap](../ROADMAP.md) states the current product direction and active priority.
- [The roadmap execution plan](ROADMAP_EXECUTION.md) records completed milestones and the current beta-recovery queue.
- [The long-horizon roadmap](LONG_HORIZON_ROADMAP.md) is the complete candidate capability map and source of stable workstream identifiers.
- This document chooses an order, defines decision gates, and states what can become active next.

If the documents conflict, the canonical roadmap and the most recent explicit owner decision win. The long-horizon roadmap remains a menu, not a backlog.

## Approval model

Three approvals are deliberately separate:

1. **Sequence approval** accepts the ordering and gates in this document.
2. **Phase authorization** allows the named phase to become active after its entry criteria are satisfied.
3. **External-action authorization** separately permits publication, signing, tag movement, Marketplace changes, hosted services, telemetry, uploads, or other external mutations.

Sequence approval is not blanket implementation or release approval. A phase may close only when its exit evidence is recorded. Closing a phase makes the next phase eligible for authorization; it does not automatically start it.

### Approval ledger

| Item | State | Meaning |
| --- | --- | --- |
| Phase 0 — Baseline lock | Complete | Historical evidence and the first pilot decision are recorded. |
| Recovery sequence, Phases 1–6 | Awaiting owner approval | Proposed as the only near-term product sequence. |
| Core maturity sequence, Phases 7–11 | Conditional | Cannot start before Decision Gate A permits expansion. |
| Distribution sequence, Phases 12–13 | Conditional | Cannot start before Decision Gate B and separate external-action approval. |
| Strategic bets, Phases 14–16 | Deferred | Require evidence-specific decision gates and fresh owner authorization. |

The approval ledger should be updated with a dated decision, decision maker, scope, and link to durable evidence. An approval must name either a phase or a contiguous phase range; ambiguous assent does not activate work.

## Invariants across every phase

- Analysis remains local, deterministic, read-only, and useful without an account or API key.
- Merge Guard does not execute project code, discovered commands, or suggested checks.
- Diffs, reports, prompts, repository contents, and telemetry are not uploaded by default.
- Frozen v1 JSON and documented CLI behavior remain compatible unless a separately approved breaking-change process says otherwise.
- Missing or failed analysis is never represented as a clean result.
- Completed held-out cases are never used for tuning.
- Every product change has focused fixtures, rollback behavior, and exact verification evidence.
- Passing tests does not authorize npm publication, GitHub releases, signing, Marketplace changes, or stable Action-reference movement.
- Unknown, unsupported, disputed, and insufficient-evidence states remain explicit.

## Sequence overview

| Phase | Outcome | Primary workstreams | Entry state | Approval state |
| --- | --- | --- | --- | --- |
| 0 | Preserve the failed-pilot baseline | EVAL | Complete | Complete |
| 1 | Establish trustworthy calibration evidence | EVAL, SEC | Phase 0 complete | Eligible after sequence approval |
| 2 | Diagnose precision and recall failures | EVAL, SIGNAL, RECALL | Phase 1 exit accepted | Proposed |
| 3 | Repair precision without hiding uncertainty | SIGNAL | Phase 2 exit accepted | Proposed |
| 4 | Repair supported-scope and critical recall | RECALL, DIFF | Phase 3 exit accepted | Proposed |
| 5 | Freeze and qualify a new product candidate | EVAL, SCALE, SEC | Phase 4 exit accepted | Proposed |
| 6 | Run a second independent held-out pilot | EVAL | Phase 5 exit accepted | Proposed |
| A | Decide whether expansion is earned | All recovery work | Phase 6 result recorded | Decision gate |
| 7 | Improve reviewer clarity and verification plans | REVIEW, CHECK | Gate A permits expansion | Conditional |
| 8 | Improve explicit repository context | IMPACT | Phase 7 exit accepted | Conditional |
| 9 | Make policy behavior operable and explainable | POLICY | Phase 8 exit accepted | Conditional |
| 10 | Harden CI evidence flow | CI, EVIDENCE | Phase 9 exit accepted | Conditional |
| 11 | Complete local evidence exploration | DASH, EVIDENCE | Phase 10 exit accepted | Conditional |
| B | Decide whether the beta is release-ready | Product maturity evidence | Phase 11 exit accepted | Decision gate |
| 12 | Prepare adoption and distribution | ADOPT, DIST | Gate B says release candidate | Conditional |
| 13 | Add one evidence-backed ecosystem adapter | ECO | Phase 12 exit accepted | Conditional |
| C | Decide whether broader platforms are justified | Demand and operations evidence | Phase 13 evidence available | Decision gate |
| 14 | Decide on an extension surface | EXT | Gate C identifies repeatable demand | Deferred |
| 15 | Test optional grounded AI assistance | AI | A bounded use case passes its entry gate | Deferred |
| 16 | Decide on hosted/team work or v2 | TEAM, V2 | Additive local work is demonstrably insufficient | Deferred |

No calendar dates are attached until a phase is authorized and sized from evidence. This prevents speculative dates from becoming commitments.

## Stage 0 — Locked baseline

### Phase 0 — Preserve the first pilot

State: **complete**.

Outcome: the failed first pilot remains immutable evidence rather than becoming a tuning dataset or being overwritten by a newer narrative.

Recorded baseline:

- actionable precision: 12/140, or 8.6%, against a 70% gate;
- supported-scope recall: 12/35, or 34.3%, against an 80% gate;
- critical recall: insufficient evidence because the held-out corpus contained no high-severity supported concerns;
- median unmatched findings: one, gate met;
- clean-PR specificity: 11/15, or 73.3%, gate met;
- median setup: one minute, gate met;
- p95 analysis time: four milliseconds, gate met;
- decision: **stop**.

Exit evidence: the immutable pilot summary, product identity, corpus identity, metric identity, thresholds, and corrective plan are recorded in the execution plan.

## Stage 1 — Beta recovery

This is the only stage eligible for near-term approval. Phases 1–6 are sequential because each protects the integrity of the next.

### Phase 1 — Calibration integrity

Outcome: build a calibration partition that can guide product changes without contaminating the next held-out test.

Selected scope:

- `EVAL-01` through `EVAL-09` as needed for corpus expansion, label guidance, provenance, adjudication, coverage, partition integrity, sampling, and exclusions;
- security and privacy checks needed to keep source content, identities, and per-case evidence local;
- content-free aggregate reporting only.

Required deliverables:

- outcome-grounded cases that were not labeled from Merge Guard output;
- two independent label decisions and a visible adjudication state for every new case;
- at least five high-severity supported concerns, with denominator sufficiency recorded rather than implied;
- stable opaque repository aliases that never cross calibration and held-out partitions;
- coverage and near-duplicate reports;
- validated local corpus and calibration-run evidence.

Exit gate:

- the corpus validator passes;
- every added case has allowed provenance, complete independent labels, and an adjudication state;
- high-severity evidence is sufficient to measure critical recall on calibration;
- partition overlap and disallowed source-content publication are zero;
- disputed labels remain visible;
- an owner accepts the corpus-integrity summary.

Explicitly out of scope: product-rule changes, held-out execution, public corpus publication, and claims that calibration metrics prove usefulness.

### Phase 2 — Failure diagnosis

Outcome: explain why the first candidate produced excess findings and missed supported concerns before choosing fixes.

Selected scope:

- `SIGNAL-01` unmatched-finding inventory;
- `EVAL-10` rule-family ablation;
- `EVAL-11` confidence intervals and denominator sufficiency;
- `RECALL-01` supported-concern taxonomy;
- `RECALL-02` recall by concern family;
- path, weight, co-occurrence, severity, and missing-evidence breakdowns using calibration only.

Required deliverables:

- a ranked precision-loss inventory by stable rule family and path class;
- a ranked miss inventory by supported concern family and severity;
- ablation evidence separating high-volume noise from useful reinforcement;
- explicit unsupported and insufficient-evidence categories;
- a small, justified set of candidate corrections with predicted metric effects and rollback plans.

Exit gate: the diagnosis accounts for enough observed errors to select bounded corrections, while every proposed correction traces to calibration evidence. No code change is justified solely by intuition or by the completed held-out corpus.

### Phase 3 — Precision repair

Outcome: increase the share of findings that imply a useful reviewer action without suppressing legitimate uncertainty.

Selected scope: only the evidence-backed subset of `SIGNAL-02` through `SIGNAL-15` chosen at the Phase 2 gate. Likely tools include stronger structural evidence, multi-signal promotion, deduplication, path-class treatment, primary/secondary/advisory budgets, and negative fixtures.

Required deliverables for each changed rule family:

- the calibration failure cluster it addresses;
- a focused positive fixture and negative fixture;
- the expected effect on precision, noise, recall, and specificity;
- stable explanation and compatibility behavior;
- a rollback path that does not invalidate stored evidence.

Exit gate:

- calibration actionable precision reaches the preregistered target trajectory;
- median unmatched findings remains no greater than one;
- clean-PR specificity remains at least 70%;
- supported-scope and critical recall do not regress outside the phase tolerance;
- frozen-v1 compatibility, determinism, and performance gates pass.

The target trajectory is a candidate-selection tool, not a product claim. Only a new held-out pilot can satisfy the usefulness gate.

### Phase 4 — Recall repair

Outcome: detect more concerns within Merge Guard's explicitly supported scope while preserving the precision gains from Phase 3.

Selected scope: the evidence-backed subset of `RECALL-03` through `RECALL-15`, plus only the `DIFF` improvements required to represent the missed change patterns faithfully.

Priority order:

1. high-severity supported concern families with adequate evidence;
2. structural gaps shared by multiple supported families;
3. explicit fallbacks when required context is absent;
4. adversarial fixtures that avoid obvious keywords;
5. lower-severity breadth only after the first four are stable.

Exit gate:

- calibration supported-scope recall reaches at least 80%;
- calibration critical supported-scope recall reaches at least 80% with at least five high-severity concerns;
- actionable precision, median noise, and clean-PR specificity remain within their Phase 3 gates;
- no critical finding is produced from a single weak heuristic;
- unsupported semantic changes lead to manual-review guidance, not fabricated certainty;
- full compatibility, determinism, security, and performance checks pass.

### Phase 5 — Candidate freeze and qualification

Outcome: select one product commit that is reproducible, compatible, secure, and ready to test without further tuning.

Selected scope:

- `EVAL-12` benchmark-drift checks;
- applicable `SCALE` reliability and resource-limit checks;
- applicable `SEC` path, redaction, artifact, dependency, and supply-chain checks;
- complete release-readiness and GitHub compatibility suites;
- documentation of known limitations and unsupported cases.

Required frozen identities:

- product commit;
- metric implementation;
- calibration corpus and labels;
- threshold definitions;
- runtime and dependency lock state;
- expected compatibility contract.

Exit gate: all required local and GitHub checks pass on the same commit, reproduced evidence matches the frozen identities, and unresolved failures are not represented as passes. Any product change after the freeze returns work to the relevant repair phase.

### Phase 6 — Second preregistered held-out pilot

Outcome: learn whether the repaired candidate is useful on genuinely new evidence.

Required sequence:

1. Assemble a fresh held-out corpus with independently produced labels.
2. Verify that it shares no case, alias, or disallowed ancestry with calibration.
3. Ensure high-severity denominator sufficiency, or preregister `insufficient-evidence` handling.
4. Bind corpus, label, metric, threshold, and product identities in a preregistration.
5. Run the frozen candidate once without post-registration tuning.
6. Publish only content-free aggregates and record `proceed`, `improve`, `stop`, or `insufficient-evidence`.
7. Preserve the full local evidence bundle and the first pilot as immutable history.

Exit gate: the run is integrity-valid and its decision is recorded. A failed metric is still a valid phase result; changing the result after inspection is not.

## Decision Gate A — Earn the right to expand

| Decision | Required evidence | Consequence |
| --- | --- | --- |
| Proceed | All usefulness, noise, specificity, setup, runtime, privacy, determinism, compatibility, and evidence-integrity gates pass. | Phase 7 becomes eligible for authorization. |
| Improve | Integrity is valid and misses are bounded enough to justify another calibration-only correction. | Return only to the named recovery phase; expansion stays locked. |
| Stop | Evidence does not support another bounded attempt or the core product thesis is not holding. | Suspend product expansion and record the disposition. |
| Insufficient evidence | A preregistered denominator or integrity condition cannot support a conclusion. | Permit measurement repair only; do not claim a pass or unlock expansion. |

Gate A is the first major owner decision. The metrics may recommend an outcome, but the durable decision record must state the evidence, limitations, chosen branch, and authorization scope.

## Stage 2 — Core product maturity

Stage 2 stays conditional until Gate A returns `proceed`. Its phases are ordered to improve the reviewer decision first, then add context, policy operations, automation reliability, and richer local exploration.

### Phase 7 — Reviewer clarity and verification intelligence

Outcome: turn valid findings into a smaller, clearer, executable reviewer plan.

Candidate scope: the evidence-backed subset of `REVIEW` and `CHECK`, including canonical hierarchy, consequence-oriented explanations, deterministic annotation budgets, check provenance, availability, ranking, and caller-supplied results.

Exit gate: reviewer studies show faster time-to-first-useful-action without worsening measured signal quality; commands remain suggested rather than executed; unavailable checks and uncertain conclusions remain explicit.

### Phase 8 — Explicit repository context

Outcome: improve affected-surface reasoning from caller-owned metadata without scanning or executing the repository.

Candidate scope: the evidence-backed subset of `IMPACT`, starting with versioned metadata contracts, schema validation, public-surface markers, ownership hints, and explainable graph edges.

Exit gate: impact reasoning improves on targeted fixtures and evaluation cases, invalid or stale metadata fails safely, and absent metadata preserves useful conservative behavior.

### Phase 9 — Policy operations

Outcome: make policy composition, authoring, testing, and governance understandable before increasing policy scale.

Candidate scope: the evidence-backed subset of `POLICY`, including schema diagnostics, resolved-policy explanation, conflict semantics, test fixtures, diffs, deprecation, and documented precedence.

Exit gate: policy authors can predict the resolved policy, conflicts never resolve silently, invalid configuration fails closed, and frozen contracts remain compatible.

### Phase 10 — CI and durable evidence flow

Outcome: produce trustworthy, deduplicated review evidence across supported GitHub event shapes and reruns.

Candidate scope: the evidence-backed subset of `CI` and `EVIDENCE`, including event coverage, merge queues, fork degradation, concurrency, immutable selection, provenance, retention, comparison, and corruption handling.

Exit gate: supported event paths pass across the declared matrix; stale runs cannot overwrite current evidence; unavailable permissions degrade explicitly; no artifact or cache can escape its repository/run scope.

### Phase 11 — Local evidence explorer

Outcome: let reviewers inspect, compare, and export evidence locally without creating a hosted-control-plane dependency.

Candidate scope: the evidence-backed subset of `DASH` and remaining local `EVIDENCE` work, including provenance views, graph navigation, checklists, before/after comparison, large-report handling, and redacted export.

Exit gate: core evidence is accessible without the dashboard, hostile report content is rendered safely, large reports remain responsive, no default network path exists, and exported data is explicitly caller-selected.

## Decision Gate B — Release-candidate readiness

Gate B asks whether the beta has enough product evidence, compatibility evidence, operational reliability, documentation, and rollback clarity to prepare a stable public candidate.

Possible decisions:

- `prepare-release`: authorize Phase 12 planning, but not publication;
- `improve-core`: return to one named Stage 2 phase;
- `remain-beta`: continue supported beta operation without distribution expansion;
- `stop`: suspend release work and record why.

## Stage 3 — Adoption and ecosystem breadth

### Phase 12 — Adoption and distribution preparation

Outcome: create a reproducible, supportable release candidate and a low-friction adoption path.

Candidate scope: the evidence-backed subset of `ADOPT` and `DIST`, including onboarding, diagnostics, migration notes, support boundaries, reproducible staging, provenance, rollback rehearsal, and post-publication verification plans.

Exit gate: staging artifacts reproduce from the selected commit, installation and rollback paths are verified, documentation matches shipped behavior, and owner approval is recorded separately for every publication or tag mutation.

Publication is not part of this phase unless explicitly authorized at the time of action.

### Phase 13 — One evidence-backed ecosystem adapter

Outcome: prove that Merge Guard can broaden coverage without embedding uncontrolled language- or forge-specific complexity in the core.

Candidate scope: define the smallest stable `ECO` adapter contract, then implement one adapter selected from measured user demand and corpus gaps.

Exit gate: the adapter improves a measured concern family, fails safely when tooling or metadata is absent, obeys local/no-execution defaults, and carries its own fixtures, compatibility matrix, and support boundary. Additional adapters require separate evidence.

## Decision Gate C — Platform breadth

Gate C reviews repeated extension demand, ecosystem maintenance cost, privacy requirements, operational burden, and evidence that the local additive architecture is insufficient.

It may authorize one bounded experiment, defer the idea, or reject it. It does not authorize a public registry, hosted service, unbounded third-party execution, or a breaking release.

## Stage 4 — Strategic bets

### Phase 14 — Extension-surface decision

Outcome: decide whether repeated, concrete demand justifies activating any `EXT` work.

Before implementation, the phase must define trust, capability, install, permission, isolation, revocation, update, compatibility, support, and failure models. If a credible model cannot be demonstrated without weakening local determinism or safety, the correct result is `do not build`.

### Phase 15 — Optional grounded AI experiment

Outcome: test one narrow `AI` use case only if deterministic evidence already exists and the model adds measurable explanatory value.

Entry requires an explicit privacy mode, provider boundary, redaction contract, prompt-injection treatment, provenance rules, cost and latency budgets, deterministic fallback, and a prohibition on unlabelled merge-gating output.

Exit requires a blinded comparison against the deterministic baseline. A non-improvement or unsafe result closes the experiment without productization.

### Phase 16 — Hosted/team or v2 decision

Outcome: decide whether proven needs require `TEAM` capabilities or a `V2` breaking architecture.

Entry requires evidence that additive local work is insufficient, plus a separately approved identity, tenancy, retention, deletion, export, abuse, incident-response, migration, rollback, and operating-cost model. Hosted work and v2 are independent decisions; neither is a default continuation of the roadmap.

## Phase operating contract

Every authorized phase must begin with a delivery issue containing:

- one user-visible outcome and the selected stable initiative IDs;
- evidence for selection and the baseline being improved;
- in-scope and explicitly deferred behavior;
- inputs, outputs, permissions, persistence, network, and execution boundaries;
- compatibility, migration, failure, and rollback behavior;
- measurable acceptance criteria and exact verification commands;
- dependencies and the evidence required at exit;
- documentation and support changes;
- external actions that remain unauthorized.

Every phase should normally land through one bounded pull request or a short, explicitly ordered pull-request stack. A phase closes only after merged evidence demonstrates its exit gate and the roadmap records the result.

## Immediate approval choice

The next sensible approval is:

> Approve the recovery sequence in Phases 1–6, and authorize Phase 1 — Calibration integrity — to begin. Keep Phases 2–6 gated on predecessor evidence, and keep Phases 7–16 conditional or deferred as documented.

If accepted, the first implementation action is to open one Phase 1 delivery issue with the corpus-integrity acceptance criteria above. That issue should not contain product-rule tuning or expansion work.
