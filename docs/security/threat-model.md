# Merge Guard security baseline

The normal scanner is local, deterministic, and dependency-free. Its trust boundary includes the local Node runtime and installed package; untrusted input is the diff and repository metadata. It does not upload content, read tokens, execute changed files, or require credentials. Plugin execution remains an explicitly installed, bounded worker concern documented separately.

Security review scope covers malicious diffs, path and configuration confusion, package tampering, dependency substitution, secret exposure, and generated-artifact integrity. Changes that add network access, runtime dependencies, credential use, or code execution require a new review and threat-model update.

Repository-controlled custom rules, suppressions, and policy patterns are validated against a bounded safe regular-expression subset before evaluation. Unsafe repetition, backreferences, lookarounds, extended groups, and overlong expressions are rejected to prevent regular-expression denial of service.

## P6 commercial gateway security assessment (source scope, 2026-10-20)

The optional `scripts/pro-gateway.js` is a **loopback-only HTTP demonstration**, not a production service. It processes license keys in RAM for fresh Polar entitlement verification and accepts opt-in customer support contact and message text; unlike Free scanning, this **is an explicit network/data-processing subsystem**. User diffs, report bodies, repository source, and policy scans are not sent upstream. Scope and evidence: [Phase 6 execution](../P6_EXECUTION.md), [commercial launch gates](../commercial-release-checklist.md).

| Threat / trust boundary | Current bounded protection | Unverified deployment requirement |
| --- | --- | --- |
| Browser-origin and hostile Host abuse | Loopback TCP peer, canonical Host with exact local port, no `Origin` and no forwarded headers; test synthetic forged headers | Choose trusted TLS proxy and public-host contract; current code intentionally **refuses** public ingress |
| Untrusted rate/spam or worker exhaustion | In-memory source-IP and salted license-fingerprint windows (bounded maps), 16 concurrent entitlement checks, request/header/connection timeouts, bounded JSON | Distributed rate enforcement, upstream request limits, per-account support abuse defense, proxy identity/DoS posture |
| Fake client-paid entitlement | Fresh Polar organization+activation validation per premium request; no client-asserted plan, revoked/expired/grace refusal | Real Sandbox evidence on frozen SHA, production merchant mapping, monitored outage/revocation procedures |
| Policy-file substitution, unauthorized private access | Schema+identity+size enforcement, root/file symlink denial, POSIX `O_NOFOLLOW` when supported, SHA-256 delivered policy, read-only local inventory | Rights-cleared **private** packs, deployment filesystem trust, Windows path/ACL and privileged same-host race review |
| License and PII disclosure | Generic HTTP errors, no secret/PII logging in gateway code, no repository diff uploads, queue owner-only POSIX modes, no automatic mail | Windows ACL validation, secure secrets store, disk encryption, incident handling, per-jurisdiction privacy and retention notices |
| Support false-success, retention data loss | Explicit operator-attested external delivery file before `responded`; nonoverwriting hold marker prevents purge; dry run, bounds and symlink refusal | Real mail-provider delivery proof, audited hold release authority, encrypted backup/restore and incident staffing |
| Untrusted reverse proxy headers | Reject `Forwarded` and `X-Forwarded-*` rather than trusting user-injected identity | Signed or restricted trusted-hop ingress design and negative integration tests before public deployment |

**Known limitations:** a localhost rate limiter is not distributed, and loopback clients on the same host share an address bucket. On Windows, POSIX creation modes do **not** attest NTFS ACL isolation. Concurrent privileged filesystem attackers can still exploit unchecked parent swaps or filesystem mutation outside the test contract. A forged operator reference cannot be independently verified without a real mail-provider integration. A cleared test suite demonstrates bounded functionality, **not a secure production entitlement/payment platform**.

**Owner decisions required before production:** deployment host, TLS termination and Host/forwarding convention, legitimate client IP derivation, storage/keys and ACL controls, private rights/IP attestation, staffed response and retention/legal hold policy, incident/rollback ownership, real Polar Sandbox dual-tier proof, legal/refund/privacy terms, and explicit per-channel release authorization. Until accepted, expose no public listener, make no paid promise, and leave production checkout disabled.
