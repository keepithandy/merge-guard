# Policy inheritance and expiring exceptions

Tracking: #40 and #62

A repository policy manifest selects starter packs for the repository root and package scopes. Selection remains explicit:

```bash
node src/cli.js --policy-config merge-guard.policies.json change.diff
```

The CLI rejects simultaneous `--policy` and `--policy-config` options. The composite Action exposes the same `policy-config` input.

## Manifest schema

```json
{
  "schemaVersion": 1,
  "root": {
    "policy": "frontend",
    "exceptions": []
  },
  "packages": [
    {
      "root": "packages/core",
      "inherit": false,
      "policy": "library",
      "exceptions": []
    },
    {
      "root": "packages/core/tools/cli",
      "inherit": true
    }
  ]
}
```

The machine-readable contract is `schemas/policy-manifest-v1.schema.json`. Manifests are limited to regular, non-symlink files inside the repository and to 1 MB.

## Resolution precedence

Each changed path resolves independently:

1. start with the root policy, if selected;
2. visit every matching package scope from shortest root to longest root;
3. `inherit: false` clears the inherited policy at that scope;
4. an explicit package `policy` selects or replaces the current policy;
5. a package with `inherit: true` and no policy retains the nearest ancestor policy;
6. the longest matching package scope determines the path used for policy expressions.

For example, a library policy inherited by `packages/core/tools/cli` evaluates `packages/core/tools/cli/src/index.js` as `src/index.js`. Findings still report the actual repository path.

Duplicate package roots are fatal `conflicting-package-scope` errors. Unknown policies, unsafe roots, invalid inheritance types, duplicate exception IDs, and an empty manifest are also fatal. Repeating the already inherited policy is valid but produces a warning.

## Provenance

JSON reports include `policyResolution` with:

- manifest schema and source path;
- one assignment per changed path;
- effective starter and policy-pack IDs/versions;
- source and evaluation roots;
- package-relative matched path;
- the complete root-to-package provenance chain;
- validation and unmatched-exception warnings.

Text and Markdown output include the effective policy and source scope for every changed path.

## Exception contract

Exceptions are scoped to the root or one package entry:

```json
{
  "id": "core-export-transition",
  "target": {
    "type": "rule",
    "id": "public-api-change"
  },
  "pathPattern": "^src/index\\.js$",
  "reason": "The compatibility shim remains during the documented transition.",
  "owner": "@library-maintainers",
  "expires": "2026-12-31"
}
```

Every exception requires:

- a globally unique lowercase `id`;
- an existing `rule`, `protectedPath`, or `requiredCheck` target in the effective policy;
- a package-relative `pathPattern` no longer than 500 characters;
- a non-empty `reason` and `owner`;
- a real UTC `expires` date in `YYYY-MM-DD` form.

The expiry date remains active through that UTC date. Earlier dates are rejected as expired. Patterns that match all representative repository paths are rejected as blanket exceptions. Missing metadata, invalid targets, invalid patterns, duplicate IDs, exceptions under a no-policy scope, and blanket or expired entries are fatal.

## Non-destructive semantics

Exceptions are annotations only. An active exception can annotate a policy rule finding, protected-path match, or required check, but it never:

- removes or hides a finding;
- changes a rule weight or total risk score;
- removes a required check;
- removes specialized-review guidance;
- bypasses CI failure thresholds;
- implies approval.

Reports expose matched entries under `policyExceptions.active` and unmatched annotations separately. Each annotation retains target, path scope, reason, owner, and expiry.

## Conformance

```bash
npm run test:policy-resolution
```

Fixtures cover root selection, inherited package selection, explicit override, inheritance clearing, nested longest-root precedence, package-relative matching, conflicting roots, rule/protected-path/check exceptions, missing metadata, unknown targets, blanket patterns, expired dates, provenance, and score invariance.
