# Pro policy catalog and sandbox security

**Parked hosted path:** this prototype is preserved, but the active direction is Free plus [proposed local workflow/adoption kits](LOCAL_FIRST_PRODUCTS.md). Its live-service prerequisites do not block Free development.

Status: **source implementation and Sandbox demonstration**, not a publicly deployed paid offering. Production checkout and npm publication are disabled.

## Available operations

From the configured Polar Sandbox Pro client:

```powershell
node src/cli.js pro policies
node src/cli.js --pro-policy release-integrity examples/sample.diff
node src/cli.js --pro-policy ci-trust-boundaries examples/sample.diff
node src/cli.js --pro-policy dependency-provenance examples/sample.diff
```

The entitled catalog contains a policy ID, display name and semantic version. No policy bytes, source diffs, reports or customer license keys appear in the catalog response. Each catalog and policy request is live-validated independently against the configured Polar organization and activated license. The CLI validates the delivered policy identity, schema and SHA-256, and applies it locally to the diff.

The three packs under `policies/pro-reference/` are **public MIT examples**, not exclusive commercial intellectual property. Production Pro packs require private owner-provisioned content in a non-repository `MERGE_GUARD_PRO_POLICY_DIRECTORY`.

## Secure activation from PowerShell

After copying the license key from the Polar customer portal, you can avoid putting it in a shell command argument:

```powershell
Get-Clipboard -Raw | node src/cli.js activate --stdin
Set-Clipboard -Value 'cleared'
```

The legacy positional activation command is still supported but exposes the key in process args and often shell history. Piped input does not solve all credential-storage or Windows ACL risks.

## Hardened gateway behavior

- `GET /healthz` returns only status and environment for monitoring.
- Pro catalog and support requests are subject to concurrent-request limits (16) and HTTP header/request timeouts.
- JSON request size is limited; only supported endpoints accept requests; errors omit secrets.
- The ticket queue rejects symlink roots and enforces owner-only POSIX directory permissions. Windows ACL safety must be established separately.
- Terminal-control characters are refused in support messages.
- Support tickets never store the license key; status changes remain local owner triage.
- A public deployment still needs HTTPS ingress, reverse-proxy rate limiting, abuse monitoring, backups, alerting, privacy/retention controls and staffed support.

## P6 local security and private-rights inventory

P6's loopback gateway now rejects unintended Host/Origin and client-injected forwarding headers and uses bounded in-process source-IP and salted-key request counters. It cannot accept public-host proxy traffic without a new, separately reviewed trusted ingress design. See [P6 execution and deployment gate](P6_EXECUTION.md). Production TLS, distributed rate limits, Windows ACL verification and secrets/queue backup obligations remain **open**.

The read-only `npm run p6:policy-inventory` validates a private policy directory located outside this public repository and prints IDs, versions and hashes, never policy bytes. It deliberately does **not** assert content distribution rights (`rightsCleared: false`), support private customer-only deployment or turn on paid billing. No exclusive private pack inventory or licensed rights has been supplied.

## Verification

Run `npm.cmd run test:pro-fulfillment`, `npm.cmd run test:commercial`, `npm.cmd test` and `npm.cmd run release:check`. Verify the exact-head GitHub Actions matrix on Windows and Linux.

Source tests verify specified behaviors, not real-world scanner accuracy, hosted production safety, paid entitlement delivery over the public Internet, support staffing or Team features. These remain separate launch gates.
