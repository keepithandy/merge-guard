# Commercial dependency and license audit

Date: 2026-10-16

## Source license

The repository root remains MIT licensed. The commercial foundation does not remove, narrow, or retroactively relicense existing Merge Guard source.

## npm dependency surface

`package.json` currently declares no runtime `dependencies` and no `devDependencies`. The commercial implementation intentionally uses Node.js built-ins and the Node 18+ global Fetch API instead of adding a Polar SDK dependency.

Commercial modules use:

- `node:fs`
- `node:os`
- `node:path`
- global `fetch` / `AbortSignal`

This adds no third-party npm license surface.

## GitHub workflow actions

Repository workflows use GitHub-maintained Actions such as `actions/checkout@v4` and `actions/setup-node@v4`. They are workflow dependencies rather than shipped npm runtime dependencies and remain covered by the repository's existing CI/security review.

## Polar boundary

The CLI calls only Polar's documented public-client customer-portal license-key endpoints. It does not ship a Polar organization access token and does not add a payment-processing SDK. Billing, tax handling, subscription state, and benefit lifecycle remain in Polar.

## Commercial boundary risk

Existing source is MIT and therefore remains redistributable under MIT terms. Paid plans must not claim that already-published MIT functionality is newly exclusive. Pro/Team value must come from new paid delivery/support benefits or separately licensed future material reviewed before sale.

## Result

No new third-party package license blocker was introduced by this commercial foundation. Production launch still requires owner review of supplier terms, refund/support language, and any future non-MIT paid content.
