# Pilot corpus intake

This guide turns the historical-PR pilot requirements into a repeatable, local-only intake process. It prepares the independently labeled corpus tracked in [#163](https://github.com/Keepithandy/merge-guard/issues/163); calibration and the frozen held-out run remain separate work tracked in [#164](https://github.com/Keepithandy/merge-guard/issues/164) and [#160](https://github.com/Keepithandy/merge-guard/issues/160).

## Privacy boundary

Keep the working set under the ignored `.merge-guard-pilot/` directory. Do not upload or commit the private intake ledger, diffs, labels, configuration, or per-case results. During intake, GitHub receives only reviewed code and documentation changes plus opaque counts, coverage categories, validation status, and unresolved-dispute counts. Issue #164 owns preservation of the later content-free preregistration evidence; #160 owns the final aggregate report and decision.

The private ledger is the only place that may map a real repository or pull request to an opaque alias. The corpus itself must not contain repository or organization names, URLs, contributor identities, tokens, absolute paths, source excerpts outside the diff, or other identifying prose.

Recommended local layout:

```text
.merge-guard-pilot/
  private-intake-ledger.md
  corpus/
    manifest.json
    cases/
      case-0001/
        change.diff
        labels.json
        merge-guard.config.json  # optional
  calibration-results/
  preregistration.json
  held-out-results/
```

The committed fixture at [`test/fixtures/historical-pr-evaluation/`](../test/fixtures/historical-pr-evaluation/) is a structural example only. Its synthetic three-case data is not a qualifying pilot corpus.

## Roles and independence

- The corpus owner selects cases, assigns opaque aliases, exports diffs, records setup time, and maintains the private ledger.
- Labeler A and labeler B review each candidate independently. Each records `include` or `exclude` before seeing the other labeler's decision or rationale.
- The adjudicator compares the completed decisions, resolves the final concerns, and records `agreed`, `resolved`, or `disputed`. The adjudicator may be one of the labelers, but adjudication starts only after both independent decisions are fixed.

Use stable opaque labeler aliases. Do not put names or contact details in `labels.json`.

## Selection and quota plan

Select more candidates than the minimum so invalid or predeclared exclusions do not leave the pilot underpowered. A practical intake target is 60 held-out candidates before freezing, while the preregistration gate requires all of the following in the final held-out partition:

Copy this tracker into the private ledger and update its `Current` column after each validated batch:

| Requirement | Minimum | Current | Ready when |
| --- | ---: | ---: | --- |
| Held-out cases | 50 | — | Every case validates and has two independent label decisions |
| Held-out repository aliases | 5 | — | Each alias belongs only to the held-out or calibration partition |
| Supported concerns | 15 | — | Adjudicated concerns name at least one supported rule family |
| Low-risk controls | 15 | — | Adjudicated cases set `lowRisk` to `true` |

Assign an entire repository alias to one partition. The loader rejects any alias shared between calibration and held-out data, which prevents related changes from leaking across the split. Preserve unsupported concerns and negative controls; they are evidence, not cleanup candidates.

Track only counts and opaque aliases outside the private ledger. Do not change selection, labels, thresholds, or exclusions after held-out results are known.

## Intake checklist

For every candidate:

1. In `private-intake-ledger.md`, record the real source reference, its opaque case ID, its opaque repository alias, consent or access basis, and the assigned partition. Never copy this mapping into the corpus.
2. Export one bounded unified diff to `cases/<case-id>/change.diff`. Remove transport metadata or prose that identifies a repository, organization, contributor, URL, token, or local absolute path without changing the code evidence being evaluated.
3. Add the case descriptor to `manifest.json`: `id`, `repositoryAlias`, `partition`, `directory`, observed `setupMinutes`, `repositoryShape`, `ecosystem`, `changeCategory`, and `diffSize`. If the case uses an optional configuration, name its case-relative path in `config`; merely placing a file in the directory does not select it. Record setup minutes from starting default-path preparation through a valid local case; do not estimate it later.
4. Have two independent labelers record their include/exclude decisions before comparison. Then adjudicate the case and write the final `lowRisk` state and concern set to `labels.json`.
5. For each concern, record an opaque ID, severity (`low`, `medium`, or `high`), one or more rule families, exact repository-relative affected paths (or an empty array for a genuinely global concern), provenance, and a short content-free rationale. Allowed provenance values are `incident`, `review-comment`, `maintainer-judgment`, and `synthetic-control`.
6. Run validation immediately. Quarantine the candidate until every diagnostic is resolved; do not weaken a schema or privacy check to admit it.
7. Update the private quota counts. A case counts toward pilot prerequisites only after adjudication and successful validation.

Supported rule families are:

- `state-or-persistence`
- `dependency-or-config`
- `routing-or-entry`
- `async-or-network`
- `large-change`
- `test-change`
- `implementation-without-tests`
- `configured-high-risk-path`
- `docs-only`

## Minimal record shape

Use the versioned schemas as the authority. This abbreviated pair shows the relationship between the manifest and one label file; it is not a complete pilot:

```json
{
  "schemaVersion": 1,
  "corpusId": "pilot-corpus-v1",
  "cases": [
    {
      "id": "case-0001",
      "repositoryAlias": "repo-alpha",
      "partition": "held-out",
      "directory": "cases/case-0001",
      "setupMinutes": 4,
      "repositoryShape": "single-package",
      "ecosystem": "node",
      "changeCategory": "routing",
      "diffSize": "small"
    }
  ]
}
```

```json
{
  "schemaVersion": 1,
  "caseId": "case-0001",
  "repositoryAlias": "repo-alpha",
  "lowRisk": false,
  "labelers": [
    { "alias": "labeler-a", "decision": "include" },
    { "alias": "labeler-b", "decision": "include" }
  ],
  "adjudication": { "status": "agreed" },
  "concerns": [
    {
      "id": "routing-change",
      "severity": "high",
      "ruleFamilies": ["routing-or-entry"],
      "paths": ["src/router.js"],
      "provenance": "review-comment",
      "rationale": "entry routing behavior changed"
    }
  ]
}
```

## Validation and handoff

Validate after each intake batch and before calibration:

```bash
npm run eval:historical-prs -- --corpus .merge-guard-pilot/corpus --mode validate
```

After the calibration set is independently labeled, run only that partition and write to a new local directory:

```bash
npm run eval:historical-prs -- --corpus .merge-guard-pilot/corpus --mode run --partition calibration --output .merge-guard-pilot/calibration-results
```

Do not run the held-out partition during intake or calibration. Issue #164 owns calibration review, product-commit freeze, preregistration, and the held-out handoff.

Stop and quarantine a case if validation reports an unknown schema, duplicate ID, path escape, symbolic link, oversized file, unsafe rationale, repository-alias leakage, or missing independent label decision. Also stop on any discovered repository name, URL, person, token, credential, absolute path, or other identifying content in a shareable artifact. Correct the local source or exclude the candidate under the predeclared rules; never publish the raw material for diagnosis.

When #163 is ready for handoff, report only opaque counts, coverage categories, validation status, and the number and category of unresolved disputes. Do not attach diffs, labels, the private ledger, or per-case output.
