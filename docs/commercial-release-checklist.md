# Commercial release checklist

**Hosted plan parked:** active work is Free plus [a local-kit proposal](LOCAL_FIRST_PRODUCTS.md), with no server budget. This historical hosted-launch checklist remains unmet; its hosting/recurring-product gates are not Free development requirements. A future downloadable kit needs its own content/rights, compatibility, terms, delivery and publication review. No existing customer terms, license behavior or billing change is authorized here.

**Verified document refresh: 2026-10-20. Status: BLOCKED for paid launch.** See the [post-P5 integrated roadmap](POST_P5_ROADMAP.md) for evidence, dependencies, proposed P6–P9 scope and separate Free preview gate. Phases P5A [#200](https://github.com/keepithandy/merge-guard/pull/200), P5B [#201](https://github.com/keepithandy/merge-guard/pull/201), P5C [#202](https://github.com/keepithandy/merge-guard/pull/202) and support hardening [#203](https://github.com/keepithandy/merge-guard/pull/203) are **merged source work**, not launch authorization.

## Gate accounting — no inferred completion

| Gate | Evidence observed as of this snapshot | Release disposition |
| --- | --- | --- |
| Source integration | PRs #200–#203 merged; main at `520f4527d93e46d8b008759bfad4024b909706c8` | **Implemented**, not a frozen candidate |
| Automated regression tests | All five workflows successful on **each final PR head**, including 9/9 Node compatibility jobs on Windows/Ubuntu Node 18/20/22/24; commercial tests wired into `npm test` and `test:commercial` | **Recorded PR-head proof only**; re-run on the exact release candidate/artifacts |
| Pro policy delivery | Authenticated live-provider-verified local gateway and public example policies | **Staged only**; private paid content + hardening/hosting not verified |
| Priority Support | Local queue/draft/purge plus follow-up validation/symlink repairs | **Staged only**; staffed support, outbound response, backup/restore and Windows ACLs not verified |
| Pro/Team subscription lifecycle | Mock Polar transitions, localhost gateway and client fail-closed behavior | **Mocks only**; actual Sandbox Pro **and** Team purchases/lifecycle not verified |
| Team shared-policy fulfillment | Tier capability definitions exist | **Not delivered**; cannot market a shared-policy service |
| Production sales/release | No current approval naming SHA, artifact, version and allowed channels | **Blocked**; production checkout and publication remain disabled |

**Checklist convention:** a checkbox below is a **fresh launch-candidate attestation**, not an implementation claim. Leave it unchecked until evidence for that *exact candidate* is recorded. Mark failed/unavailable/not-applicable explicitly in the release decision packet; never mark a mocked integration as live verified.

**Phase 6 source progress:** follow [the P6A–E execution and blocker table](P6_EXECUTION.md#one-phase-6-execution-sequence) under [#205](https://github.com/keepithandy/merge-guard/issues/205). The local candidate/security/inventory/support work in PR #206 supplies source controls and regression evidence. The first owner gate is the P6B deployment/TLS/trusted-ingress and secure-storage decision; private rights, real support delivery and live Sandbox receipts remain required. These source changes complete no launch checkbox by themselves.

## Repository

- [ ] `npm test` passes on the exact frozen candidate SHA on all required platforms.
- [ ] `npm run test:onboarding`, `npm run test:support-operations` and `npm run test:subscription-lifecycle` pass with required negative cases, and links identify the final head.
- [ ] `npm run test:commercial` passes.
- [ ] `npm run test:license-persistence` passes, including independent CLI processes after denial with writes and deletion blocked, and actual Windows read-only files.
- [ ] A new offline CLI process returns Free despite a surviving paid file; a fresh live grant is required in every process. In-process cache/grace limits match the documented authorization policy.
- [ ] Denial replacement/removal failures produce sanitized warnings and never restore a paid receipt. Production/Sandbox isolation passes in both directions.
- [ ] `npm run release:check` passes.
- [ ] `npm pack --dry-run` contains no secrets or local license state.
- [ ] CLI Free scan works with no Polar configuration.
- [ ] Opt-in Sandbox contracts pass for endpoint selection, environment/organization/key isolation, copied and legacy caches, offline Free fallback, and failed activation/deactivation.
- [ ] Production build IDs/links are preserved; Sandbox IDs are supplied explicitly and never used as production defaults.
- [ ] CLI `plan`, `activate`, `license`, `license clear`, `onboard [--json]`, `account`, `pro policies` and support commands behave as documented on the candidate.
- [ ] No access token, customer license key, or production secret is committed.
- [ ] README, changelog, roadmap, tier matrix, and Polar setup agree.

## Polar

- [ ] Polar organization exists and owner verification is complete.
- [ ] Pro recurring product exists at $9/month.
- [ ] Team recurring product exists at $29/month.
- [ ] Separate license-key benefits exist for Pro and Team.
- [ ] Benefit IDs are configured.
- [ ] Checkout links are configured.
- [ ] Customer portal URL is configured.
- [ ] Pro test checkout → activation → validation succeeds.
- [ ] Team test checkout → activation → validation succeeds.
- [ ] Revocation/cancellation behavior is verified.
- [ ] Live Sandbox activation and entitlement lifecycle evidence is recorded separately from mocked automated test results.
- [ ] Live evidence names the exact tested source SHA. Owner-reported Pro activation, validation, shell restart persistence, and deactivation are historical observations until their commit is recorded and the updated policy is exercised.
- [ ] Tests cover plaintext key storage, `activate --stdin` as an alternative to process arguments, and Windows ACL behavior before launch; POSIX creation modes do not prove Windows credential protection.

## Paid benefit delivery

- [ ] Premium Pro benefit has an authenticated policy catalog and live-entitled policy delivery on the final head.
- [ ] Team shared-policy benefit has a real delivery path.
- [ ] Support contact/process exists.
- [ ] Pricing page advertises only benefits that can actually be delivered.

## Legal and support

- [ ] Existing MIT boundary is preserved and understood.
- [ ] Any new non-MIT paid content has documented distribution rights and meets applicable legal obligations before sale.
- [ ] Supplier terms, refunds and support disclosures comply with the planned launch markets.
- [ ] Privacy disclosure states that scanner analysis remains local and licensing contacts Polar.

## External release

- [ ] Version/release decision is approved by owner.
- [ ] Tag is created only after approval.
- [ ] npm publication is approved and verified.
- [ ] GitHub release is approved and verified.
- [ ] Stable Action reference move is approved and verified.
- [ ] Production Polar checkout is enabled only after smoke testing.

## Phase 5 lifecycle verification distinction

- [ ] Automated Pro/Team mock-lifecycle contracts pass on the exact release head: grant, benefit changes, renewal/expiry, cancellation/revocation/disabled, outage, mismatched activation and environment isolation.
- [ ] Live Polar Sandbox transitions (not mocks) are exercised on the exact final candidate for both Pro and Team, including cancellation/renewal and checkout-to-activation.
- [ ] Support response **external delivery confirmation**, Windows ACLs, retention/legal-hold and restore, hosted ingress, and **private** policy inventory are proven before selling.
- [ ] Before any Pro or Team production checkout, attach a candidate-specific decision packet with independent review findings, residual risks, owner signoff, backout steps, and documented approved external mutations.

Automated green lifecycle tests demonstrate bounded code contracts only; they do **not** imply Polar product configuration or production merchant readiness.
