# Polar setup for Merge Guard

This document contains the manual account-level work needed after the repository commercial foundation is merged.

## Products

Create two recurring products in Polar:

### Merge Guard Pro

- Price: **$9/month**
- Attach a **License Keys** benefit.
- Record the generated benefit ID as `MERGE_GUARD_POLAR_PRO_BENEFIT_ID`.
- Record the checkout URL as `MERGE_GUARD_PRO_CHECKOUT_URL`.

### Merge Guard Team

- Price: **$29/month**
- Attach a separate **License Keys** benefit.
- Record the generated benefit ID as `MERGE_GUARD_POLAR_TEAM_BENEFIT_ID`.
- Record the checkout URL as `MERGE_GUARD_TEAM_CHECKOUT_URL`.

Keep Team fixed-price for the first release. Polar supports seat-based billing, but Merge Guard should not enable it until seat ownership and team delivery are real product requirements.

## Organization configuration

Set:

```text
MERGE_GUARD_POLAR_ENVIRONMENT=production
MERGE_GUARD_POLAR_ORGANIZATION_ID=<Polar organization UUID>
MERGE_GUARD_POLAR_PRO_BENEFIT_ID=<Pro license-key benefit UUID>
MERGE_GUARD_POLAR_TEAM_BENEFIT_ID=<Team license-key benefit UUID>
MERGE_GUARD_PRO_CHECKOUT_URL=<hosted checkout link>
MERGE_GUARD_TEAM_CHECKOUT_URL=<hosted checkout link>
MERGE_GUARD_POLAR_CUSTOMER_PORTAL_URL=<hosted portal link>
```

Never commit real customer license keys or Polar organization access tokens.

## Build-time public configuration

Before publishing a production package, copy the organization ID, Pro/Team benefit IDs, checkout URLs, and customer-portal URL into `POLAR_BUILD_CONFIG` in `src/commercial/config.js`. These identifiers/URLs are public product configuration, not authentication secrets. Environment variables remain higher-priority overrides for tests, CI, and alternate distributions.

A production package must not require each customer to know or configure the seller's Polar organization/benefit IDs.

## Opt-in Sandbox licensing

`MERGE_GUARD_POLAR_ENVIRONMENT` accepts exactly `production` or `sandbox`.
Unset or empty selects production. Production uses `https://api.polar.sh`;
Sandbox uses `https://sandbox-api.polar.sh`. Arbitrary base URLs are unsupported,
and license requests refuse HTTP redirects. Invalid selections fail commercial
commands before any state access or request; Free scanning still works offline.

Sandbox does not inherit any `POLAR_BUILD_CONFIG` production IDs or links. Set
the organization and benefit IDs for the selected environment explicitly. The
generic environment overrides above apply to the selected environment: changing
only the selector does not replace overrides already present in your shell.
Production and Sandbox organizations, benefits, keys, and activations are separate.
Do not replace production build configuration with the Sandbox IDs below.

In a fresh PowerShell window, from the repository directory:

```powershell
$env:MERGE_GUARD_POLAR_ENVIRONMENT = 'sandbox'
$env:MERGE_GUARD_POLAR_ORGANIZATION_ID = '84897a3c-12b6-40b4-a96b-9e7b1681a352'
$env:MERGE_GUARD_POLAR_PRO_BENEFIT_ID = 'bf34f3a6-a63a-4ccc-9d0e-882f5426dfa9'
$env:MERGE_GUARD_POLAR_TEAM_BENEFIT_ID = ''
$env:MERGE_GUARD_PRO_CHECKOUT_URL = ''
$env:MERGE_GUARD_TEAM_CHECKOUT_URL = ''
$env:MERGE_GUARD_POLAR_CUSTOMER_PORTAL_URL = ''
$env:MERGE_GUARD_LICENSE_KEY = ''
node src/cli.js plan
```

The output identifies Sandbox and should show Free before activation. These two
UUIDs are public Sandbox configuration, not secrets. No Team Sandbox benefit has
been configured in this example. `.env.example` is a reference; the CLI does not
automatically load dotenv files.

When you already have a test license from this Sandbox Pro benefit, enter it
locally with a masked prompt. Do not paste it into chat, scripts, commits, or a
literal command that will be saved in shell history:

```powershell
$testLicense = Read-Host 'Sandbox Pro test license' -AsSecureString
$licensePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($testLicense)
try {
    node src/cli.js activate ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($licensePointer))
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($licensePointer)
    $testLicense.Dispose()
    Remove-Variable testLicense, licensePointer
}
node src/cli.js license
```

The existing `activate <key>` interface passes the key as a process argument, so
use a trusted local machine. Successful activation stores the key in the local
license file with restrictive creation permissions; public status output omits
the key. The CLI uses unauthenticated customer-portal endpoints and needs no
Polar organization access token. This setup does not create checkout or subscriptions.

### State isolation and migration

- Production retains `~/.merge-guard/license.json` or the exact custom `MERGE_GUARD_LICENSE_FILE` path.
- Sandbox uses `~/.merge-guard/license.json.sandbox`, or appends `.sandbox` to the custom path. Reusing the same override still selects separate files.
- Newly saved state records the environment and organization. A mismatched tagged file is ignored entirely, including its key and activation ID. Paid cache and offline grace require an exact environment, organization, key, and mapped benefit.
- Untagged legacy files are readable only in production, and need one successful live validation before paid cache/grace is available again. They cannot grant Sandbox access.
- `license clear` clears/deactivates only the selected environment. A failed remote deactivation still clears that local file; it does not cancel a subscription.

Use a separate fresh PowerShell window for production so the Sandbox overrides
are not reused. Leave the selector unset or set it to `production`, and use the
production IDs/links or the production package's build defaults.

## Client integration

Merge Guard uses Polar's unauthenticated customer-portal license endpoints, which Polar documents as safe for public clients:

- Activate: `POST /v1/customer-portal/license-keys/activate`
- Validate: `POST /v1/customer-portal/license-keys/validate`
- Deactivate: `POST /v1/customer-portal/license-keys/deactivate`

The CLI does **not** require or embed a Polar organization access token.

**Activation setup:** Polar documents the activation endpoint as necessary when the license-key benefit has device activations enabled. Confirm that both Pro and Team benefits use an activation configuration compatible with this CLI (which calls `activate` before storing a license). Otherwise, direct validation-only benefits require a separately tested CLI activation path before launch.

## Lifecycle

- No license: Free.
- Valid mapped Pro benefit: Pro.
- Valid mapped Team benefit: Team.
- Revoked, disabled, expired, or unmapped benefit: Free.
- Successful validation is cached for 24 hours.
- Temporary network errors, rate limits, or Polar server failures may use a previously validated paid plan for up to seven days, **but never beyond the license expiration date**.
- Definitive Polar client rejections (for example an invalid key or activation) immediately fall back to Free; they never trigger offline grace.
- A cached plan is tied to the exact license key and cannot be reused with a different override key.
- A changed override key cannot reuse another key's device activation.
- After the grace window, failure falls back to Free.
- Free scanning remains available throughout.

## CLI verification

```bash
merge-guard plan
merge-guard activate <license-key>
merge-guard license
merge-guard license clear
merge-guard account
```

## Documentation references

- https://polar.sh/docs/api-reference/benefits/create
- https://polar.sh/docs/integrate/sandbox
- https://polar.sh/docs/api-reference/customer-portal/license-keys/activate
- https://polar.sh/docs/api-reference/customer-portal/license-keys/validate
- https://polar.sh/docs/api-reference/customer-portal/license-keys/deactivate
- https://polar.sh/features/subscriptions
- https://polar.sh/features/seats
