# Commercial release checklist

## Repository

- [ ] `npm test` passes.
- [ ] `npm run test:commercial` passes.
- [ ] `npm run test:license-persistence` passes, including independent CLI processes after denial with writes and deletion blocked, and actual Windows read-only files.
- [ ] A new offline CLI process returns Free despite a surviving paid file; a fresh live grant is required in every process. In-process cache/grace limits match the documented authorization policy.
- [ ] Denial replacement/removal failures produce sanitized warnings and never restore a paid receipt. Production/Sandbox isolation passes in both directions.
- [ ] `npm run release:check` passes.
- [ ] `npm pack --dry-run` contains no secrets or local license state.
- [ ] CLI Free scan works with no Polar configuration.
- [ ] Opt-in Sandbox contracts pass for endpoint selection, environment/organization/key isolation, copied and legacy caches, offline Free fallback, and failed activation/deactivation.
- [ ] Production build IDs/links are preserved; Sandbox IDs are supplied explicitly and never used as production defaults.
- [ ] CLI `plan`, `activate`, `license`, `license clear`, and `account` commands behave as documented.
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
- [ ] Plaintext local key storage, process-argument exposure, and Windows ACL behavior are reviewed before a paid launch; restrictive POSIX creation modes do not prove Windows credential protection.

## Paid benefit delivery

- [ ] Premium Pro benefit has a real delivery path.
- [ ] Team shared-policy benefit has a real delivery path.
- [ ] Support contact/process exists.
- [ ] Pricing page advertises only benefits that can actually be delivered.

## Legal and support

- [ ] Existing MIT boundary is preserved and understood.
- [ ] Any new non-MIT paid content has explicit owner/legal review before sale.
- [ ] Supplier terms/refund/support language is reviewed.
- [ ] Privacy disclosure states that scanner analysis remains local and licensing contacts Polar.

## External release

- [ ] Version/release decision is approved by owner.
- [ ] Tag is created only after approval.
- [ ] npm publication is approved and verified.
- [ ] GitHub release is approved and verified.
- [ ] Stable Action reference move is approved and verified.
- [ ] Production Polar checkout is enabled only after smoke testing.
