# Pro fulfillment — staged implementation

**Status:** Implementation preview. Not deployed to paying customers. Production Polar checkout stays disabled. All existing Free/MIT analysis and starter packs remain available.

## Included workflows

1. **Premium policy during scanning.** Run merge-guard --pro-policy release-integrity examples/sample.diff. The CLI requires a fresh live Polar Pro/Team grant, requests the versioned policy from the configured fulfillment gateway, verifies its SHA-256 and schema, and applies it to the diff locally. Diffs, reports and source files are never uploaded. Policy content is not cached.
2. **Priority support intake.** Set MERGE_GUARD_SUPPORT_CONTACT to your reply email. Save an issue description in a regular text file (maximum 4KB). Run merge-guard support submit issue.txt. A successful response prints a ticket UUID; an owner-controlled queue stores the contact, issue, time, and status. No license key is saved in the ticket. Queue acceptance does not guarantee a response time.
3. **Gateway.** The separate Node HTTP gateway independently checks every requested license against the selected Polar environment, organization, Pro/Team benefit mapping, and expiration. Invalid, revoked, expired and cross-environment keys are denied. The gateway has no public interface and defaults to Sandbox.

The working reference policy at policies/pro-reference/release-integrity.json identifies risks in dependency locks, npm lifecycle scripts, publisher configuration, and workflow release permissions. **It is public example content, not proprietary/exclusive paid content**. Actual paid-only content must be privately provisioned and legally reviewed.

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
node scripts/pro-support-queue.js status <ticket-id> responded
~~~

The show command prints private email and issue text; never post it publicly. The queue does not send mail or guarantee a response time. The operator must actually respond through an approved channel and mark the request responded or closed.

Delete the local request file after testing. Do not commit local support messages, keys, or queue records. The ticket is only written to the owner's selected local directory: no email is sent automatically.

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

## Verify and gate paid launch

Use npm run test:pro-fulfillment, npm run test:commercial, npm test and npm run release:check. The contract tests use mocked Polar responses and a loopback gateway, including revoked license and request-tampering checks.

**The following remain unverified owner launch gates:** private paid content and licensing terms; owner-deployed HTTPS service and support mailbox; verified owner response lifecycle and retention handling; end-to-end Sandbox live fulfillment on the exact candidate commit; Pro cancellation/revocation/expiry; Team-specific benefits; safe customer key input, Windows credential protection, terms/refunds/privacy/support; and explicit release/checkout approval.

Do not enable production checkout or publish a release based solely on these tests.
