# Historical pull-request evaluation harness

The historical-PR harness evaluates Merge Guard against an explicitly selected local corpus. It is designed for beta field validation, not routine pull-request scanning.

```bash
npm run eval:historical-prs -- --corpus C:\path\to\corpus --mode validate
npm run eval:historical-prs -- --corpus C:\path\to\corpus --mode run --partition calibration --output calibration-results
npm run eval:historical-prs -- --corpus C:\path\to\corpus --mode preregister --output preregistration.json --product-commit <full-commit-sha> --recorded-at <utc-iso-timestamp>
npm run eval:historical-prs -- --corpus C:\path\to\corpus --mode run --partition held-out --output held-out-results --preregistration preregistration.json --product-commit <same-full-commit-sha>
```

`validate` checks the corpus before analysis. Calibration and held-out runs must select their partition explicitly. `run` writes a new output directory containing `aggregate.json` and `case-results.json`; it refuses to overwrite an existing directory.

`preregister` fails unless the held-out corpus reaches the documented minimum case, repository-alias, supported-concern, low-risk-control, and independent-label requirements. Its content-free record binds the complete corpus content, the caller-asserted product commit, the installed metric source, and the fixed thresholds. A held-out run requires that exact record and rejects corpus, source, product, threshold, or identity drift. The product commit is a caller assertion; the local command does not contact GitHub or inspect remote state.

The corpus requires `manifest.json`, one explicitly named directory per case, a bounded `change.diff`, and `labels.json`. Optional configuration is selected only by the manifest. Corpus paths must be relative, regular files beneath the selected root; symbolic links, escapes, oversized files, duplicate IDs, repository aliases spanning calibration and held-out partitions, malformed labels, URLs in rationales, and unsupported schemas fail closed.

The output includes only opaque case/repository aliases, hashes, counts, categories, metrics, and readiness states. It deliberately omits diff text, source contents, local paths, URLs, label rationale, contributors, and repository names. The harness neither executes changed code nor project commands, and has no telemetry, network, upload, GitHub, or package-manager behavior.

The result uses these versioned contracts:

- [corpus manifest schema](../schemas/historical-pr-corpus-v1.schema.json)
- [case labels schema](../schemas/historical-pr-labels-v1.schema.json)
- [case result schema](../schemas/historical-pr-case-result-v1.schema.json)
- [aggregate result schema](../schemas/historical-pr-evaluation-result-v1.schema.json)
- [pilot preregistration schema](../schemas/historical-pr-preregistration-v1.schema.json)

Matching is exact: a positive-weight stable finding matches only a label that names its rule family and exact repository-relative path. Global findings match labels with no path. Unsupported labels are not treated as missed detections. Timing measurements are intentionally nondeterministic, while matching, hashes, counts, and all non-timing fields are deterministic.

The preregistration record contains no diff text, labels, rationales, repository names, URLs, paths, or contributor identities. Raw corpus and per-case results remain local and caller-owned.

See [the evaluation design](EVALUATION_HARNESS_DESIGN.md) for the preregistered pilot gates and [the contract suite](../scripts/historical-pr-evaluation-contracts.js) for local fixtures.
