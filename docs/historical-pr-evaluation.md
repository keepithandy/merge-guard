# Historical pull-request evaluation harness

The historical-PR harness evaluates Merge Guard against an explicitly selected local corpus. It is an **optional formal, independently verified accuracy study**, not a prerequisite for routine pull-request scanning, solo-maintainer fixes, source merges or Free preview releases. See [the active Free beta roadmap](PHASE_ROADMAP.md) and [the optional historical protocol](OPTIONAL_INDEPENDENT_EVALUATION_PROTOCOL.md). The evaluator's original integrity/dual-label requirements are preserved for honest statistical claims.

```bash
npm run eval:historical-prs -- --corpus C:\path\to\corpus --mode validate
npm run eval:historical-prs -- --corpus C:\path\to\corpus --mode run --partition calibration --output calibration-results
npm run eval:historical-prs -- --corpus C:\path\to\corpus --mode preregister --output preregistration.json --product-commit <full-commit-sha> --recorded-at <utc-iso-timestamp>
npm run eval:historical-prs -- --corpus C:\path\to\corpus --mode run --partition held-out --output held-out-results --preregistration preregistration.json --product-commit <same-full-commit-sha>
```

## Calibration-only preflight (preparatory, not a phase PASS)

If pursuing the **optional formal accuracy study**, keep an independently labeled calibration-only corpus in the ignored `.merge-guard-pilot/` workspace and run:

```bash
npm run eval:calibration-preflight -- --corpus .merge-guard-pilot/calibration-corpus
npm run test:calibration-preflight
```

This local, read-only command inspects a calibration-only manifest before opening case files. It refuses mixed calibration/held-out manifests **without loading held-out diffs or labels**, never runs the analyzer, and prints only summary counts, generic blocker codes, and a list of manual review requirements. It returns exit status `2` for automatically blocked evidence and `0` when numerical/structural checks are met **but human verification is still required**.

The structural check requires at least 15 supported concerns, 15 low-risk controls, and 5 high-severity supported concerns; it flags exact duplicate calibration diffs, disputed or excluded decisions, and synthetic provenance. Those thresholds describe the preserved optional independent-evaluation protocol's calibration prerequisite, not a requirement for Free beta source fixes. Synthetic fixture cases do not qualify as authentic independent evidence.

**Never treat `human-verification-required` or exit status `0` as Phase 1 PASS.** Independent labels, outcome-grounded provenance, source ancestry and separation from held-out data, exclusions, and calibration freeze must be verified and authorized using the owner-controlled private ledger. Optional formal evidence phases remain governed by [the archived protocol](OPTIONAL_INDEPENDENT_EVALUATION_PROTOCOL.md); this preparatory preflight does not unlock formal Phase 2 or establish measured accuracy. It does **not** restrict ordinary solo-owner product changes under [the active roadmap](PHASE_ROADMAP.md).

For the repeatable, content-free **before/after calibration measurement** procedure, including caller-asserted commit identities, immutable input checks, both verification stages, and commands for Windows PowerShell, see [Repeatable calibration measurement](REPRODUCIBLE_CALIBRATION.md). That workflow requires authentic independent evidence and does not authorize production rule changes.

`validate` checks the corpus before analysis. Calibration and held-out runs must select their partition explicitly. `run` writes a new output directory containing `aggregate.json` and `case-results.json`; it refuses to overwrite an existing directory.

`preregister` fails unless the held-out corpus reaches the documented minimum case, repository-alias, supported-concern, low-risk-control, and independent-label requirements. Its content-free record binds the complete corpus content, the caller-asserted product commit, the installed metric source, and the fixed thresholds. A held-out run requires that exact record and rejects corpus, source, product, threshold, or identity drift. The product commit is a caller assertion; the local command does not contact GitHub or inspect remote state.

The corpus requires `manifest.json`, one explicitly named directory per case, a bounded `change.diff`, and `labels.json`. Optional configuration is selected only by the manifest. Follow the [pilot corpus intake guide](pilot-corpus-intake.md) for the ignored local layout, independent-label workflow, quotas, privacy checks, and calibration handoff; use the [calibration diagnosis template](calibration-diagnosis-template.md) to summarize calibration-only evidence before proposing repairs. Corpus paths must be relative, regular files beneath the selected root; symbolic links, escapes, oversized files, duplicate IDs, repository aliases spanning calibration and held-out partitions, malformed labels, URLs in rationales, and unsupported schemas fail closed.

The output includes only opaque case/repository aliases, hashes, counts, categories, metrics, and readiness states. It deliberately omits diff text, source contents, local paths, URLs, label rationale, contributors, and repository names. The harness neither executes changed code nor project commands, and has no telemetry, network, upload, GitHub, or package-manager behavior.

Calibration runs additionally include a content-free diagnosis inventory: unmatched positive findings and missed supported concerns are grouped by stable rule family and one fixed broad path class (`configuration`, `docs`, `entrypoint`, `persistence`, `test`, `global`, or `other`). No caller-defined or literal path class is emitted. Each row reports both its total occurrences and the number of distinct opaque cases represented, without exposing those case IDs. The inventory is omitted from mixed and held-out output, and it never includes literal paths, case IDs, labels, or source text.

The result uses these versioned contracts:

- [corpus manifest schema](../schemas/historical-pr-corpus-v1.schema.json)
- [case labels schema](../schemas/historical-pr-labels-v1.schema.json)
- [case result schema](../schemas/historical-pr-case-result-v1.schema.json)
- [aggregate result schema](../schemas/historical-pr-evaluation-result-v1.schema.json)
- [pilot preregistration schema](../schemas/historical-pr-preregistration-v1.schema.json)

Matching is exact: a positive-weight stable finding matches only a label that names its rule family and exact repository-relative path. Global findings match labels with no path. Unsupported labels are not treated as missed detections. Timing measurements are intentionally nondeterministic, while matching, hashes, counts, and all non-timing fields are deterministic.

The preregistration record contains no diff text, labels, rationales, repository names, URLs, paths, or contributor identities. Raw corpus and per-case results remain local and caller-owned.

See [the evaluation design](EVALUATION_HARNESS_DESIGN.md) for the preregistered pilot gates and [the contract suite](../scripts/historical-pr-evaluation-contracts.js) for local fixtures.
