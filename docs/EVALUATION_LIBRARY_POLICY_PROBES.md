# Proposed library risk-signal precision fix (PR #193)

**Status: implemented on an unmerged draft branch; not authorized for release or merge.** The [strict phase roadmap](PHASE_ROADMAP.md) still requires a genuine, independently verified Phase 1 PASS followed by specific owner authorization before an official Phase 2 rule repair can be merged. This PR's code changes are a **requested experimental candidate**, not a compliant Phase 2 attempt or a measured accuracy improvement.

## Problem reproduced

The previous library starter policy matched the substring `removed` anywhere in an added source line. Thus an ordinary event name such as `world/component.removed` generated the +3 **Compatibility marker changed** rule, even though this event name alone says nothing about public API compatibility. A separate built-in rule matched `src/index.js` based on its filename even when the only changed line was an additive module re-export; the suggested navigation test was misleading.

The owner observed both mechanisms in local read-only scans while examining a Pulse Engine change, then reproduced the first with a minimal single-line fixture. The real example is **still not independently adjudicated calibration evidence**. No private source diff, labels, reviewer identities, or local evaluation output are checked into GitHub.

## Targeted code changes on this draft

1. **Library compatibility rule:** Starter policy `merge-guard.starter.library` is bumped from `1.0.0` to `1.0.1` and the `compatibility-marker-change` line regex now requires contextual signals such as `BREAKING`, `@deprecated`, `DEPRECATED:`, or explicitly stated public API, export, function, method, or support removal. An event type containing `removed` alone no longer triggers. Genuine breaking/deprecation notices retain the +3 compatibility signal.
2. **Built-in routing/entry rule:** A `src/index.js`-like file whose added executable lines consist **only** of simple single-line `export { ... } from "module";` or `export * from "module";` statements, with no removed lines, no longer triggers the generic routing/entry warning based solely on its filename. All other index edits, export deletions, navigation calls, and route-file changes retain the existing detection logic. Ambiguous or multiline export syntax falls back to the old review signal.
3. **Public library API rule:** Unchanged. An additive re-export in `src/index.js` remains covered by the explicit library starter policy's +4 `public-api-change` rule and exported-API compatibility check.

No scoring thresholds, output schemas, evaluation metrics, commercial entitlements, or held-out pilot data change.

## Positive and negative regression coverage

Run from the repository root:

```powershell
npm.cmd run test:evaluation-policy-characterization
npm.cmd run test:policies
npm.cmd run test:snapshots
npm.cmd test
npm.cmd run release:check
```

The automated suite `scripts/evaluation-policy-characterization-contracts.js` uses **synthetic-only** fixtures under `test/fixtures/evaluation-hypotheses/`.

| Test | Expected corrected behavior |
| --- | --- |
| Component-removal event name | No compatibility warning or +3 points |
| Explicit `BREAKING` public API removal | Compatibility warning retained, +3 |
| `@deprecated`, `DEPRECATED:`, public function/support removal | Compatibility warning retained, +3 |
| Non-API identifier `removed` and `worker/deprecated` event | No compatibility warning |
| Pure added `src/index.js` re-export | No generic `routing-or-entry` or navigation guidance |
| Same export with `navigate("/dashboard")` | Routing/entry warning retained, +2 |
| Non-export index setup edit | Routing/entry warning retained, +2 |
| Deleted export | Existing entrypoint warning retained, +2 |
| Explicit `src/router.js` navigation | Routing warning retained, +2 |
| Additive `src/index.js` export with library policy | Library public API warning retained, +4 |

The regression tests establish **specific rule behavior**, not population-level precision/recall. Passing CI is necessary but not sufficient for a release claim.

## Evidence and rollback gates before merge

- The strict roadmap has Phase 1 READY but not PASS and Phase 2 LOCKED. Merge is blocked until independent labels, provenance, held-out ancestry separation, sufficient calibration counts, approved Phase 1 hypotheses, and specific Phase 2 authorization are documented.
- Evaluate against the **same frozen, independently reviewed calibration corpus** with the reproducible measurement/compare workflow. Record full commit identities, each metric's numerator/denominator, noise, specificity, critical recall, privacy/determinism, and positive/negative case outcomes. Never tune against the old held-out pilot.
- The policy-pack content hash changes intentionally with the `1.0.1` version. Existing frozen v1 report schema remains unchanged, but check consumer/Action/SARIF contracts and policy snapshot compatibility on both Windows and Linux.
- **Rollback:** revert this PR's changes to `src/analyzeDiff.js` and `policies/starter/library.json` together; the original conservative filename rule and `1.0.0` keyword matcher then return. Re-run all regression and release-readiness checks.
- If authorized criteria cannot be met, **do not merge** this experimental fix or describe it as a formal Phase 2 PASS.
