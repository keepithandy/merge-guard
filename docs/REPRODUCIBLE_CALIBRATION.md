# Repeatable calibration measurement — real pull requests

Status: **preparatory evaluation workflow**, not a Phase 1 PASS or Phase 2 authorization. The strict [phase roadmap](PHASE_ROADMAP.md) governs authorization, preregistration, rollback, and publication. These scripts do not change scanner rules or evaluation thresholds.

## 1. Prepare real evidence, without treating a download as a label

Maintain private source-to-alias mappings and source outcome evidence only in the Git-ignored `.merge-guard-pilot/` workspace. Before accepting a real PR case:

1. Verify permission to use the material and the PR's actual identity, merge outcome, and whether it appeared in the previous held-out evaluation. Search the private intake ledger; do not reuse held-out or related ancestry as calibration.
2. Store one bounded, sanitized unified diff under `.merge-guard-pilot/calibration-corpus/cases/<opaque-case-id>/change.diff`. Confirm diff metadata and contents contain no credentials or identifying data that should not be shared; do not commit it. The evaluation runner is local, but filenames and paths are still private.
3. Record the original source URL, real source identity, duplicate/ancestry checks, and observed setup start/finish time in the **private** ledger. Give the manifest a numeric, *observed* `setupMinutes`. A missing measurement must remain missing; do not fabricate a zero.
4. Obtain two independent **human** include/exclude decisions before anyone sees the other's conclusion. Then adjudicate, record truthful `lowRisk`, supported and unsupported concerns, severity, actual affected paths, outcome-grounded provenance, and preserve disagreements and exclusions. Do not use an AI-generated second review.
5. Use the versioned [manifest and labels schemas](historical-pr-evaluation.md) and the [pilot intake guide](pilot-corpus-intake.md). A blank labels file, a single review, or a structurally valid synthetic case is not qualifying evidence.

For the user's initial Pulse Engine PR #21 candidate, a local diff was downloaded but setup time, independent reviewer B, outcome evidence, and held-out overlap are not verified. **Keep this candidate unqualified until those checks succeed.** Do not generate fake `labels.json` just to make the validation command green.

## 2. Validate and audit before running anything

Use a **calibration-only corpus**: do not include held-out entries in its manifest or mounted directories. Run all commands from the Merge Guard repository root:

```powershell
npm run eval:calibration-preflight -- --corpus .merge-guard-pilot/calibration-corpus
npm run eval:historical-prs -- --corpus .merge-guard-pilot/calibration-corpus --mode validate
```

The preflight requires at least 15 nonsynthetic supported concerns, 15 low-risk controls, and 5 high-severity nonsynthetic supported concerns, plus supported structural checks. It detects exact duplicate diff hashes, rejected or unresolved adjudication, and absent label decisions. A result of `human-verification-required` is *not* proof of independent labeling, authenticity, ancestry separation, or Phase 1 PASS.

The older evaluator is the metric authority. The new scripts call that evaluator unchanged; synthetic regression fixtures test mechanics only.

## 3. Record reproducible local measurements (when permitted)

Use a new, never-existing output directory each time. The product SHA is a **caller assertion**; these scripts do not fetch GitHub or verify HEAD.

```powershell
$baseline = (git rev-parse HEAD).Trim()
npm run eval:calibration-measure -- --corpus .merge-guard-pilot/calibration-corpus --output .merge-guard-pilot/baseline-01 --product-commit $baseline
```

This command:

- checks calibration-only partition metadata **before reading case files**; never runs held-out data;
- blocks invalid, incomplete, underpowered, disputed, or duplicate calibration input;
- evaluates a valid calibration-only corpus without running project code;
- writes `metadata.json` (corpus content hash including labels/configurations, manifest identity, metric source hash and asserted product SHA), `aggregate.json` (metrics and broad diagnosis), and `case-results.json` (private per-case evidence) in the new ignored directory;
- reports `provisional-human-verification-required`, **never PASS**, even if all numerical quotas are met.

Record the product commit, frozen corpus content identity, metric identity, and human evidence approvals in the private ledger before authorizing any real repair. Do not tune a rule based on held-out pilot results. A real product repair may begin **only** after the formal Phase 1 PASS and specific owner-approved Phase 2 hypothesis IDs and commit.

## 4. Compare a single approved hypothesis with the exact same corpus

On an approved candidate commit, without changing calibration membership, labels, configuration, metrics or thresholds:

```powershell
$candidate = (git rev-parse HEAD).Trim()
npm run eval:calibration-measure -- --corpus .merge-guard-pilot/calibration-corpus --output .merge-guard-pilot/candidate-01 --product-commit $candidate

npm run eval:calibration-compare -- --baseline .merge-guard-pilot/baseline-01 --candidate .merge-guard-pilot/candidate-01 --output .merge-guard-pilot/comparison-01.json
```

The comparison fails closed on a changed corpus/label hash, metric implementation hash, manifest, case membership, input/configuration hashes, denominators, or held-out partition. It reports content-free before/after precision, supported-scope recall, critical recall, specificity, median unmatched findings, and stable rule-family/path-class diagnosis deltas. It does **not** expose literal paths, source, PR URLs, identities, rationales, or individual case results.

Both measurements must have come from a properly approved frozen calibration corpus. Only the approved product candidate should vary. Compare before/after counts and denominators, investigate whether fewer warnings also reduced important detections, and document positive and negative regression fixtures and a rollback for every altered rule.

Neither these comparisons nor a better calibration score establish generalization to unseen pull requests. Formal Phase 3 uses a **fresh**, separately preregistered held-out corpus, with no post-result tuning, only after Phase 2 PASS.

## 5. Verification and gate

```powershell
npm run test:calibration-comparison
npm run test:calibration-preflight
npm run test:historical-pr-evaluation
npm test
npm run release:check
```

The comparison tests build *synthetic local fixtures* to verify input-integrity enforcement and arithmetic. They do not supply authentic calibration evidence. Record CI status, review outcomes, baseline/candidate full commit SHAs, and the exact failed gate if any; do not merge a formal Phase 2 product repair without the authorized roadmap requirements.

**Privacy:** Do not share private ledger, full diffs, labels, per-case results, completed comparison files, or absolute source paths. Review the content-free aggregate before citing or sharing it. No upload, telemetry, signing, publishing, billing, or release is performed by these commands.
