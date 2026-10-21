# Merge Guard — Solo-Maintainer Development and Free Beta Roadmap

**Current owner direction:** prioritize Free with no maintainer server budget. [#208](https://github.com/keepithandy/merge-guard/issues/208) starts with explicit local `init` setup. The [local Pro/Team kit proposal](LOCAL_FIRST_PRODUCTS.md) explores downloadable content/convenience; hosted operations are parked and are not a Free prerequisite. Existing MIT features remain Free. No release or billing action is implied.

**Verified status refresh (2026-10-20):** This remains the **active Free development path**, independent of the commercial post-P5 proposal. PR [#193](https://github.com/keepithandy/merge-guard/pull/193) has now merged; P5A/P5B/P5C and support hardening are source-complete at [#200](https://github.com/keepithandy/merge-guard/pull/200)–[#203](https://github.com/keepithandy/merge-guard/pull/203), but do not authorize paid launch. Read the [post-P5 cross-lane status and evidence gates](POST_P5_ROADMAP.md). The declared source version is `1.3.0-beta.2`, not evidence of npm publication.

**Active direction (owner requested October 19, 2026):** One maintainer can build, test and integrate Free product changes using automated checks without mandatory human or peer code-review signoff. Free-user feedback can later supply genuinely independent field evidence. A formal measured accuracy claim remains a different, optional project.

This replaces the former mandatory four-phase independent-evaluation sequence for **ordinary source work and Free beta preparation**. The former protocol is preserved, but is no longer an entry gate, at [the optional independent-evaluation protocol](OPTIONAL_INDEPENDENT_EVALUATION_PROTOCOL.md). This revision is prospective: it does not retroactively mark any failed pilot as passing, revise preregistered thresholds or authorize an external release.

## Decision and factual boundaries

- **Normal source changes and merges do not require a human or peer review approval.** Reproducible regression fixtures and mandatory automated CI, security, compatibility and rollback gates remain required. No second human labeler, adjudicator, 15/15/5 case quota, 50-PR held-out corpus or independent preregistration is required for a normal fix, merge, Free beta source candidate or an explicitly authorized preview release.
- A **passing test suite is evidence of specific behavior**, not proof of real-world accuracy. Phrase findings as "reproduced with these cases", "passes targeted regression tests", and "field performance unknown". Do not claim a verified false-positive *rate*, overall precision, or recall without independent ground truth.
- Keep the **September 2026 stopped pilot** intact: 12/140 actionable precision (8.6%), 12/35 supported-scope recall (34.3%), and no measurable critical recall (zero qualifying high-severity cases). These historical results cannot be relabeled, erased, tuned against or interpreted as proof that the present Free beta is accurate.
- **Existing historical-PR evaluation machinery remains opt-in and strict.** Its two-label schema, preregistration, frozen thresholds, preflight and held-out integrity rules are intentionally unchanged for anyone who later chooses formal quantified evaluation. Those commands are **not on the normal Free beta critical path**. A blocked preflight means "formal evaluation unavailable", not "no source fix allowed".
- The prior formal Phase 1/2/3/4 states are archival, not live blockers on the solo Free path. They are not secretly passed or waived inside the evaluator.
- Privacy, deterministic output, frozen v1 public contracts, no project-command execution, accurate unknown/unsupported states and conservative report semantics still apply.

## Workstream A — Fix review quality as one maintainer

One bounded issue and one PR at a time are preferred. Code changes can be initiated directly from a reproducible problem.

1. **Reproduce:** Capture a minimal source-controlled **synthetic** positive and negative case that isolates the suspected behavior. For real PR examples, retain raw diffs and any source mappings in the ignored local workspace, not GitHub.
2. **Explain:** State the rule, old behavior, desired behavior, expected score/check changes, risks of missed genuine concerns and the rollback path. Mark any owner-only judgment as provisional.
3. **Repair narrowly:** Preserve genuine risk detection, existing public report schema and safety fallbacks. Do not chase lower scores just to look quieter.
4. **Test both directions:** Assertions must fail against the bad behavior and pass after the fix. Test representative true detections, benign counterexamples, determinism and supported runtimes. If no targeted positive control exists, the fix is not ready.
5. **Verify:** Run full test/release checks and wait for all required GitHub Actions jobs on the exact final commit. Preserve machine-verifiable evidence and describe remaining uncertainty.
6. **Integrate:** With green required checks, compatible contracts and documented rollback, source changes can be merged without requiring a peer or manual reviewer. Missing or failed CI blocks merging. External release actions remain separately authorized.

Local PowerShell commands (use `npm.cmd`, since the machine's execution policy blocks the `npm` wrapper):

```powershell
npm.cmd test
npm.cmd run test:security
npm.cmd run test:public-contracts
npm.cmd run release:check
```

`npm.cmd run test:public-contracts` is an optional focused check when a product contract is touched; the full suite and release check are always required. If a command is missing or fails, report that fact rather than treating it as success.

**Completed source example:** PR [#193](https://github.com/keepithandy/merge-guard/pull/193) fixed `world/component.removed` compatibility overmatching and additive `src/index.js` re-export guidance, with synthetic positive and negative cases. It **merged** to `main` at [`864fadb`](https://github.com/keepithandy/merge-guard/commit/864fadbeb39e88c9a8b95bb0a6e9af9a3a12f4fc). Those fixtures support specific behavior only; they do not establish population precision or recall. Select the **next** Free issue from an observed, reproducible problem rather than treating this completed PR as pending. Keep independent fresh-candidate verification before any external release.

## Workstream B — Prepare the Free beta honestly

The existing MIT scanner is Free. Keep all existing Free analysis, offline operation, CLI, Action and local dashboard capabilities available without a license or network dependency.

For any selected Free beta source/release candidate:

- verify reproducible install, CLI and representative action/project scans;
- pass installation, security, performance, public-contract, consumer fixture, artifact/packaging, distribution and full release checks on **one exact commit**;
- verify Windows and Linux supported Node versions where required by CI;
- document known limitations plainly, including that scanner flags are **heuristic review suggestions**, not merge approval, confirmed defects or safety certification;
- include a tested rollback/revert and support path, plus exact candidate artifact identities;
- ensure no raw PR diff, private labels, secrets or usernames are transmitted by the tool; avoid telemetry by default;
- separate completing GitHub source work from **external release mutations**.

The release owner must separately authorize the exact source/artifact/version and allowed publication operations before any npm publish, GitHub tag/release, stable Action-reference move, signing, Marketplace change, Polar checkout/plan publication, upload or telemetry change. Shipping Free need not wait for customers to exist, but **must not be described as independently accuracy-validated**.

## Workstream C — Learn from voluntary users

Use [the Free beta feedback guide](FREE_BETA_FEEDBACK.md) and its optional GitHub issue template to receive reports **only when users choose to submit them**. No passive data collection, automatic network reporting or background telemetry.

For each volunteered report, track separately:

- observed environment and scanner version;
- expected vs. actual rule/findings and a **minimal sanitized reproducer**, if the reporter willingly supplies one;
- whether the report is **unverified**, **reproduced**, **confirmed**, or **not reproducible**;
- whether changes remove false alarms **without hiding true warnings**;
- a positive fixture, a negative fixture, and the exact fixing commit.

Never treat self-selected issue reports as representative samples of all Free users. Their counts and trend categories help prioritize regressions but **cannot produce population precision, recall or specificity**. Do not request private repository contents, tokens, proprietary logs, user identities or whole raw diffs in public issues. Always accept a report with no source attached.

If enough appropriately consented, outcome-grounded independent evidence later becomes available, the owner may authorize a **separate formal evaluation** using the versioned historical-PR evaluator, its true two-human-label requirement, frozen calibration/held-out controls and preregistered gates. That is optional research, not a retroactive prerequisite to the Free version.

## Free development/release decision table

| Decision | Solo-maintainer evidence required | Independent human labels? |
| --- | --- | --- |
| Investigate a warning | Minimal reproducer and clear limitations | **No** |
| Propose or merge a contained rule fix | Positive and negative regressions, green required CI, compatibility/security and rollback; no human signoff | **No** |
| Prepare a Free beta candidate | Full release/packaging/consumer gates, known limitations and immutable candidate | **No** |
| Publish or update externally | **Separate explicit owner authorization** naming exact artifacts/actions, plus release gates | **No** |
| Claim statistically measured precision/recall against independent ground truth | Fresh verified labeled corpus, proper denominators, provenance and strict optional evaluation protocol | **Yes**, for that claim only |

## Safety and status

No script, CI gate or comment may silently reinterpret the September failed pilot as PASS. If a test is skipped, unavailable or failed, describe it precisely. All per-user raw content stays local unless a reporter voluntarily supplies a sanitized example. Passing CI does not authorize publishing or imply that the analyzer identified every problem.

This roadmap is the **active development and Free preview track**. Future Free candidate release decisions are tracked under [P7 in the post-P5 roadmap](POST_P5_ROADMAP.md) as a **proposal for sequencing**, not a Free publication authorization; the present Free source-fix workflow remains valid. [Historical independent-evaluation requirements](OPTIONAL_INDEPENDENT_EVALUATION_PROTOCOL.md), [the evaluation design](EVALUATION_HARNESS_DESIGN.md), and [historical intake instructions](pilot-corpus-intake.md) remain available only for future independently validated efficacy claims. The [long-horizon roadmap](LONG_HORIZON_ROADMAP.md) remains an unapproved idea registry. Major hosted, telemetry, AI, code-execution or commercial changes still require separate scope, security and owner decisions.
