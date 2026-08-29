# End-to-end GitHub review fixtures

Tracking: #41 and #66

Merge Guard locks its complete pull-request review experience with deterministic offline fixtures. Run the gate locally with:

```bash
npm run test:review-e2e
```

## Two-push scenario

The scenario combines the committed `pull_request.opened` and `pull_request.synchronize` event payloads with two cumulative pull-request diffs:

1. Push 1 changes app entry logic and legacy state persistence.
2. Push 2 retains the app finding, removes the legacy state change from the cumulative diff, and adds async API behavior.
3. Both scans write immutable schema-version 1 JSON reports.
4. The second report projects four changed-line annotations and four SARIF 2.1.0 results.
5. Comparing push 1 with push 2 must produce exactly two new, two unchanged, and two resolved finding identities.

The committed `test/snapshots/review-experience-e2e.json` baseline also locks report-only and compact comment exits, missing-history exit 2, threshold exit 1 with its JSON report retained, event head continuity, and stable managed-comment behavior.

## Comment update contract

The fixture calls the same exported `upsertPullRequestComment` function used by the Action. It injects an in-memory request adapter that implements only the GitHub issue-comment GET, POST, and PATCH calls needed by the helper. The first run creates comment ID 9001; the synchronize run updates that same marker-prefixed comment. A human comment that quotes the marker later in its body remains untouched.

Dependency injection changes only transport during the fixture. Production calls still default to the authenticated GitHub request implementation.

## Workflow fixture

`.github/workflows/review-experience-fixture.yml` runs on pull requests and manual dispatches. It:

- runs the offline end-to-end contract;
- invokes the local composite Action in report mode for push 1;
- preserves the first immutable report and its generated artifact manifest;
- invokes the Action in dry-run comment mode for push 2;
- enables and asserts annotations, SARIF, verified prior-evidence, and report comparison outputs;
- proves a low threshold still fails after review outputs are produced.

The workflow grants only `contents: read`. `comment-dry-run: "true"` renders the real marker-prefixed comment body but returns before token, event, or GitHub API handling. The workflow does not use third-party secrets or services, post comments, upload SARIF, retrieve workflow history, publish packages, or create releases.

## Boundaries

The fixture proves deterministic integration behavior, not hosted GitHub availability. Live comment permissions, code-scanning eligibility, artifact retention, and selection of a prior workflow report remain repository-owner responsibilities. Missing prior history stays explicit and cannot be interpreted as a clean comparison.
