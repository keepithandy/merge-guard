# Merge Guard Strict Phase Roadmap

Status: **approval draft**. Roadmap approval does not authorize implementation.

## Objective

Prove that Merge Guard is useful before adding anything else.

The complete executable sequence is:

> evidence and diagnosis → repair and freeze → independent proof → stable candidate → separate publication decision

There are four phases. Only one may be active. The [long-horizon roadmap](LONG_HORIZON_ROADMAP.md) is an idea registry, not an execution queue. Reviewer expansions, repository intelligence, policy work, dashboards, adapters, plugins, AI, hosted services, team features, and v2 are outside this plan.

## Authority

The documents have two roles:

- This file is the only phase sequence.
- [The long-horizon roadmap](LONG_HORIZON_ROADMAP.md) describes unapproved possibilities.

[The canonical roadmap](../ROADMAP.md), [the execution history](ROADMAP_EXECUTION.md), and [the evaluation design](EVALUATION_HARNESS_DESIGN.md) provide product state and evidence contracts. If wording conflicts, implemented machine-readable gates control metrics, and the stricter safety or authorization boundary controls behavior.

## Non-negotiable rules

1. Only one phase may be authorized at a time. Range approvals are invalid.
2. `PASS` makes the next phase eligible; it does not start it.
3. `FAIL` locks every successor. Recovery requires a new owner-approved roadmap revision.
4. Missing, disputed, invalid, or insufficient evidence is `FAIL`, never a partial pass.
5. A phase gets one authorized attempt. No automatic retries or hidden tuning loops.
6. Scope, gates, inputs, allowed GitHub actions, and external permissions freeze at authorization.
7. Calibration identity freezes before the official Phase 1 validation run. Held-out identity freezes at Phase 3 preregistration.
8. A scope or threshold change voids the attempt and returns `FAIL`.
9. Completed held-out cases are never inspected for tuning.
10. Downstream work, opportunistic features, and unrelated cleanup are forbidden.
11. Analysis remains local, deterministic, read-only, and useful without an account or API key.
12. Merge Guard never executes project code, discovered commands, or suggested checks.
13. Raw corpus data, labels, source excerpts, identities, paths, and per-case results remain local and ignored.
14. Unknown, unsupported, failed, and insufficient evidence never becomes a clean result.
15. Frozen v1 contracts remain compatible.
16. Every product change needs a measured reason, positive and negative fixtures, compatibility coverage, and rollback.
17. Publication, signing, tags, releases, Marketplace changes, stable Action-reference movement, telemetry, uploads, and hosted persistence always require separate exact authorization.

## Status model

| Status | Meaning |
| --- | --- |
| `LOCKED` | Work is forbidden. |
| `READY` | Entry evidence exists, but explicit phase authorization is still required. |
| `ACTIVE` | The owner authorized this phase against an exact roadmap commit. |
| `PASS` | Every binary exit condition has objective evidence. |
| `FAIL` | At least one exit, evidence, integrity, or authorization condition failed. Stop. |

There is no `mostly done`, `improve`, `insufficient`, or implied approval state.

## Fixed beta gate

The source of truth is `PILOT_THRESHOLDS` in `src/historicalPrPreregistration.js`:

| Gate | Pass condition |
| --- | --- |
| Held-out cases | At least 50 |
| Repository aliases | At least 5 |
| Supported concerns | At least 15 |
| Low-risk controls | At least 15 |
| Actionable precision | At least 70% |
| Critical supported-scope recall | At least 80%, with at least 5 high-severity supported concerns |
| Median unmatched positive-weight findings | No greater than 1 per PR |
| Clean-PR specificity | At least 70% |
| Median default-path setup | No greater than 5 minutes |
| p95 analysis time | No greater than 3,000 ms below the documented size limit |
| Integrity | No privacy, determinism, frozen-v1 compatibility, or evidence-integrity regression |

Overall supported-scope recall must be reported with its numerator and denominator. The implementation does not define a separate numeric threshold for it, so this roadmap does not invent one.

Changing a gate requires a new roadmap commit and explicit owner approval before a phase starts. A gate can never change after results are visible.

## Baseline — immutable, not a phase

The first held-out pilot remains immutable evidence:

- decision: `stop`;
- actionable precision: 12/140, or 8.6%, fail;
- overall supported-scope recall: 12/35, or 34.3%, materially low but not a separate implemented gate;
- critical recall: insufficient evidence because the denominator was zero;
- median unmatched findings: 1, pass;
- clean-PR specificity: 11/15, or 73.3%, pass;
- median setup: 1 minute, pass;
- p95 runtime: 4 ms, pass.

These held-out cases may not be relabeled, removed, reinterpreted, or used to select a repair.

## Sequence ledger

| Phase | Outcome | State | Binary exit |
| --- | --- | --- | --- |
| 1 | Trustworthy calibration evidence and at most three repair hypotheses | `READY` | Evidence and diagnosis requirements all pass |
| 2 | One repaired, immutable product candidate | `LOCKED` | Calibration and complete release gates all pass on one commit |
| 3 | One fresh preregistered held-out result | `LOCKED` | Every fixed beta and integrity gate passes |
| 4 | One supportable, reproducible stable candidate | `LOCKED` | Installation, CI, security, compatibility, docs, staging, and rollback all pass |
| Publication | Release exact reviewed bytes | Separately controlled | Exact owner authorization is executed and verified |

## Phase 1 — Evidence and diagnosis

Outcome: trustworthy calibration evidence and no more than three bounded repair hypotheses.

Allowed work:

- caller-owned calibration evidence;
- evaluation-only validation, duplicate/leakage detection, ablation, and reporting tools;
- tests and documentation for those tools;
- content-free summaries.

Forbidden work:

- analyzer, scoring, rule, threshold, or public-contract changes;
- held-out inspection or execution;
- synthetic or model-generated evidence presented as independent human judgment;
- more than three repair hypotheses.

Binary exit — every item must pass:

- at least 15 supported calibration concerns;
- at least 15 low-risk calibration controls;
- at least 5 high-severity supported calibration concerns;
- exactly two genuinely independent label decisions and a visible adjudication state for every included case;
- allowed, outcome-grounded provenance for every included case;
- zero case, repository-alias, or disallowed ancestry overlap with held-out data;
- duplicate, disputed, corrupt, unsupported, and excluded cases remain visible;
- corpus validation and the frozen calibration run pass;
- unmatched findings and missed concerns are reported by stable family and path class;
- ablation, numerator, denominator, exclusion, and uncertainty data are recorded;
- one to three repair hypotheses are ranked, each with evidence, expected metric effect, fixture plan, compatibility risk, and rollback;
- production behavior diff is empty;
- evaluation-design, historical-evaluation, and full release checks pass.

If authentic cases or independent labels are unavailable, Phase 1 is `FAIL`.

### Copy-ready Phase 1 prompt

```text
AUTHORIZE PHASE 1 against roadmap commit <FULL_ROADMAP_COMMIT_SHA>.
Allowed GitHub actions: create one issue; create and push one codex/phase-1-evidence-diagnosis branch; open one PR; merge only after PASS; close the issue.
External release actions: none.

Execute Phase 1 — Evidence and diagnosis — only. Verify the authorization names the current roadmap commit and that no other phase is ACTIVE; otherwise return FAIL immediately. Freeze the phase scope and gates now. Work only on caller-owned calibration evidence, evaluation-only tooling, tests, documentation, and content-free summaries. Do not change analyzer rules, scoring, thresholds, public product behavior, or held-out data.

Build and freeze a calibration set with at least 15 supported concerns, 15 low-risk controls, and 5 high-severity supported concerns. Require exactly two genuinely independent label decisions, visible adjudication, and allowed outcome-grounded provenance for every included case. Prove zero case, repository-alias, or disallowed ancestry overlap with held-out data. Keep disputed, duplicate, corrupt, unsupported, and excluded cases visible. Never substitute synthetic or model-generated agreement for human evidence.

Run corpus validation and a new calibration output path. Inventory unmatched findings and missed supported concerns by stable family and path class. Record ablations, numerators, denominators, exclusions, uncertainty, and overall supported-scope recall. Select at most three ranked repair hypotheses; for each, record its evidence, expected metric effect, positive and negative fixture plan, compatibility risk, and rollback.

Run:
- npm run eval:historical-prs -- --corpus <CALIBRATION_CORPUS_PATH> --mode validate
- npm run eval:historical-prs -- --corpus <CALIBRATION_CORPUS_PATH> --mode run --partition calibration --output <NEW_CALIBRATION_OUTPUT_PATH>
- npm run test:evaluation-design
- npm run test:historical-pr-evaluation
- npm run release:check

Return PASS only if every Phase 1 exit condition succeeds and production behavior is unchanged. Otherwise record the exact failed condition in the issue, return FAIL, close the issue as failed, do not merge delivery code, and stop. On PASS, open the single PR, wait for every required check, merge, close the issue, and record the evidence. Do not start Phase 2 or publish anything.
```

## Phase 2 — Repair and freeze

Outcome: one corrected, immutable candidate commit.

Allowed work:

- only the one to three hypotheses passed by Phase 1 and named in the Phase 2 authorization;
- focused product changes, fixtures, compatibility coverage, measurement, and rollback documentation.

Forbidden work:

- a fourth hypothesis or rule family;
- unrelated cleanup or capabilities;
- held-out inspection, execution, replacement, or tuning;
- gate, metric, label, or corpus changes.

Binary exit — every item must pass on one commit:

- actionable precision is at least 70% on frozen calibration;
- critical supported-scope recall is at least 80% with a denominator of at least 5 on frozen calibration;
- median unmatched findings is no greater than 1;
- clean-PR specificity is at least 70%;
- overall supported-scope recall is reported without an invented pass threshold;
- every changed rule has measured before/after evidence, positive and negative fixtures, compatibility coverage, and rollback;
- privacy, determinism, security, performance, and frozen-v1 compatibility do not regress;
- evaluation-design, historical-evaluation, and full release checks pass;
- one full candidate commit SHA is recorded and frozen.

Any miss is `FAIL`; it does not authorize another tuning round.

### Copy-ready Phase 2 prompt

```text
AUTHORIZE PHASE 2 against roadmap commit <FULL_ROADMAP_COMMIT_SHA>.
Authorized repair hypotheses: <EXACT_PHASE_1_HYPOTHESIS_IDS, MAXIMUM_THREE>.
Allowed GitHub actions: create one issue; create and push one codex/phase-2-repair-freeze branch; open one PR; merge only after PASS; close the issue.
External release actions: none.

Execute Phase 2 — Repair and freeze — only. Start only if Phase 1 is PASS, this authorization names the exact accepted hypotheses and current roadmap commit, and no other phase is ACTIVE. Otherwise return FAIL. Freeze scope and gates now.

Implement only the named hypotheses, never more than three. Do not inspect, run, replace, relabel, or tune against held-out data. Do not change metrics, PILOT_THRESHOLDS, corpus membership, public contracts, or unrelated capabilities. For every product change add measured before/after calibration evidence, positive and negative fixtures, frozen-v1 compatibility coverage, and a rollback path. Preserve explicit unknown, unsupported, disputed, failed, and insufficient-evidence states.

On the frozen calibration set require actionable precision >=70%, critical supported-scope recall >=80% with denominator >=5, median unmatched findings <=1, and clean-PR specificity >=70%. Report overall supported-scope recall with numerator and denominator without inventing a gate.

Run:
- npm run eval:historical-prs -- --corpus <FROZEN_CALIBRATION_CORPUS_PATH> --mode validate
- npm run eval:historical-prs -- --corpus <FROZEN_CALIBRATION_CORPUS_PATH> --mode run --partition calibration --output <NEW_PHASE_2_OUTPUT_PATH>
- npm run test:evaluation-design
- npm run test:historical-pr-evaluation
- npm run test:security
- npm run test:performance
- npm run release:check

Return PASS only if every Phase 2 condition passes on one exact commit. Record and freeze its full SHA. At the first miss, record FAIL in the issue, close it as failed, do not merge delivery code, and stop; do not add a hypothesis or tuning round. On PASS, open the single PR, wait for every required check, merge, close the issue, and record the candidate SHA. Do not start Phase 3 or publish anything.
```

## Phase 3 — Independent proof

Outcome: one fresh, independently labeled, preregistered held-out result for the exact Phase 2 candidate.

Allowed work:

- caller-owned held-out evidence;
- validation, preregistration, one held-out run, and content-free result recording.

Forbidden work:

- any product, metric, threshold, or label change;
- any post-registration case, exclusion, or corpus change not permitted by the preregistered exclusion rule;
- retries;
- raw or per-case evidence in Git.

Required order:

1. Verify the exact Phase 2 candidate.
2. Validate at least 50 fresh held-out cases from at least 5 non-calibration repository aliases, with at least 15 supported concerns, 15 low-risk controls, and 5 high-severity supported concerns.
3. Verify exactly two independent labels per case, provenance, exclusions, duplicates, ancestry, and zero calibration overlap.
4. Preregister the complete corpus, product, metric, and unchanged threshold identities.
5. Run the held-out partition once.
6. Preserve the immutable local evidence and commit only its content-free result.

Binary exit: every fixed beta and integrity gate passes and the harness recommendation is `proceed`. `Improve`, `stop`, `insufficient-evidence`, a metric miss, an invalid run, or missing authentic evidence is `FAIL`.

### Copy-ready Phase 3 prompt

```text
AUTHORIZE PHASE 3 against roadmap commit <FULL_ROADMAP_COMMIT_SHA> and frozen product commit <FULL_PHASE_2_CANDIDATE_SHA>.
Allowed GitHub actions: create one issue; create and push one codex/phase-3-independent-proof branch containing content-free evidence only; open one evidence PR; merge the content-free evidence record after integrity checks even when the phase result is FAIL; close the issue with the exact result.
External release actions: none.

Execute Phase 3 — Independent proof — only. Verify Phase 2 is PASS, both authorized SHAs are exact, and no other phase is ACTIVE; otherwise return FAIL. Do not change product code, metrics, thresholds, labels after freeze, or public behavior.

Use a fresh held-out corpus never used for tuning. Require at least 50 cases, 5 repository aliases not used by calibration, 15 supported concerns, 15 low-risk controls, 5 high-severity supported concerns, exactly two independent labels per case, allowed provenance, and zero case, alias, or disallowed ancestry overlap with calibration. Validate before preregistration. Preregister the complete corpus identity, label identity, metric implementation, unchanged PILOT_THRESHOLDS, and exact Phase 2 product commit. Then run the held-out partition once. No retry, relabeling, case removal, exclusion change, product change, or threshold change is allowed after preregistration except an exclusion already permitted by the preregistration.

Run:
- npm run eval:historical-prs -- --corpus <FRESH_HELD_OUT_CORPUS_PATH> --mode validate
- npm run eval:historical-prs -- --corpus <FRESH_HELD_OUT_CORPUS_PATH> --mode preregister --output <NEW_PREREGISTRATION_PATH> --product-commit <FULL_PHASE_2_CANDIDATE_SHA> --recorded-at <UTC_ISO_TIMESTAMP>
- npm run eval:historical-prs -- --corpus <FRESH_HELD_OUT_CORPUS_PATH> --mode run --partition held-out --output <NEW_HELD_OUT_OUTPUT_PATH> --preregistration <NEW_PREREGISTRATION_PATH> --product-commit <FULL_PHASE_2_CANDIDATE_SHA>
- npm run test:evaluation-design
- npm run test:historical-pr-evaluation
- npm run release:check

Return PASS only if every fixed beta gate and integrity condition passes and the harness recommendation is proceed. Treat improve, stop, insufficient evidence, any metric miss, invalid execution, or missing authentic evidence as FAIL. Preserve raw corpus and per-case output locally and ignored. Record the immutable content-free result in the issue and evidence PR regardless of outcome, merge that record after its integrity checks pass, close the issue, and stop. Do not retry, start Phase 4, or publish anything.
```

## Phase 4 — Stable candidate

Outcome: one supportable and reproducible candidate, ready for a separate publication decision.

Allowed work:

- stabilization, packaging, documentation, provenance, installation, CI, support, and rollback work that cannot change proven analysis behavior.

Forbidden work:

- analyzer, rule, scoring, metric, threshold, or evidence-semantic changes;
- new repository intelligence, policies, dashboards, adapters, plugins, AI, hosted services, team features, or v2 contracts;
- any public mutation.

Binary exit — every item must pass on one immutable candidate:

- the Phase 3 result is `PASS`;
- analysis behavior is identical to the proven candidate;
- installation, security, public-contract, release-artifact, distribution, support, and full release gates pass;
- the required GitHub matrix passes on the same candidate;
- staged artifacts reproduce exactly;
- clean install, upgrade, uninstall, failure recovery, and rollback are verified;
- documentation and known limitations match the bytes;
- source, artifact, test, pilot, provenance, and rollback identities agree;
- no package, release, tag, signature, Marketplace state, or stable Action reference changed.

Any analysis-behavior change invalidates the proof and returns `FAIL`.

### Copy-ready Phase 4 prompt

```text
AUTHORIZE PHASE 4 against roadmap commit <FULL_ROADMAP_COMMIT_SHA>, proven product commit <FULL_PHASE_2_CANDIDATE_SHA>, and passing Phase 3 evidence commit <FULL_PHASE_3_EVIDENCE_SHA>.
Allowed GitHub actions: create one issue; create and push one codex/phase-4-stable-candidate branch; open one PR; merge only after PASS; close the issue.
External release actions: none.

Execute Phase 4 — Stable candidate — only. Start only if Phase 3 is PASS, all three authorized SHAs are exact, and no other phase is ACTIVE; otherwise return FAIL. Freeze scope and gates now. Preserve the analysis, rule, scoring, metric, threshold, and evidence semantics proven in Phase 3.

Perform only release-blocking stabilization, packaging, documentation, provenance, installation, supported CI, support, and rollback work. Do not add repository intelligence, policies, dashboard features, adapters, plugins, AI, hosted services, team features, v2 contracts, or other capabilities. Produce one immutable candidate with reproducible staged artifacts, verified clean install, upgrade, uninstall, failure recovery, rollback, accurate docs, known limitations, and consistent source/artifact/test/pilot/provenance identities.

Run:
- npm run test:installation
- npm run test:security
- npm run test:public-contracts
- npm run test:release-artifacts
- npm run test:distribution
- npm run test:support
- npm run release:check
- npm run release:stage -- <NEW_LOCAL_RELEASE_EVIDENCE_PATH>
- every required GitHub workflow on the same candidate

Return PASS only if all evidence names one immutable candidate and staged bytes reproduce exactly. Any analysis-behavior change or failed condition is FAIL: record it, close the issue as failed, do not merge delivery code, and stop. On PASS, open the one PR, wait for the complete required matrix, merge, close the issue, and record the exact candidate and artifact hashes. Do not publish, tag, sign, upload, change Marketplace state, move a stable Action reference, or start long-horizon work.
```

## Publication decision — not a phase

Phase 4 `PASS` authorizes nothing external. Publication needs a new owner message naming exact immutable subjects and actions.

### Copy-ready publication authorization template

```text
AUTHORIZE PUBLICATION of source commit <FULL_SHA> and staged artifact SHA-256 <SHA256> for version <EXACT_VERSION>.
Allowed actions: <EXACT_LIST: npm publish, GitHub tag, GitHub release, signature/provenance upload, Marketplace update, stable Action reference movement>.
Release channel and visibility: <EXACT_CHANNEL_AND_VISIBILITY>.
Required verification after each action: <EXACT_COMMAND_OR_OBSERVATION>.
Rollback trigger and target: <EXACT_TRIGGER_AND_IMMUTABLE_TARGET>.
No unlisted external action is authorized. Stop on the first mismatch or failed verification.
```

Unfilled placeholders or broad wording make the authorization invalid.

## After publication

There is no Phase 5.

A future roadmap may select exactly one problem from the long-horizon registry only after repeated evidence from more than one independent repository or reviewer. It must define one measurable outcome, deterministic proof, permissions, privacy, execution, persistence, network, compatibility, rollback, and explicit non-goals.

Without that evidence and a new approved roadmap, plugins, AI, hosted/team features, ecosystem expansion, and v2 remain **do not start**.

## Immediate approval syntax

Approving the order and authorizing work are separate messages.

Sequence approval:

```text
APPROVE the four-phase order in docs/PHASE_ROADMAP.md at commit <FULL_ROADMAP_COMMIT_SHA>. This approves ordering only and authorizes no phase or external action.
```

First work authorization:

```text
AUTHORIZE PHASE 1 against roadmap commit <FULL_ROADMAP_COMMIT_SHA>.
Allowed GitHub actions: create one issue; create and push one codex/phase-1-evidence-diagnosis branch; open one PR; merge only after PASS; close the issue.
External release actions: none.
```

Nothing else moves.
