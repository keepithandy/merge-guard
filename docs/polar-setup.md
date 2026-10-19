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
- https://polar.sh/docs/api-reference/customer-portal/license-keys/activate
- https://polar.sh/docs/api-reference/customer-portal/license-keys/validate
- https://polar.sh/docs/api-reference/customer-portal/license-keys/deactivate
- https://polar.sh/features/subscriptions
- https://polar.sh/features/seats
