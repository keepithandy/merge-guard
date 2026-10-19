# Proposed library risk-signal precision fix (PR #193)

**Status: implemented on an unmerged draft branch; eligible for the solo owner's source-review/merge decision after final regression, release/security/compatibility CI and rollback checks.** The current [solo-maintainer Free beta roadmap](PHASE_ROADMAP.md) **does not require a second reviewer, formal Phase 1 PASS, large independently labeled corpus or Phase 2 research authorization** to merge a bounded Free fix. This PR is still **not** an independently validated accuracy improvement, and source merge does not authorize an external release.

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

## Solo-owner merge checks and rollback

- Verify the exact final source commit, the positive/negative regression suite, complete `npm.cmd test` / `npm.cmd run release:check`, and all required GitHub Actions across supported Windows/Linux Node versions. The solo owner can approve the source merge after reviewing the diff and limitations; **no second human reviewer or independent pilot is mandatory**.
- Review both possible failure directions: this fix reduces noisy warnings for synthetic `component.removed` events and additive library re-exports, but must not miss explicit deprecations/breakages, actual navigation or removal of public exports. The tests cover these cases; unknown field behavior remains unmeasured.
- The policy-pack content hash changes intentionally with the `1.0.1` version. Existing frozen v1 report schemas remain unchanged; verify consumer/Action/SARIF, determinism, security and policy snapshot coverage.
- **Rollback:** revert this PR's changes to `src/analyzeDiff.js` and `policies/starter/library.json` together; the original conservative filename rule and `1.0.0` keyword matcher then return. Re-run focused and release-readiness checks.
- Do **not** claim a measured precision/recall improvement, conceal the old September pilot stop result or infer that self-selected future user reports represent population-level accuracy.
- Separate explicit owner authorization is still required for any npm/GitHub publication, tag, stable Action ref, Marketplace or payment action. Free user reports are voluntary and must not transmit source automatically.

A future independent, statistically defensible efficacy study remains [optional](OPTIONAL_INDEPENDENT_EVALUATION_PROTOCOL.md), using its unchanged strict evaluator. It is not the gate for this Free source fix.
