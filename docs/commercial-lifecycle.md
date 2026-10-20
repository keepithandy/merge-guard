# Phase 5C — subscription lifecycle verification matrix

This adds deterministic **mock Polar** regression coverage with an actual local HTTP gateway. It does not perform a charge or alter real customer subscriptions.

| Transition | Expected behavior |
| --- | --- |
| Unactivated key | Free; no paid catalog or support |
| Activated Pro | Pro catalog, premium policy and support ticket accepted |
| Pro → Team benefit | Team capabilities recognized, private catalog still live-validated |
| Team → Pro benefit | Shared-policy capability removed immediately on forced validation |
| Renewed Pro grant | New future expiry accepted |
| Canceled / revoked / disabled / expired / unknown | Client and gateway reject paid fulfillment |
| Granted but past expiry | Free and support refused |
| Unknown benefit / wrong organization / wrong activation | Paid fulfillment rejected |
| Polar outage after a live grant | Local offline grace can exist, but **never** authorizes premium policy or support |
| Production with Sandbox loopback | Invalid: no cross-environment fallback |
| Ordinary Free scan during unavailable Polar | Deterministic local scan still runs |

Run:

```powershell
npm.cmd run test:subscription-lifecycle
npm.cmd run test:commercial
npm.cmd test
npm.cmd run release:check
```

These contracts add **no checkout**, email, telemetry or production entitlement. Before selling, independently confirm real Polar Sandbox checkout, renewal, expiration, cancellation, activation and Team mapping on an exact frozen candidate; hosted gateway, staffed support and consumer/legal launch checks remain outstanding.
