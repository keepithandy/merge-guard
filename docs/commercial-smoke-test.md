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

Set the organization ID, Pro/Team benefit IDs, checkout links, and customer portal URL from `.env.example`.

Do not commit those local values.

## 3. Pro

1. Complete a test checkout for Merge Guard Pro.
2. Obtain the generated license key.
3. Run `node src/cli.js activate <key>`.
4. Run `node src/cli.js plan`.
5. Restart the shell and run `node src/cli.js license`.
6. Confirm the plan remains Pro and no full key is printed.

## 4. Team

Repeat with the Team test product and confirm plan resolves to Team.

## 5. Revocation

Revoke/cancel the test entitlement in Polar, then force revalidation with:

```bash
node src/cli.js license
```

Expected: paid entitlement is removed and Free scanning still works.

## 6. Offline behavior

After one successful validation, temporarily block network access and run `plan`.

Expected: the cached plan is used within the documented grace period and a warning is shown when live validation is attempted. After the grace period, Merge Guard falls back to Free.

## 7. Cleanup

```bash
node src/cli.js license clear
node src/cli.js plan
```

Expected: Free.
