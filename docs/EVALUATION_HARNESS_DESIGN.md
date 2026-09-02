# Historical pull-request evaluation harness design

Status: **harness implementation accepted; caller-owned corpus and pilot results pending**

Tracking milestone: field validation and adoption readiness after `1.3.0-beta.1`.

## Decision this harness must support

The harness exists to answer whether Merge Guard gives reviewers useful, actionable risk guidance on real pull requests without unacceptable noise or setup cost. It is not a test-coverage counter and it must not convert passing internal contracts into a claim of product usefulness.

The beta proceeds toward wider adoption only when a preregistered corpus evaluation shows acceptable actionability, supported-scope recall, noise, setup effort, and runtime. If it does not, the next work targets the measured failure rather than adding extension infrastructure.

## Non-goals

- No telemetry, hosted corpus, automatic upload, or repository discovery.
- No execution of changed code, project commands, builds, or suggested checks.
- No claim that historical incidents provide perfect ground truth.
- No tuning on the held-out evaluation partition.
- No use of repository popularity, owner identity, or proprietary source in aggregate results.

## Caller-owned corpus

The harness accepts one explicit local corpus directory:

```text
corpus/
  manifest.json
  cases/
    pr-0001/
      change.diff
      labels.json
      merge-guard.config.json   # optional
      impact.json               # optional
```

`manifest.json` declares schema version, an opaque corpus ID, case IDs, repository aliases, partition (`calibration` or `held-out`), and allowed product version. It contains no repository URL, organization name, contributor identity, token, absolute path, or source excerpt.

Each `labels.json` records:

- opaque case and repository aliases;
- change category and repository shape;
- reviewer-labeled concerns with severity, supported Merge Guard rule family, affected repository-relative paths, and a short content-free rationale;
- whether the PR is intentionally low-risk;
- known limitations or label disagreement;
- labeling provenance as `incident`, `review-comment`, `maintainer-judgment`, or `synthetic-control`;
- two independent label decisions and adjudication state.

Diffs and configurations remain local and are excluded from aggregate exports. Symlinks, paths outside the corpus root, oversized files, unknown schemas, duplicate case IDs, missing labels, and mixed calibration/held-out identities fail closed.

## Proposed command contract

The implementation should expose a repository-maintainer command rather than a public analysis mode initially:

```bash
npm run eval:historical-prs -- --corpus C:\path\to\corpus --output evaluation-results
```

The command performs explicit phases:

1. `validate`: validate paths, schemas, partitions, labels, privacy fields, and product compatibility without running analysis.
2. `run --partition calibration`: invoke the same in-process Merge Guard analysis modules on calibration cases.
3. `preregister`: freeze complete corpus content, caller-asserted product commit, metric source, and thresholds after corpus prerequisites pass.
4. `run --partition held-out`: verify the preregistration record before analyzing held-out cases and writing content-free aggregate results.

It must not invoke a package manager, shell, network client, GitHub API, or project script. Results record the exact Merge Guard version, configuration hash, input hash, corpus manifest hash, and deterministic run identity.

## Matching and metrics

A finding matches a labeled concern only when its stable rule family and repository-relative path match. Global findings match only labels explicitly marked global. Severity movement, text similarity, or a high total risk score cannot substitute for a match.

The aggregate report includes:

- **actionable precision:** matched or independently judged useful findings divided by all findings;
- **supported-scope recall:** matched labeled concerns whose rule family Merge Guard claims to detect;
- **critical supported-scope recall:** recall for high-severity supported concerns;
- **noise per PR:** unmatched findings per case, including median and 90th percentile;
- **clean-PR specificity:** fraction of labeled low-risk cases without a positive-weight finding;
- **readiness calibration:** distribution of readiness states by labeled severity;
- **configuration effort:** required non-default fields and maintainer setup minutes;
- **runtime:** median and 95th-percentile analysis time and peak heap growth;
- **coverage:** results split by repository shape, language/ecosystem, change category, and diff size;
- **label quality:** disagreement and adjudication rates.

Every metric includes its numerator, denominator, excluded cases, and exclusion reasons. Empty or unsupported labels remain `not-measured`, never zero or passed.

## Preregistered beta gate

Before running the held-out partition, record the corpus hash, product commit, metric implementation hash, and thresholds. The initial go/no-go proposal is:

- at least 50 held-out PRs from at least five repository aliases;
- at least 15 labeled supported concerns and 15 labeled low-risk controls;
- actionable precision at least 70%;
- critical supported-scope recall at least 80% when the denominator is at least five, otherwise `insufficient-evidence`;
- median unmatched positive-weight findings no greater than one per PR;
- clean-PR specificity at least 70%;
- median default-path setup no greater than five minutes in pilot observation;
- 95th-percentile analysis time within the existing 3,000 ms budget for inputs below the documented size limit;
- no privacy, determinism, frozen-v1 compatibility, or evidence-integrity regression.

Thresholds may be revised only before the held-out run, with a dated rationale. A miss is reported as a miss; cases are not removed after results are known unless the preregistered exclusion rule applies.

## Leakage and calibration controls

- Split by repository alias where possible so near-duplicate PRs do not cross partitions.
- Tune presets and rule wording only on calibration cases.
- Freeze the analyzed commit before held-out execution.
- Keep raw case output separate from the content-free aggregate.
- Report default configuration separately from explicitly configured performance.
- Preserve negative controls and unsupported concern types instead of silently excluding them.

## Deliverables for implementation

1. Versioned corpus-manifest, label, case-result, and aggregate-result schemas. **Implemented.**
2. Path-safe, bounded, read-only corpus loader. **Implemented.**
3. Deterministic label matcher and metric calculator with unit fixtures. **Implemented.**
4. Calibration and held-out execution modes with a fail-closed preregistration record. **Implemented locally; qualifying caller-owned corpus and pilot run pending.**
5. Local JSON aggregate outputs that contain no diff text. **Implemented.** HTML/Markdown presentation remains optional follow-up work.
6. Cross-platform reproducibility, performance, security, and privacy gates. **Implemented.**
7. A pilot report that recommends improve, proceed, or stop based on the preregistered result. **Pending caller-owned corpus and pilot.**

## Decision after the pilot

- Poor precision or specificity: simplify/tune core rules and review presentation.
- Poor supported recall: improve analysis and evidence inputs.
- High setup effort: reduce default workflow configuration.
- Strong results with repeated extension demand: reconsider the deferred trusted-extension lifecycle.
- Insufficient evidence: expand the corpus; do not claim success.
