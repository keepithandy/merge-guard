# Free Beta Feedback — Solo Maintainer

**Purpose:** Let the maintainer improve Merge Guard using reports voluntarily submitted by people who try the existing Free/MIT scanner. No independent-reviewer team is needed to develop, test or merge fixes, and this feedback process does not enable telemetry.

## Submit feedback voluntarily

Use the [Free beta feedback issue form](https://github.com/keepithandy/merge-guard/issues/new?template=free-beta-review-feedback.yml), or open a normal issue if the form is unavailable. The form does **not** submit anything until you choose to create the GitHub issue. Never include passwords, tokens, private source code, employee/customer identities, whole PR diffs, proprietary logs, protected URLs or absolute filesystem paths.

A useful report contains as many of these **optional, sanitized** details as the reporter can safely share:

- Merge Guard version, operating system and Node major version (for example Node 22), and CLI/Action/policy mode;
- which finding was noisy or which supported concern was missed;
- a short, **invented or sanitized** one-line snippet or synthetic unified diff, if feasible;
- expected behavior and the behavior actually seen;
- whether a test, observed regression or confirmed public issue independently supports the claim;
- whether the reporter can reproduce it. A privacy-safe written description alone is useful.

A report is never rejected solely because the user will not share source or personally identifying evidence. Nothing in the CLI, Action or dashboard should automatically transmit a report, diffs, finding details, report hashes or identifying metadata.

## Maintainer triage without a second reviewer

The solo maintainer tracks each issue in one of these factual states:

| State | Meaning |
| --- | --- |
| Reported / unverified | A user reported behavior but the maintainer has not reproduced it |
| Reproduced | A minimal local case demonstrates the behavior; authenticity of any larger claim is still unverified |
| Confirmed | The observed behavior and expected rule/check behavior have been verified for the specific case |
| Not reproducible / needs details | Currently insufficient input; do not invent an outcome |
| Fixed in candidate | Targeted positive and negative tests pass on one identified source commit, not necessarily released |
| Available in Free release | The exact released version/artifact is independently confirmed to contain the correction |

Prioritize repeated *kinds* of problems, concrete missed-risk severity, reproducibility, and user impact. Avoid showing a made-up `false-positive rate` from issue counts: this self-selected channel has **no denominator of all Free PRs** and does not measure population precision, recall or specificity.

Every accepted scanner adjustment needs at least one negative fixture that demonstrates old noise, one positive fixture protecting genuine risk, tests for public-contract/regression compatibility, an explained risk-score movement, deterministic/reproducible CI and rollback. A single owner can make the decision. For example, [PR #193](https://github.com/keepithandy/merge-guard/pull/193) addresses noisy compatibility-marker and `index.js` navigation matches.

## Release and privacy boundaries

- Free scanning works without a license/Polar connection; no forced account, analytics or background reports.
- Publish a clearly marked **preview** with prominent limitations: deterministic heuristics are review suggestions, not proven correctness, code-execution verification, merge approval or guarantee of no misses.
- Maintain an immutable record of the original September 2026 pilot's `stop` result. Later issue reports cannot be substituted for independent human ground truth in that preregistered study.
- Do not collect contacts or direct messages automatically. GitHub issue visibility and notification settings are chosen by the reporter and GitHub.
- Before any external npm/GitHub release, tag, stable Action-reference change or checkout, obtain a separate exact owner authorization naming the artifact/commit/version/actions and confirm required release/security/compatibility gates.

See [the active solo-maintainer Free beta roadmap](PHASE_ROADMAP.md). Formal independent study remains possible via [the optional historical evaluation protocol](OPTIONAL_INDEPENDENT_EVALUATION_PROTOCOL.md), but is not a Free beta requirement.
