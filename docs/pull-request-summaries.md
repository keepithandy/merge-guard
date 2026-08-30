# Compact pull-request summaries

Tracking: #41 and #63

Merge Guard can render a compact GitHub-oriented summary without changing the underlying report:

```bash
node src/cli.js --pr-summary change.diff
```

The summary contract is version 1 and includes the hidden marker `<!-- merge-guard-pr-summary:v1 -->`. It opens with diff-derived risk, score, a conservative review decision, changed-file count, line totals, and up to three highest-risk files. It shows at most three primary checks first; expandable sections retain all per-file evidence, rule findings, and the full suggested or policy-required check inventory. Warnings and pull-request context appear in separate sections when present.

## Scoring boundary

The formatter receives a completed report and never parses the pull-request title or body, recalculates findings, mutates report data, or executes checks. Pull-request text is displayed as escaped context only. The CLI derives risk, score, review decision, and threshold failure from the analyzed diff. The legacy `mergeReadiness` field remains in the JSON contract for compatibility.

In `--ci` mode, the compact summary is written to `GITHUB_STEP_SUMMARY` so the riskiest files appear first. Standard stdout remains the full Markdown report unless `--pr-summary` is selected explicitly.

## Comment updates

Comment mode uses the existing stable managed-comment marker:

```html
<!-- merge-guard-report -->
```

Reruns update the marker-prefixed comment instead of adding duplicates. A marker quoted later inside a human comment is ignored. The marker is unchanged from earlier versions, while the independent summary-version marker makes formatter changes auditable.

The composite Action automatically selects the compact summary when `comment: "true"`. The scan exit code is captured before comment publication and enforced afterward, so formatting or comment updates cannot weaken threshold behavior.

## Fixtures and snapshots

```bash
npm run test:pr-summary
```

Committed Markdown snapshots cover a standard code change with escaped PR context and a docs-only change. Pull-request `opened` and `synchronize` event fixtures also drive the end-to-end push-comparison and comment-update gate. The contracts prove stable markers, expandable files/rules/checks, risk-first ordering, report immutability, context-independent scoring, and one managed comment across reruns. No AI service, external API, or hosted service is required.
