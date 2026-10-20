# P6 (A–E) — source execution and owner-gated release evidence

**Tracking:** [P6 master issue #205](https://github.com/keepithandy/merge-guard/issues/205). Follow the [post-P5 roadmap](POST_P5_ROADMAP.md) and its separate [commercial launch checklist](commercial-release-checklist.md). This is an operator procedure, **not proof of a production deployment, real benefits, accepted payments or a commercial release**.

## P6A — exact-source candidate record

1. Choose a specific immutable commit; `main` moving later invalidates any assertion that the future checkout is the same candidate. `package.json` declares `1.3.0-beta.2`, an unpublished source identity.
2. Run `npm.cmd test`, `npm.cmd run test:commercial`, `npm.cmd run test:license-persistence`, `npm.cmd run test:subscription-lifecycle`, `npm.cmd run test:security`, `npm.cmd run test:public-contracts`, and `npm.cmd run release:check` from the **same checkout**. Linux uses `npm`.
3. Run `npm.cmd run p6:candidate-evidence`. It uses offline, lifecycle-script-disabled `npm pack` into an OS temporary directory, checks the actual tarball SHA-1 against npm metadata, emits a SHA-256, package version and exact checked-out git commit, and deletes the temporary tarball. **This does not upload or publish anything.** Record the JSON output in a local decision packet without copying secrets or arbitrary environment variables.
4. In [Node LTS Actions](../.github/workflows/node-lts.yml), verify all nine jobs on **one exact PR head** (Node 18/20/22/24 on Ubuntu/Windows and full validation), the four additional fixture/integrity workflows, and the smoke/release matrix. On PR checkout, this workflow explicitly selects the PR head commit rather than the synthetic merge ref. GitHub runs and matrix logs supply the traceable metadata. Different npm/OS toolchains may produce different hashes; record discrepancies rather than assuming one universal tarball hash.
5. Inspect `npm pack --dry-run`, SBOM and distribution gates, CLI offline Free scan, onboarding, local support/policy contracts and the rollback target. CI passing alone does not freeze/sign/approve or publish a release.

**Evidence template:** candidate SHA; package version; tarball SHA-256 and bytes; Node/OS; GitHub Actions run IDs and conclusions; test suite; package/SBOM inspection; license-grace/denial outcome; rollback commit; decision owner; gaps. Gate values are **unverified** until captured for the exact chosen SHA.

## P6B — loopback gateway security boundary

This gateway is a **localhost development service**. The current implementation accepts loopback TCP peers with a canonical localhost Host and matching local port. It rejects caller-supplied `Origin`, `Forwarded`, `X-Forwarded-For`, `X-Forwarded-Host` and `X-Forwarded-Proto`, rather than treating spoofable metadata as authority. It applies bounded in-memory per-peer and salted-hashed-license request limits with no key/IP logging, keeps the concurrency/body/header/timeout bounds, and opens policy files with `O_NOFOLLOW` where available. `npm.cmd run test:p6-gateway` tests attacker headers, cross-org denial, rate-limit responses, source-data minimization and symlink catalog refusal.

**Not a production HTTPS solution.** An upstream TLS proxy normally forwards a public `Host` or `Forwarded` header: this deliberately fail-closed localhost implementation rejects them. Do not expose the Node HTTP socket publicly or deploy behind a proxy until the owner selects the deployment, TLS termination, trusted proxy/IP strategy, WAF/abuse controls, monitoring, capacity, storage, secrets rotation, and a separately tested public ingress contract. The in-memory limits are per-process and not a distributed/global rate limiter. The policy/support root can still be attacked by a sufficiently privileged same-host filesystem adversary; Windows ACLs, directory swapping, key storage and backup encryption remain independently unverified. On incident, disable the ingress/gateway and revoke affected benefits/credentials.

## P6C — private policy inventory and distribution rights

Use `MERGE_GUARD_PRO_POLICY_DIRECTORY` only for a **separate private directory outside this repository**. Run `npm.cmd run p6:policy-inventory` on the owner-controlled host. The read-only inventory emits IDs, versions and SHA-256 of policy JSON (no policy contents or absolute paths) after schema, identity, size and symlink checks; it refuses the checked-in public repository as the source. `npm.cmd run test:p6-policy-inventory` tests negatives. Public `policies/pro-reference` remain MIT examples, **not paid exclusive benefits**.

**Required owner-controlled evidence before P6C may pass:** for each actual paid pack record content rights/licensing, source owner, stable identity and version, approved distribution/sales territories, release digest, lawful redistribution scope, revocation/removal plan, change rollback and repository-publicness inspection. The inventory deliberately emits `rightsCleared: false` and `productionEnabled: false`; only a human/legal decision and safe hosted entitlement delivery can close them. No private packs or paid-policy IP are added to GitHub by this work.

## P6D — real Priority Support operations (owner-run prerequisites)

Customer ticket intake is consent-based and may contain personal contact/message. A ticket UUID means **queued**, not emailed, reviewed, or guaranteed. Use a secure operator machine and `MERGE_GUARD_PRO_SUPPORT_DIRECTORY` with actual OS ACL verification.

- Inspect only metadata with `node scripts/pro-support-operations.js pending --json`, and inspect a selected ticket privately with `node scripts/pro-support-queue.js show <ticket-id>`.
- Draft a reply in an owner-only file and run `node scripts/pro-support-operations.js draft <ticket-id> <reply-file>`. This creates an **unsent** local draft.
- Send through the owner's **separately approved** mail/support tool; put an opaque provider message/delivery reference (no email address or customer text) in a private text file. Run `node scripts/pro-support-operations.js attest-delivery <ticket-id> <reference-file>`; this stores an immutable **operator-attested** reference but does **not** send or independently prove delivery. Only after a real provider confirms the external action, run `node scripts/pro-support-queue.js status <ticket-id> responded`. This transition now requires a valid local attestation. The operator still owns verifying actual delivery.
- To block retention deletion, run `node scripts/pro-support-operations.js hold <ticket-id> legal` (or `incident`/`retention`) to create an owner-only non-replaceable hold marker. Purge excludes held tickets even if the marker is malformed/dangling. There is **no automatic hold release**; an independent owner/legal review must authorize removal of the marker. Document the release in the private operator log and validate backups before any deletion.
- Define assigned support operator, response hours, incident escalation, retention schedule, deletion/subject access obligations, legal hold release authority, secure backup/restore drill and encryption strategy **before** sale. Treat `purge-closed N` without `--apply` as a review, and archive/hold any legally retained case before deletion. Do not paste contacts/messages into public GitHub issues.
- Run `npm.cmd run test:p6-support` for synthetic local receipt, status, malicious-contact, hold, purge and restore contracts. No real message is sent and no real-world SLA, Windows ACL, backup encryption or mailbox is certified.

## P6E — live Polar Sandbox gate (blocked until owner supplies configuration)

Mock tests under `npm.cmd run test:subscription-lifecycle` are **not** live Polar evidence. On a selected frozen SHA, separately exercise real Sandbox Pro and Team product checkout, activation on the correct organization/device, live catalog and actual cleared paid policy, renewal/expiry, cancellation/revocation, reactivation/downgrade, wrong organization/environment/activation, gateway outage, and unchanged offline Free scanning. Never place test license keys, customer records, response bodies, private policies or personal data in GitHub.

**Owner-gated prerequisites:** Sandbox organization/customer test account and benefit IDs; real Pro/Team test checkout products; approved private paid packs; selected infrastructure and TLS gateway model; staffed support and privacy/legal policies. Record only sanitized event category, tested SHA, timestamp, boolean outcome and case link. These prerequisites require an explicit owner/environment decision, not fabricated/mock `PASS`.

## Blockers and rollback

Each phase's current disposition lives in [issue #205](https://github.com/keepithandy/merge-guard/issues/205) and the [commercial launch checklist](commercial-release-checklist.md). Any incomplete production, legal, licensing or operational gate is **BLOCKED**, not waived by local tests. Roll back source changes with a reviewed revert PR; disable the localhost gateway/ingress for abuse; never turn on production checkout, tag, publish, or issue a paid entitlement by implication.
