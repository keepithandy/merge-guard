# Pro fulfillment — staged implementation

**Status:** Implementation preview. Not deployed to paying customers. Production Polar checkout stays disabled. All existing Free/MIT analysis and starter packs remain available.

## Included workflows

1. **Premium policy during scanning.** Run merge-guard --pro-policy release-integrity examples/sample.diff. The CLI requires a fresh live Polar Pro/Team grant, requests the versioned policy from the configured fulfillment gateway, verifies its SHA-256 and schema, and applies it to the diff locally. Diffs, reports and source files are never uploaded. Policy content is not cached.
2. **Priority support intake.** Set MERGE_GUARD_SUPPORT_CONTACT to your reply email. Save an issue description in a regular text file (maximum 4KB). Run merge-guard support submit issue.txt. A successful response prints a ticket UUID; an owner-controlled queue stores the contact, issue, time, and status. No license key is saved in the ticket. Queue acceptance does not guarantee a response time.
3. **Gateway.** The separate Node HTTP gateway independently checks every requested license against the selected Polar environment, organization, Pro/Team benefit mapping, and expiration. Invalid, revoked, expired and cross-environment keys are denied. The gateway has no public interface and defaults to Sandbox.

Both endpoints require a locally activated device and pass its activation ID to Polar validation; a raw unactivated license key is insufficient for fulfillment.

Three working policies in `policies/pro-reference/` cover release integrity, CI trust boundaries and dependency provenance. **They are public example content, not exclusive paid intellectual property.** Production paid-only content must be privately provisioned outside this public repository with appropriate distribution rights.

## Run a local Sandbox test

From the repository's current feature branch, in one PowerShell terminal configure the already-established Sandbox Polar IDs and set:

~~~powershell
$env:MERGE_GUARD_PRO_POLICY_DIRECTORY = (Resolve-Path .\policies\pro-reference).Path
$env:MERGE_GUARD_PRO_SUPPORT_DIRECTORY = "$HOME\MergeGuardSandboxSupport"
$env:MERGE_GUARD_PRO_GATEWAY_PORT = '8787'
npm.cmd run pro:gateway
~~~

The gateway binds **127.0.0.1 only**. Leave that terminal open.

In another PowerShell terminal with the same Sandbox Polar IDs and a previously activated Sandbox Pro license, set:

~~~powershell
$env:MERGE_GUARD_PRO_SANDBOX_SERVICE_URL = 'http://127.0.0.1:8787'
node src/cli.js pro policies
node src/cli.js --pro-policy release-integrity examples/sample.diff

$env:MERGE_GUARD_SUPPORT_CONTACT = 'you@example.com'
'Please review my release pipeline.' | Set-Content -Path .\local-support-request.txt
node src/cli.js support submit .\local-support-request.txt
~~~

The operator can triage incoming tickets locally (run these on the gateway host, with the same queue directory configured):

~~~powershell
node scripts/pro-support-queue.js list
node scripts/pro-support-queue.js show <ticket-id>
node scripts/pro-support-queue.js status <ticket-id> open
node scripts/pro-support-operations.js attest-delivery <ticket-id> <provider-reference-file>
node scripts/pro-support-queue.js status <ticket-id> responded
~~~

The show command prints private email and issue text; never post it publicly. The queue does not send mail or guarantee a response time. The operator must actually respond through an approved channel and save an explicit external-delivery attestation before marking the request responded. An attestation is an **operator assertion**, not proof that this software sent a message.

Delete the local request file after testing. Do not commit local support messages, keys, or queue records. The ticket is only written to the owner's selected local directory: no email is sent automatically.

## Additional Phase 3 and 4 functionality

The gateway now has a non-secret `GET /healthz`, a limit of 16 concurrent entitlement requests, bounded request sizes and connection timeouts, terminal escape refusal in tickets and support-root symlink protection. On POSIX, ticket directories must have owner-only permissions. **Windows ACLs are not established by POSIX file modes.** See [policy catalog and security](pro-policy-catalog.md).

`node src/cli.js pro policies` lists policies delivered through the owner-configured gateway after a fresh Pro/Team entitlement check. It does not expose policy bodies, keys or diffs.

To avoid putting a Polar key into your command-line arguments, pipe one key from the clipboard to `node src/cli.js activate --stdin`. Clear the clipboard afterward. The legacy positional key argument remains compatible but less private.

## Configuration and isolation

- MERGE_GUARD_PRO_SANDBOX_SERVICE_URL: HTTPS Sandbox gateway origin or HTTP 127.0.0.1 for Sandbox local testing only.
- MERGE_GUARD_PRO_SERVICE_URL: HTTPS production gateway origin. Never falls back to Sandbox.
- POLAR_BUILD_CONFIG.proServiceUrl: future public production endpoint; currently blank.
- MERGE_GUARD_SUPPORT_CONTACT: optional customer-supplied reply email required to submit a support request.
- MERGE_GUARD_PRO_POLICY_DIRECTORY: gateway's privately provisioned pack directory.
- MERGE_GUARD_PRO_SUPPORT_DIRECTORY: a separate, access-controlled ticket directory.
- MERGE_GUARD_PRO_GATEWAY_PORT: loopback port, default 8787.
- MERGE_GUARD_ALLOW_PRODUCTION_GATEWAY: explicit opt-in string yes, for a separately reviewed production deployment. This does not enable checkout.

The gateway accepts only configured schema-valid policy IDs, and its response hash protects against accidental corruption. It uses the configured Polar API for fresh license validation, not a client-asserted plan. It intentionally does not expose a public HTTP listener. A production deployment requires a hardened HTTPS reverse proxy, rate limiting, abuse protection, monitoring, private policy content, ticket access control, backups, and ticket retention/deletion procedures.

Tickets use unpredictable UUID filenames and POSIX 0600 file/0700 directory creation modes where supported. They include the reply email and free-form issue text, so they contain personal data. Windows ACLs are NOT proven by POSIX mode flags. The owner must establish clear privacy/retention notices and staff an actual response channel. There is no SLA or automated notification system.

## P6 candidate and security proof (source only)

Follow [P6 execution](P6_EXECUTION.md) for reproducible exact-checkout SHA/tarball SHA-256 logs (`npm run p6:candidate-evidence`), the P6 strict **localhost-only** Host/Origin/forwarded-header and in-process rate limits, private policy inventory (`npm run p6:policy-inventory`) and the still-owner-controlled external Sandbox/support/release gates. A reverse proxy configured with public Host/Forwarded headers **will be rejected** until an explicit trusted-ingress design is reviewed. This staging capability is **not production ready**.

## Verify and gate paid launch

Use npm run test:pro-fulfillment, npm run test:commercial, npm test and npm run release:check. The contract tests use mocked Polar responses and a loopback gateway, including revoked license and request-tampering checks.

**The following commercial launch blockers remain:** private paid content and distribution rights; deployed hardened HTTPS and support mailbox; real support response, privacy retention/deletion and Windows ACL controls; live Sandbox E2E on the exact final commit; cancellation/revocation/expiry and Team entitlements; terms/refunds/privacy readiness; and explicit external release/checkout authorization. October 20 live Sandbox exercises occurred before the later source-hardening commits, so they do not verify the final production candidate.

Do not enable production checkout or publish a release based solely on these tests.

## Phase 5B: owner-operated support handling

With `MERGE_GUARD_PRO_SUPPORT_DIRECTORY` set to a secured owner-only queue on the gateway host, the local operator may run:

```powershell
node scripts/pro-support-operations.js pending --json
node scripts/pro-support-operations.js draft <ticket-id> <reply-message-file>
node scripts/pro-support-queue.js show <ticket-id>
node scripts/pro-support-queue.js status <ticket-id> responded
node scripts/pro-support-operations.js purge-closed 90
node scripts/pro-support-operations.js purge-closed 90 --apply
```

`pending` emits only ticket IDs/status/timestamps (no contacts/messages), suitable for owner-owned polling; it **does not** send notifications. `draft` creates a private **unsent** reply-handoff file for an operator to copy into their approved mail client; it does not send email or mark `responded`. The operator should mark responded only after external delivery is confirmed. Draft creation refuses overwrites; messages never leave this host automatically.

`purge-closed N` first previews closed tickets updated at least N days ago; `--apply` irreversibly deletes these local closed records and their ordinary draft/delivery receipt files **unless a retention hold path is present**. Run `node scripts/pro-support-operations.js hold <ticket-id> legal` to create a non-overwriting owner-only retention hold; only an independently approved manual hold release may remove it. Open/queued/responded tickets are excluded; tickets with missing/invalid timestamps are skipped. Backup, legal hold, retention policy and Windows ACL compliance remain the operator's responsibilities. There is no automatic email, support SLA, or hosted customer mailbox.

## Phase 5C — subscription lifecycle regression

Run `npm.cmd run test:subscription-lifecycle` to exercise deterministic mocked Polar state transitions with a real localhost gateway: Pro/Team grants, benefit upgrades/downgrades, expiry, cancellation, revocation, disabled/unmapped benefits, outage/404 denial, wrong organization/activation, and Production/Sandbox isolation. Each paid catalog/fulfillment operation requires a **fresh live validation**; Free scanning is independent of Polar.

These are automated synthetic contracts, not proof of real Polar billing or real renewals. Final-SHA Sandbox Pro **and Team** cancellation/renewal tests and all external commercial launch gates remain outstanding.
