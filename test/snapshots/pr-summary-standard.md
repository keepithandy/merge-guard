## merge-guard review summary
<!-- merge-guard-pr-summary:v1 -->

**LOW risk** · score **1** · SAFE_TO_MERGE · **2 changed files** · **+3 / -0**

Risk, readiness, and score come from the analyzed diff. Pull-request text is context only.

### Highest-risk files

- **LOW / 2** <code>src/app.js</code> — Routing or entry-point logic changed because src/app.js matched routing, entry, main, index, or app path patterns.
- **LOW / 1** <code>src/app.test.js</code> — Routing or entry-point logic changed because src/app.test.js matched routing, entry, main, index, or app path patterns. Tests changed with implementation because src/app.test.js matched test, spec, smoke, or __tests__ path patterns.

<details>
<summary>Files (2)</summary>

| File | Risk | Score | Evidence |
| --- | --- | ---: | --- |
| <code>src/app.js</code> | LOW | 2 | Routing or entry-point logic changed because src/app.js matched routing, entry, main, index, or app path patterns. |
| <code>src/app.test.js</code> | LOW | 1 | Routing or entry-point logic changed because src/app.test.js matched routing, entry, main, index, or app path patterns. Tests changed with implementation because src/app.test.js matched test, spec, smoke, or __tests__ path patterns. |

</details>

<details>
<summary>Rules (2)</summary>

- **Routing or entry-point logic changed** (<code>routing-or-entry</code>, weight 2): Routing or entry-point logic changed because src/app.js, src/app.test.js matched routing, entry, main, index, or app path patterns. Matched <code>src/app.js</code>, <code>src/app.test.js</code>.
- **Tests changed with implementation** (<code>test-change</code>, weight -1): Tests changed with implementation because src/app.test.js matched test, spec, smoke, or __tests__ path patterns. Matched <code>src/app.test.js</code>.

</details>

<details>
<summary>Suggested and required checks (2)</summary>

- [ ] Manually test the affected navigation or app entry path.
- [ ] Confirm the updated tests cover the changed behavior.

</details>

<details>
<summary>Pull-request context</summary>

- **Title:** Harden &lt;startup&gt; while preserving score
- **Body:** Reviewer context only: keep **diff-derived** scoring authoritative.
- Context is displayed for reviewers and does not change diff-derived findings or scoring.

</details>

<sub>Summary contract v1. Expand sections for deterministic report detail.</sub>
