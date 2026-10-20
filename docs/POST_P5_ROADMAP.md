# Merge Guard — Post-Phase-5 Roadmap and Release Gates

**Status:** consolidated planning baseline as of **2026-10-20**. **Development only; no commercial launch, publication, deployment, or new feature phase is automatically authorized.** This document reconciles the [canonical roadmap](../ROADMAP.md), [Free phase roadmap](PHASE_ROADMAP.md), [execution queue](ROADMAP_EXECUTION.md), [commercial release checklist](commercial-release-checklist.md), and [long-horizon idea registry](LONG_HORIZON_ROADMAP.md).

**Source snapshot:** `main` at [`520f4527d93e46d8b008759bfad4024b909706c8`](https://github.com/keepithandy/merge-guard/commit/520f4527d93e46d8b008759bfad4024b909706c8) (Phase 5B post-merge hardening, PR #203). This is a repository observation, **not a frozen release candidate**. Refresh this line and verify the exact new SHA before using it as evidence.

## 1. Single source of truth: what each roadmap controls

| Document | Authority and scope | Status |
| --- | --- | --- |
| [`ROADMAP.md`](../ROADMAP.md) | Canonical product direction, priority lanes, version boundaries, release decisions | Active |
| [`POST_P5_ROADMAP.md`](POST_P5_ROADMAP.md) | Current cross-lane status, dependency map, proposed next work, evidence and launch gates | Active **planning** record |
| [`ROADMAP_EXECUTION.md`](ROADMAP_EXECUTION.md) | Bounded, executable *authorized* Free work and historical completions | Active; do not promote proposed P6+ work without owner scope decision |
| [`PHASE_ROADMAP.md`](PHASE_ROADMAP.md) | Solo-maintainer Free development/preview workflow | Active |
| [`commercial-release-checklist.md`](commercial-release-checklist.md) | Paid Free/Pro/Team release-gating inventory; unchecked means not verified for launch | Active |
| [`LONG_HORIZON_ROADMAP.md`](LONG_HORIZON_ROADMAP.md) | Candidate ideas, including AI/hosted/v2; neither prioritized nor approved | Idea registry only |
| [`OPTIONAL_INDEPENDENT_EVALUATION_PROTOCOL.md`](OPTIONAL_INDEPENDENT_EVALUATION_PROTOCOL.md) | Historical formal two-independent-reviewer evaluation | Opt-in for statistical efficacy claims only |

The **September 3, 2026 stopped pilot** remains immutable: actionable precision **12/140 (8.6%)**, supported-scope recall **12/35 (34.3%)**, and no qualifying high-severity denominator for critical recall. Do not re-label the pilot, tune on its held-out cases, or infer population accuracy from synthetic tests or volunteered issue reports. This **does not prevent** regression-tested Free source repairs or an honestly labeled Free preview.

## 2. Audited source status and evidence ledger

| Item | Traceability | Source state / verified scope | What it does **not** prove |
| --- | --- | --- | --- |
| v1.1 adoption, v1.2 impact, v1.3 durable evidence | [Execution history](ROADMAP_EXECUTION.md) | Source milestones implemented | npm/GitHub publication or adoption success |
| Free signal repair | [PR #193](https://github.com/keepithandy/merge-guard/pull/193), merge `864fadb` | Merged positive/negative library-compatibility and index re-export fixes | Representative precision/recall |
| Commercial foundation and Sandbox isolation | [PR #188](https://github.com/keepithandy/merge-guard/pull/188), [PR #195](https://github.com/keepithandy/merge-guard/pull/195) | Free/Pro/Team capability model, live-license validation path, independent Sandbox state, fail-closed denied persistence | Real paid subscriptions, secure endpoint hosting, durable offline paid authority |
| Staged Pro policy/support foundation | [PR #196](https://github.com/keepithandy/merge-guard/pull/196), merge `45fe4d7` | Authenticated catalog, locally hosted gateway and ticket intake; policy packs currently **public reference examples** | Deployed service, private chargeable content, staffed support |
| **P5A** customer onboarding | [#197](https://github.com/keepithandy/merge-guard/issues/197) / [PR #200](https://github.com/keepithandy/merge-guard/pull/200) | **Merged** `d997b10`; offline redacted `onboard [--json]`, strict HTTPS portal validation | Real merchant or customer onboarding |
| **P5B** operator support | [#198](https://github.com/keepithandy/merge-guard/issues/198) / [PR #201](https://github.com/keepithandy/merge-guard/pull/201) | **Merged** `928c4bb`; pending-ticket metadata, unsent reply draft, explicit retention dry-run/apply | Mail delivery, operating SLA, verified Windows ACLs / backup/restore |
| **P5C** subscription lifecycle | [#199](https://github.com/keepithandy/merge-guard/issues/199) / [PR #202](https://github.com/keepithandy/merge-guard/pull/202) | **Merged** `10adb8a`; mocked Polar Pro/Team transitions with localhost gateway, revoked/expired fail-closed contracts | Real Polar Sandbox checkout or renewal/cancel evidence |
| P5B post-review correction | [PR #203](https://github.com/keepithandy/merge-guard/pull/203) | **Merged** `520f452`; refuses dangling reply-draft symlinks and malformed ticket timestamps in both operator listing paths | Comprehensive security audit, recovery/replay protection or operating compliance |

**CI evidence:** PRs [#200](https://github.com/keepithandy/merge-guard/pull/200), [#201](https://github.com/keepithandy/merge-guard/pull/201), [#202](https://github.com/keepithandy/merge-guard/pull/202), and [#203](https://github.com/keepithandy/merge-guard/pull/203) each had five successful GitHub Actions workflows at their reviewed PR heads; the Node compatibility workflows completed nine jobs each, including Node 18/20/22/24 on Windows and Ubuntu and full validation. **Do not transfer these results to a future SHA or assert that a post-squash main/release artifact was independently certified.** The checkout and sale gates are still unverified.

**Other tracked work:** [issue #190](https://github.com/keepithandy/merge-guard/issues/190) remains **open** (intermittent Windows/Node 24 plugin-worker test timeout; do not alter production timeout semantics without diagnosis). [PR #189](https://github.com/keepithandy/merge-guard/pull/189) remains **open** on an older commercial baseline; later merges supersede portions of its intent. Audit its unique changes before a close/rebase decision; **do not merge the stale PR as-is**. The phase document's earlier references to PR #193 as pending are historical.

**Current package identity:** `package.json` declares `1.3.0-beta.2`; this is a source version, not proof of a published package. Production Polar checkout is disabled; no paid release has been authorized by these roadmap revisions.

## 3. Status taxonomy and separate gates

- **Implemented (source):** code and documentation merged. This alone is *not* a passed release.
- **Automated verification:** a named workflow and all its jobs passed at a named exact SHA, with known fixture/mock limits.
- **Sandbox verified:** actual Polar Sandbox product, checkout, activation, renewal, revocation, downgrade, and support/policy flow was exercised on the *same frozen candidate*, with sanitized receipts.
- **Operationally ready:** independent evidence exists for hosting/TLS, monitoring/rate limiting, key security/Windows ACLs, private policy inventory, backups/retention, support ownership, legal/disclosures and rollback.
- **Publication approved:** owner explicitly names source SHA, version, artifacts, target channels and allowable external mutations. Green CI never supplies this approval.
- **Published and verified:** operations executed under approval and independently inspected afterward. Until then, label them pending.

No checkbox in [the commercial checklist](commercial-release-checklist.md) is automatically completed merely because P5 merged. All customer-facing benefit claims must track delivered functionality rather than capability flags or reference packs.

## 4. Proposed next commercial delivery sequence (not authorized for implementation)

The names below are **planning candidates**, not numbered GitHub issues, active authorizations, or claims that P6–P9 have begun. Promote one bounded slice at a time after an explicit scope decision, reproducible acceptance tests, security analysis, and rollback design.

### P6 — Candidate hardening and proof of paid benefit delivery

**Goal:** turn source-only Pro/Team primitives into auditable candidate evidence **without taking production payments**.

| Slice | User/owner outcome and critical acceptance | Prerequisite | Required proof / rollback |
| --- | --- | --- | --- |
| **P6A — candidate freeze and matrix** | Record immutable candidate SHA, package hash, supported Node/OS matrix, `npm test`, `test:commercial`, `test:license-persistence`, `test:subscription-lifecycle`, `test:security`, `test:public-contracts`, `release:check`, offline Free smoke and packaging/SBOM inspection; no failing/skipped required jobs | Chosen scope, version and release owner | Machine links for **one** exact head and artifacts; rollback to prior known-good source |
| **P6B — gateway and secret boundaries** | Document and test trusted TLS termination, origin/host validation, rate limiting per identity/IP, bounded bodies/concurrency, timeouts, audit/redaction, monitoring, no diff uploads and revocation fail-closed; inspect credential files and support-queue **Windows ACLs**, symlink/path races and encrypted-at-rest requirements | Threat model, intended host/storage, key lifecycle | Negative attack fixtures and operations runbook; disable gateway and revoke credentials safely |
| **P6C — policy entitlement and rights** | Inventory **genuinely private/licensed** Pro packs, provenance/version/hash, server-side authorized retrieval, breach/revocation checks, and no public mirroring of chargeable content; existing public reference packs stay examples | Cleared content rights and deployment boundary | Test denied/free/revoked/expired/wrong-org access to each benefit, with no raw source leakage; remove paid pack or disable catalog |
| **P6D — priority support operations** | Define real operator, reply handoff, delivered-response evidence (no false email claim), intake alerts without PII, incident handling, retention+legal hold, backup/restore, privacy notice, and customer response expectations | Owner support channel and secure storage | Exercise ticket receipt → triage → **external** message delivery confirmation → responded/closed → safe preview/apply → restore; disable intake if unstaffed |
| **P6E — live Sandbox lifecycle** | Record **real** Polar Sandbox Pro **and Team** checkout → activation → paid delivery → renewal/expiration → revoke/cancel → reactivation, mismatch and fallback; prove server checks independent of cached client state | P6A–D candidate/security controls, configured Sandbox products/benefits | Sanitized timestamped receipts keyed to final SHA; no production money or customer data; invalidate test benefits |

**Exit:** P6 source candidate is technically/operationally characterized with *specific recorded gaps*. Even full P6 exit does **not** authorize a public checkout, npm publish, or paid claim.

### P7 — Free preview release decision (parallel, independent of paid launch)

**Goal:** ship or defer a truthful MIT Free beta without waiting for commercial products or a new independent accuracy study.

1. Decide the exact Free candidate identity from source and prospective `1.3.0-beta.x`/next version; do not change `package.json` by documentation alone.
2. Re-run clean-install, composite Action, CLI, representative consumer fixtures, deterministic v1 JSON/compatibility, public contracts, security, performance, packaging, disclosure and rollback at **one** SHA.
3. Update Free installation, limits and support materials; explicitly state that findings are heuristic and that September's held-out pilot **stopped**. No benchmark improvement or verified precision/recall claim without new independent ground truth.
4. Obtain separate owner approval for each npm publish, release/tag, Action ref, Marketplace and distribution mutation. If not approved, retain source-only candidate.
5. Invite **voluntary sanitized feedback**; classify cases as unverified/reproduced/confirmed/not reproducible, land minimal positive and negative regressions, and avoid telemetry/whole proprietary diffs.

**Exit:** clear Free candidate decision and separately confirmed release status; optional dual-reviewer efficacy protocol remains off this critical path.

### P8 — Real Team benefit and packaging (conditional)

**Goal:** offer Team only if its advertised value is actually deliverable.

- Specify shared-policy semantics: tenant/team membership, seat/permission model, isolation, conflict resolution, revocation, audit, retained data policy, and support ownership. Current capability enumeration is **not** a working shared-policy product.
- Implement the smallest authorized delivery path with documented API/schema/version, refusal on stale grants, negative cross-tenant tests, and a safe migration/rollback plan. No ambient repository upload, telemetry, hosted workspace or automatic code execution.
- Exercise actual Sandbox Team purchase, upgrade/downgrade and member lifecycle on a frozen candidate. Gate the `$29/month` target behind delivered benefits, not pricing copy.
- If private shared-policy service and operator/legal capacity are absent, hold Team as **not for sale** even if Pro progresses.

**Exit:** tested customer-visible Team fulfillment, operational capacity, and a separate approval decision; not automatically production published.

### P9 — Production commercial approval and monitored rollout (conditional)

**Goal:** take payments only after all preceding gates close and the owner signs off the specific action set.

- Confirm merchant/Polar account, production IDs/products and checkout/portal destinations, real benefit mappings, taxes/terms/privacy/refunds, allowed distribution rights and meaningful support disclosures.
- Freeze release SHA, artifacts and identities; complete a fresh exact-candidate CI/security/license matrix and both-tier real Sandbox evidence.
- Verify hardened HTTPS deployment, monitoring/alerts, incident and rollback playbook, key/queue protections, backups/retention, entitlement failure policy and customer support capacity.
- Stage no-charge/internal validation first, then obtain named explicit authorization for production checkout, public sales claims and any GitHub/npm release steps **individually**.
- Publish only the permitted surfaces, verify customer experience and revocation, monitor errors and support load; disable checkout/deploy on regression.

**Exit:** owner-approved, logged production changes and actual post-launch verification. Without evidence, status remains **blocked**.

## 5. Concurrent reliability and technical debt

- **CI #190:** reproduce intermittent plugin-worker startup-vs-execution timing on Windows/Node 24; keep intentionally slow timeout contract; only adjust *test fixture* timing if supported by evidence.
- **Open legacy PR #189:** review cherry-picked/merged-equivalent files and any unique semantics against current `main`; close only with a clear audit rationale, not an automatic merge.
- **Security debt:** licensing state credentials are sensitive; production paid grants require live provider validation, not file trust. Verify Windows ACLs, directory mode limitations, denial persistence failures, timeouts and actual host hardening before selling.
- **Support integrity:** protect queue and drafts from symlinks, malformed metadata, races and unintentional disclosure; confirm operator training, backup/restore and legal holds beyond synthetic unit tests.
- **Release hygiene:** no false positives about published package versions; keep versioning, README, changelog, commercial docs, checklist and roadmap synchronized at release-candidate selection time.

## 6. Implementation-to-approval handoff template

For each selected issue record: **scope and owner decision**; baseline SHA; user-visible outcome; threat/privacy/permission boundaries; dependencies; public interface impact; positive+negative/abuse fixtures; `npm.cmd test`, `npm.cmd run test:commercial` (when relevant), `npm.cmd run test:security`, `npm.cmd run test:public-contracts`, `npm.cmd run release:check`; exact GitHub Actions run and final head SHA; reviewer findings and fixes; rollback/revert; residual risk; **source merge versus external operation authorization**. Do not mark a skipped, pending or inapplicable gate as passing.

**Current recommendation for work selection:** first reconcile #190 and stale #189 as maintenance, then select P6A (freeze/evidence inventory) and P6B (security threat model) as *proposals*. Pro paid rollout depends on P6C–E; Team depends on P8. Free P7 can proceed on its own schedule after exact authorization.
