# Commercial smoke test

Run this only with test/sandbox Polar products until the owner explicitly approves production checkout.

## 1. Free baseline

```bash
npm test
node src/cli.js plan
node src/cli.js examples/sample.diff
```

Expected: plan is Free and the scanner works normally.

## 2. Configure Polar test values

Follow [Opt-in Sandbox licensing](polar-setup.md#opt-in-sandbox-licensing) in a fresh PowerShell window. Explicitly select `sandbox` and set its organization and Pro benefit IDs. Confirm `plan` displays Sandbox and Free before activation. Configure Team only when a separate Sandbox Team benefit exists.

No access token is required. Never commit license keys. This checklist does not authorize purchases, checkout, or subscription creation.

## 3. Pro

1. Use an existing Sandbox Pro test license associated with the configured benefit.
2. Confirm that the benefit has device activations enabled as required by this CLI.
3. Activate using the masked local prompt in the setup guide.
4. Run `node src/cli.js plan`.
5. Restart the shell, reapply the same Sandbox configuration, and run `node src/cli.js license`.
6. Confirm the plan remains Pro and no full key is printed.

## 4. Team

Repeat with the Team test product and confirm plan resolves to Team.

## 5. Revocation

For an existing test entitlement, observe its revocation or cancellation behavior in Sandbox, then force revalidation with:

```bash
node src/cli.js license
```

Expected: revoked/disabled/expired or rejected entitlement falls back to Free and Free scanning still works. Cancellation scheduled for period end may leave a granted license valid until that period ends; check actual entitlement status and expiration. This CLI neither cancels subscriptions nor infers cancellation from billing state.

## 6. Offline behavior

After one successful validation, temporarily block network access and run `plan`.

Expected: the cached plan is used within the documented grace period and a warning is shown when live validation is attempted. After the grace period, Merge Guard falls back to Free.

## 7. Cleanup

```bash
node src/cli.js license clear
node src/cli.js plan
```

Expected: Free.

## 8. Environment isolation

Keep production and Sandbox in separate configured shells. A Sandbox activation must not change the production file or plan. Clearing Sandbox must preserve production state. Switching environments cannot reuse the other environment's cached entitlement, key, or activation. Automated commercial contracts cover both directions, copied files, legacy files, shared custom path overrides, failed activation/deactivation, rejected licenses, and offline fallback using a mocked provider.

Passing automated contracts does not prove live Polar activation or cancellation succeeded. Record live test evidence separately; no live license or subscription is required for `npm test` or release checks.
