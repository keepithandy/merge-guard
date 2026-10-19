# Calibration-only policy characterization: library compatibility and entry signals

**Status:** **Preparatory test cases only**, not an accuracy measurement or an approved repair hypothesis. See [the strict phase roadmap](PHASE_ROADMAP.md). Formal Phase 1 is not PASS; Phase 2 remains LOCKED. Production analyzer and starter policy bytes must remain unchanged.

## Why these probes exist

A locally observed, owner-supplied Pulse Engine PR #21 diff produced `routing-or-entry` on the path `src/index.js` with **zero** matching navigation-code lines. Applying the explicit library starter policy also produced `compatibility-marker-change` on the string `world/component.removed`. An independently constructed minimal synthetic probe repeated the compatibility warning. A positive probe containing an explicit `BREAKING: removed the public createWorld() API` notice also produced that warning.

These are reproducible **match mechanisms**, not adjudicated false positives and not evidence of any historical release defect. The library policy legitimately detects the PR's new public exports. Do not generalize this example into accuracy statistics.

## Automated, deterministic probes

Run the synthetic-only contract suite:

```powershell
npm.cmd run test:evaluation-policy-characterization
```

The three committed fixtures, under `test/fixtures/evaluation-hypotheses/`, deliberately contain **invented one-line diffs, not private PR data**.

| Fixture | Present behavior that CI characterizes | Future desired distinction (not yet an executable pass condition) |
| --- | --- | --- |
| `library-component-event.diff` | Library compatibility warning, weight **+3**, one line and one path match | An event type containing `removed` alone should not imply public API breakage |
| `library-breaking-notice.diff` | Library compatibility warning, weight **+3**, one line and one path match | Continue detecting explicit breaking/deprecation declarations |
| `library-export-only.diff` | Built-in `routing-or-entry` warning, weight **+2**, path-only / zero matching lines; library public-API warning, weight **+4** | Distinguish library public exports from navigation guidance, without losing real entry-point or export-contract coverage |

The characterization tests **pass with today's code**, thereby freezing the present behavior for diagnosis. They **do not yet protect the desired behavior**. When a repair is authorized, the responsible engineer must replace the event-name assertion with an assertion that no compatibility rule fires, retain the positive control, add independent real-world positive/negative regression coverage, and measure the entire frozen calibration corpus. A passing characterization test is not proof that a fix has been implemented.

## Formal evidence and change-control blockers

- The user's local `.merge-guard-pilot/` ledger and case data remain **local and ignored**; do not commit or upload real diffs, labels, PR source, and per-case outputs.
- The Pulse Engine example is still a pending candidate: two genuine independent reviewers, outcome-grounded provenance, ancestry exclusion against held-out data, and observed setup duration have not been verified.
- Do not count these synthetic tests toward the 15 supported calibration concerns, 15 low-risk controls, or 5 high-severity concerns. They are engineering **contracts**, not independently labeled human judgments.
- At most three evidence-based hypotheses can be selected during an explicitly authorized Phase 1. The two observations above are **unranked questions** until that phase produces qualifying evidence.
- No analyzer, scoring, policy, threshold, public schema, frozen held-out data, or publication action is changed here.
