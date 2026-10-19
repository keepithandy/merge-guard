# Commercial release checklist

## Repository

- [ ] `npm test` passes.
- [ ] `npm run test:commercial` passes.
- [ ] `npm run release:check` passes.
- [ ] `npm pack --dry-run` contains no secrets or local license state.
- [ ] CLI Free scan works with no Polar configuration.
- [ ] CLI `plan`, `activate --stdin`, `license`, `license clear`, `license clear --local-only`, and `account` commands behave as documented.
- [ ] License updates are atomic and preserve previously valid state after failed writes.
- [ ] Repeated same-key activation does not consume a second device slot; a different key cannot orphan the first device.
- [ ] Polar deactivation failure preserves retryable state; environment key overrides do not overwrite unrelated activations.
- [ ] License keys are absent from command-line arguments, shell history, help output, and test logs for the documented activation flow.
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
