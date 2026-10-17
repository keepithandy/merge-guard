# Merge Guard product tiers

Status: commercial foundation. Pricing is proposed until the Polar products and checkout links are created.

## Product boundary

Merge Guard's existing public MIT feature set remains Free. Features already released under MIT cannot be made exclusive retroactively. Pro and Team are additive commercial entitlements for new paid delivery/support surfaces.

| Capability | Free | Pro | Team | Status | Implementation |
| --- | :---: | :---: | :---: | --- | --- |
| Deterministic diff scan | Yes | Yes | Yes | Existing | CLI and analyzer |
| Text/Markdown/JSON/PR/SARIF output | Yes | Yes | Yes | Existing | CLI/report formatters |
| Custom rules and suppressions | Yes | Yes | Yes | Existing | `src/customRules.js`, suppressions |
| Starter policy packs | Yes | Yes | Yes | Existing | `policies/starter/` |
| Report comparison and local trends | Yes | Yes | Yes | Existing | comparison/trend modules |
| Local dashboard | Yes | Yes | Yes | Existing | `dashboard/` |
| Polar plan/license state | — | Yes | Yes | Implemented | `src/commercial/` |
| Premium policy delivery | — | Yes | Yes | Commercial entitlement | Requires paid benefit content before launch |
| Priority support | — | Yes | Yes | Commercial entitlement | Requires support channel before launch |
| Shared policy delivery | — | — | Yes | Commercial entitlement | Requires Team delivery package before launch |
| Team support | — | — | Yes | Commercial entitlement | Requires support process before launch |

## Pricing target

- **Free — $0**
- **Pro — $9/month**
- **Team — $29/month**

Annual pricing is deliberately deferred until monthly checkout is verified.

## Positioning

**Free** proves Merge Guard is useful and keeps the complete existing open-source scanner usable indefinitely.

**Pro** is for professional individual developers who want official paid entitlement, premium policy delivery, and priority support.

**Team** includes Pro and adds shared policy delivery and team-oriented support.

## Commercial integrity rules

1. Do not advertise a paid capability until its delivery path exists and is tested.
2. Do not remove existing MIT capabilities from Free.
3. A missing, invalid, revoked, or temporarily unreachable license must never break Free scanning.
4. Paid plan detection is centralized in `src/commercial/entitlements.js`.
5. Polar IDs and checkout URLs are configuration, never hard-coded credentials.
