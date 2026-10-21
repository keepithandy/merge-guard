# Free-first development and local Pro/Team kits

**Owner direction, October 20, 2026:** no server budget; prioritize the Free tool. Hosted P6B–E operations, P8 collaboration services and P9 production rollout are **parked**, with source/evidence preserved. They are not prerequisites to Free development. First source slice: [#208](https://github.com/keepithandy/merge-guard/issues/208).

## A product shape within that budget

| Offer | Useful outcome | Delivery shape | Status |
| --- | --- | --- | --- |
| **Free** | Complete MIT scanner, custom rules, starter policies, shared configuration, Action and dashboard | Existing local source/package/Action; explicit `init` setup | Existing tool; setup source work in #208 |
| **Pro workflow kits** | Save a developer the work of assembling a task-specific review process | Proposed original policies, safe/risky example diffs, expected findings, review recipes, version manifest and upgrade notes | Design only; no paid kit delivered or offered for sale |
| **Team adoption kits** | Give a small team a consistent process in its own repository | Proposed Pro kit plus shared root/package policies, report-only CI templates, contributor/exception/ownership guides and upgrade checklist | Design only; no hosted workspace, seats or paid Team product delivered |

Value comes from useful content and ready-to-adapt examples. Importing and sharing policies stays Free. All already-public MIT packs, including `policies/pro-reference`, remain public examples and cannot be advertised as exclusive paid content. There is no Merge Guard server in this design: files live on the user's machine and optionally their own repository. Kits upload no diffs, install no workflows automatically, and execute no project commands by themselves.

## First kit candidates for owner review

These are proposed content packages, not current benefits:

1. **Pro release-review kit:** an example `merge-guard.config.json` containing original release/configuration custom rules; synthetic safe/risky diffs with expected findings; a verification worksheet; installation/removal instructions; file versions and SHA-256s. Add original useful material beyond the public release-integrity reference pack.
2. **Team adoption kit:** a small multi-package policy manifest selecting existing starter IDs; a report-only Action template; ownership/exception worksheets; contributor guide; upgrade/rollback instructions. Use the team's own Git workflow and access controls; promise no remote sharing or seat management.

Use the formats already supported: new local rules belong in the config's `customRules`; policy manifests select the current built-in starter IDs. The generic policy-pack schema alone is not an offline arbitrary-pack importer. Do not tell customers to pass a downloaded private pack ID to `--policy-config` or `--pro-policy`; the latter remains the parked live-gateway path. A future general local pack loader would need its own bounded implementation and tests.

Each ZIP needs a content owner, approved rights/usage terms, compatibility range, file inventory/hashes, positive/negative fixtures, a clean-machine offline walkthrough and a secret/customer-data check. Explicit installation must preserve existing files; removal must restore prior configuration. CI execution and external posting stay user-controlled.

If Pro/Team license holders already exist, inventory their purchased terms and obtain owner approval before changing benefits or billing. Capability flags do not establish customer promises. This source redesign changes no license/subscription behavior.

## Price, delivery and support

Free remains $0. The former $9/month Pro and $29/month Team hosted targets are historical and **parked**. A one-time versioned kit purchase is a candidate; price and future update purchases remain undecided. Do not create recurring obligations to preserve tier names.

Payment processing and private downloads are separate owner decisions. This work selects no provider, creates no account, enables no checkout and promises no fee-free processing. Manual delivery may suit an initial owner-approved kit, but has not been set up or exercised here.

Provide written installation/troubleshooting material and the existing voluntary Free feedback process. Promise no priority-response SLA, unlimited custom configuration, 24/7 service, lifetime updates, hosted storage or automatic sync. Downloads can be copied: rely on clear content terms and useful releases, not new DRM or a paid gate on MIT features.

## Execution order

1. Land Free `init`: minimal config, preview, no overwrite, unchanged default reports, refusal tests and supported-runtime review.
2. Choose the next reproduced Free usability/reliability problem, one bounded source slice at a time. Synthetic fixture passes do not establish population accuracy.
3. Prepare one local kit prototype for owner review. Public prototypes are examples, not exclusive paid inventory. Confirm rights and useful buyer value before designating content paid.
4. After the kit is tested, decide terms, price, delivery and any existing-customer commitments. Account, billing and publication actions still need specific authorization.

Old hosted runbooks remain for a future capacity/budget decision; their checklist is not an instruction to buy a server. Existing Polar checks remain fail-closed. A downloaded policy is not an offline paid license grant.
