# Calibration diagnosis template

Use this template after a successful **calibration** run and before proposing any product change. Copy it into the ignored `.merge-guard-pilot/` workspace; do not commit completed copies. It records only aggregate counts, stable rule families, path classes, and opaque identifiers. Do not paste diffs, repository names, URLs, contributor identities, exact paths, label rationales, or per-case results.

The [pilot corpus intake guide](pilot-corpus-intake.md) defines collection and independent-label requirements. This template supports the active recovery phase: select no more than three evidence-backed repair hypotheses from calibration-only evidence. Held-out material is unavailable for diagnosis or tuning.

```markdown
# Calibration diagnosis — <opaque calibration run ID>

## Run identity

- Corpus identity: <hash or opaque ID>
- Product commit: <SHA>
- Metric implementation identity: <hash>
- Validation: pass | fail
- Calibration run output: <local ignored path>
- Held-out data inspected: no

## Aggregate coverage

| Measure | Value | Notes |
| --- | ---: | --- |
| Cases | <count> | validated calibration cases only |
| Supported concerns | <count> | include numerator and denominator below |
| High-severity supported concerns | <count> | must be at least 5 before measuring critical recall |
| Low-risk controls | <count> | |
| Unresolved disputes | <count> | retain; do not remove to improve metrics |

## Aggregate outcomes

| Measure | Numerator / denominator | Result | Gate status |
| --- | --- | ---: | --- |
| Actionable precision | <matched positive findings> / <positive findings> | <percent> | <pass/fail> |
| Supported-scope recall | <matched supported concerns> / <supported concerns> | <percent> | diagnosis only |
| Critical recall | <matched high-severity concerns> / <high-severity concerns> | <percent or insufficient-evidence> | <pass/fail/not measurable> |
| Median unmatched findings | <count> | <count> | <pass/fail> |
| Clean-PR specificity | <clean cases correctly clean> / <clean cases> | <percent> | <pass/fail> |

## Evidence inventory

| Kind | Rule family | Path class | Count | Interpretation |
| --- | --- | --- | ---: | --- |
| Unmatched finding | <stable family> | <opaque path class> | <count> | <brief, content-free pattern> |
| Missed supported concern | <stable family> | <opaque path class> | <count> | <brief, content-free pattern> |

Path classes are categories such as `entrypoint`, `configuration`, `test`, `persistence`, or `other`; never use literal repository-relative paths in a shareable summary.

## Ranked repair hypotheses

Record at most three. A hypothesis is eligible only when the inventory above supplies calibration evidence for it.

| Rank | Hypothesis | Evidence | Expected movement | Fixtures | Compatibility risk | Rollback |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | <bounded rule or presentation change> | <aggregate family/path-class counts> | <metric and direction> | <positive and negative fixture names> | <frozen-v1 impact> | <revert plan> |

## Decision

- Advance to a bounded repair proposal: yes | no
- If no: <what calibration evidence is still missing>
- Held-out corpus, labels, and outputs remain uninspected: yes
```

Before sharing a summary, confirm that every placeholder was replaced with aggregate or opaque information only. The completed template stays local; a pull request may state only the validation status, aggregate coverage, repair-hypothesis count, and whether a user decision is needed.
