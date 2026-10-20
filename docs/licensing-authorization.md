# Licensing authorization and persistence

## Security defect and reproduction

At PR #195 baseline `58950db1de6ba95cee729a756a2977dc92adc543`, provider validation and the subsequent local write shared one catch block. A successful response denying access (including an organization mismatch) followed by a write failure entered the transient-outage fallback and could return Pro through grace. For HTTP 401/403/404, writing the rejected state could throw instead, leaving an older paid file that the next CLI trusted for its 24-hour cache. An actual Windows read-only file reproduces the surviving-file condition.

The regression suite uses synthetic credentials, mocked responses, actual read-only files, and injected EPERM write/replacement/removal failures. No customer credentials or purchases are required.

## Authorization policy

The license file is a credential record, not an authorization token. Every new Node/CLI process must obtain a successful live Polar grant before it can authorize Pro or Team. Existing and legacy paid files do not bootstrap either cache or grace. Free scans do not invoke licensing or need network access.

Within a running process, a successful live activation/validation creates a private receipt bound to the selected state path, environment, organization, exact key, benefit mappings, and observed credential-file contents. A synchronous disk summary is unverified and cannot claim a paid plan. Replacing or removing the credential file invalidates a receipt. Successful validation can be reused for 24 hours; only transport failures, HTTP 429, and HTTP 5xx may use the receipt for up to seven days from the last live grant. Expiration and future validation timestamps cannot extend these limits. Offline responses never refresh the receipt timestamp.

All definitive HTTP 4xx denials except 429, and successful responses reporting revocation, disablement, cancellation, expiration, wrong organization, unknown status, or unmapped benefit, return Free and invalidate the receipt before persistence. A denial also invalidates older in-flight requests so their delayed grants cannot restore access. A later explicit successful live validation can establish a new grant. Invalid provider responses do not qualify for grace.

Provider request handling is separate from local persistence. A successful live grant stays live if its save fails, with a sanitized warning. A denial never becomes a transient error: save Free state first, try removing stale state if saving fails, and report both failures if neither succeeds. Environment-key overrides cannot overwrite or delete a different stored key's device activation. Production and Sandbox use separate paths and authorization contexts.

Writes serialize before touching the destination and use an exclusive same-directory temporary file, restrictive POSIX creation modes, fsync, close, and atomic replacement. A failed replacement preserves the original bytes until denial cleanup removes them. Cleanup is best effort, and authorization never depends on its success. Deactivation clears process receipts before contacting Polar and explicitly reports remote and local cleanup failures.

## Why persistent offline grants were removed

If a process observes a denial while every persistent location is unwritable, it cannot leave a durable revocation marker. A subsequent process sees the same old file whether a denial occurred or not. A tombstone, second cache, or in-memory flag cannot solve that indistinguishability. Trusting that file offline in the second process would preserve the vulnerability.

The chosen fail-closed policy therefore requires fresh live validation in each process. It deliberately removes offline paid startup across shell/CLI restarts. Legitimate users retain bounded grace only in a process that already obtained its own live grant. There is no option to restore disk-authorized offline startup. Free features remain available during outages.

An existing long-running process may reuse its own live receipt within the stated cache/grace windows. This is not instantaneous global revocation: another process's denial cannot be broadcast through unwritable storage. No file-based cache can guarantee that property. Consumers needing immediate provider-state checks use `force: true`; even then, outage handling follows the bounded same-process grace policy. The current CLI starts a fresh process per command and never inherits another process's receipt.

## Automated evidence

`npm run test:license-persistence` covers both environments, HTTP 400/401/403/404/422, invalid activation rejection, revoked/disabled/canceled/expired responses, wrong organizations/benefits, expired and invalid timestamps, serialization/open/write/fsync/replacement/removal failures, actual Windows read-only files, delayed in-flight grants, deactivation failures, key overrides, and process-local grace/expiry limits.

The independent-process regression seeds a recent Pro file, denies validation while all filesystem writes and removals are blocked, verifies the paid bytes survived unchanged, then starts another real CLI process with an offline provider. That second process must attempt live validation and return Free. A separate live-grant process can return Pro despite failed storage, but its next offline successor must again return Free. All provider calls in these tests are mocked.

The suite is registered in `npm test`, `test:commercial`, release readiness, and the Node 18/20/22/24 Ubuntu/Windows compatibility workflow. Passing internal contracts is not proof of live checkout or subscription processing.

## Live evidence and remaining launch work

The owner reports successful Sandbox Pro activation, live validation, Pro after restarting PowerShell, and device deactivation to Free. The tested commit has not been recorded. Those observations are not attributed to this fix and must be repeated on the exact reviewed commit to validate its changed startup policy. Team delivery, real cancellation/revocation lifecycle, and production checkout are not established by mocked tests.

Local credentials remain plaintext. POSIX mode 0600/0700 does not configure or prove Windows ACL protection, and inherited ACLs need separate verification. If every removal fails, a restrictive temporary file may survive; it contains credentials, never paid authorization. The legacy activation interface still puts the key in process arguments. Secure credential storage, safer key input, terms/privacy/refunds/support, production public configuration, checkout/portal, and real benefit delivery remain launch gates.

The next product phase should implement and verify one concrete Pro premium-policy delivery path plus its support/entitlement lifecycle before taking payments. Team delivery/support requires separate proof. Preserve all existing MIT capabilities as Free.
