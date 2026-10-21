# Merge Guard product tiers

**Active direction:** Free-first development with no maintainer server budget. Hosted operations are parked. Pro/Team downloadable kits are a proposal in [the local product plan](LOCAL_FIRST_PRODUCTS.md); no new paid kit, price or delivery commitment is live.

## Product boundary

Merge Guard's existing public MIT feature set remains Free. Features already released under MIT cannot be made exclusive retroactively. Future Pro/Team kits would sell original content and convenience while using the same local Free scanner. Custom rules, policy sharing/import, Action templates and the dashboard remain Free.

| Capability | Free | Pro | Team | Status | Implementation |
| --- | :---: | :---: | :---: | --- | --- |
| Deterministic diff scan | Yes | Yes | Yes | Existing | CLI and analyzer |
| Text/Markdown/JSON/PR/SARIF output | Yes | Yes | Yes | Existing | CLI/report formatters |
| Custom rules and suppressions | Yes | Yes | Yes | Existing | `src/customRules.js`, suppressions |
| Starter policy packs | Yes | Yes | Yes | Existing | `policies/starter/` |
| Report comparison and local trends | Yes | Yes | Yes | Existing | comparison/trend modules |
| Local dashboard | Yes | Yes | Yes | Existing | `dashboard/` |
| Polar plan/license state | — | Yes | Yes | Implemented | `src/commercial/` |
| Premium remote policy delivery | — | Prototype | Prototype | Parked hosted foundation | Live-validated local gateway; no live paid service |
| Priority support | — | Prototype | Prototype | Parked hosted foundation | Local queue only; no staffed SLA or response commitment |
| Shared policy delivery / Team support | — | — | Capability flags | Parked entitlement model | No hosted Team product delivered |
| Local workflow kits | — | Proposed | Proposed | Design only | Original policies, example diffs, review recipes and versioned package |
| Repository adoption kits | — | — | Proposed | Design only | Shared config/workflow examples and adoption/upgrade guides |

The current gateway implements an authenticated policy catalog and three **public reference** packs, but is a **sandbox-testable implementation**, not a live paid service. The public examples are not exclusive paid content. See [Pro fulfillment](pro-fulfillment.md) for exact commands and launch blockers.

## Pricing status

- **Free — $0**
- **Pro / Team — undecided; no active kit offer**

The former $9/month Pro and $29/month Team hosted targets are historical and parked. A one-time versioned download is a candidate, not an approved price or lifetime-update promise. Existing customer terms and any billing change require owner review; no license/subscription behavior changes here.

## Positioning

**Free** proves Merge Guard is useful and keeps the complete existing open-source scanner usable indefinitely.

**Pro (proposed)** would save developers setup time with tested workflow kits. Existing public packs are examples, not exclusive paid content.

**Team (proposed)** would add repository-local adoption materials. It promises no hosted collaboration, seats, automatic sync or priority-response SLA. Actual content rights and payment/delivery remain undecided.

## Commercial integrity rules

1. Do not advertise a paid capability until its delivery path exists and is tested.
2. Do not remove existing MIT capabilities from Free.
3. A missing, invalid, revoked, or temporarily unreachable license must never break Free scanning.
4. Paid plan detection is centralized in `src/commercial/entitlements.js`.
5. Polar IDs and checkout URLs are configuration, never hard-coded credentials.
