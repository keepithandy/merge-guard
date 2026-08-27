# Policy-pack contract

Tracking: #40 and #59

Policy packs are versioned, reusable review-policy data. Schema version 1 defines identity, runtime compatibility, custom risk rules, protected paths, and required checks without changing Merge Guard's built-in defaults.

Validation is read-only. It does not select a pack, execute commands, modify scores, assign reviewers, or grant approval.

## Version 1 shape

```json
{
  "schemaVersion": 1,
  "identity": {
    "id": "merge-guard.frontend-base",
    "name": "Frontend base policy",
    "version": "1.2.0",
    "description": "Review policy for a browser-facing application."
  },
  "compatibility": {
    "minimumMergeGuardVersion": "0.1.0",
    "maximumMergeGuardVersionExclusive": "1.0.0",
    "reportSchemaVersion": 1
  },
  "rules": [
    {
      "id": "browser-storage-change",
      "label": "Browser storage behavior changed",
      "pathPattern": "^src/(storage|state)/",
      "linePattern": "localStorage|sessionStorage",
      "weight": 4,
      "check": "Run the browser persistence smoke test."
    }
  ],
  "requiredChecks": [
    {
      "id": "unit-tests",
      "command": "npm test",
      "reason": "The pack requires the root unit suite."
    }
  ],
  "protectedPaths": [
    {
      "id": "authentication-ui",
      "pattern": "^src/auth/",
      "reason": "Authentication UI changes require focused review.",
      "requiredCheckIds": ["unit-tests"]
    }
  ]
}
```

The machine-readable schema is `schemas/policy-pack-v1.schema.json`. Runtime validation is exported as `validatePolicyPack()` from `src/policyPacks.js`.

## Identity

- `identity.id` is a stable lowercase identifier using letters, digits, dots, underscores, and hyphens.
- `identity.name` is the display name.
- `identity.version` is the pack's semantic version, independent of the schema version.
- `identity.description` records selection assumptions. It is recommended; omission is a warning.

IDs are not package download coordinates. Merge Guard does not fetch policy packs from a registry.

## Compatibility

Every pack declares an inclusive minimum Merge Guard version, an exclusive maximum Merge Guard version, and the report schema it targets. Invalid ranges and runtimes outside the declared interval are fatal.

Version comparison uses the numeric `MAJOR.MINOR.PATCH` core. Prerelease and build metadata are accepted but do not alter core ordering in schema version 1.

## Rules

Policy rules use the same behavior fields as project custom rules:

- stable `id` and human-readable `label`;
- `pathPattern`, `linePattern`, or both;
- integer `weight` from `0` through `10`;
- a non-empty suggested `check`.

Patterns use the case-insensitive safe regular-expression subset documented in [custom rules](custom-rules.md) and are limited to 500 characters. Unsafe or malformed rules are fatal for the pack; they are not silently skipped.

Validation only proves the pack contract. Applying rules and selecting starter packs are separate, explicit operations.

## Required checks and protected paths

Required checks have a stable ID, command, and reason. Commands are data and are never run by validation.

Protected paths have a stable ID, regular-expression pattern, reason, and optional references to required-check IDs. Unknown references are fatal. Protected paths describe review guidance; they do not prove that a reviewer approved a change.

## Fatal errors and warnings

Fatal diagnostics make `valid` false and leave normalized `policy` as `null`. Examples include:

- missing, malformed, legacy, or future `schemaVersion`;
- missing identity or compatibility fields;
- incompatible Merge Guard or report-schema versions;
- malformed regular expressions or invalid weights;
- duplicate IDs or unknown required-check references.

Warnings keep the pack valid. Version 1 warns about:

- unknown fields, which are ignored;
- a missing identity description;
- duplicate command strings under different IDs;
- a pack with no rules, protected paths, or required checks;
- a pack targeting an older report schema.

Diagnostics contain `severity`, JSON-style `path`, stable `code`, message, received type, expected value, and migration or upgrade guidance when applicable.

## Safe defaults

Loading or validating a pack never changes the `safe`, `standard`, or `strict` presets, built-in rule weights, thresholds, generic checks, or CI behavior. Pack selection must remain explicit and auditable.

## Conformance

```bash
npm run test:policies
```

Fixtures cover valid, missing-version, malformed, future-version, legacy-version, warning-only, empty, and runtime-incompatible cases. The suite also proves deterministic validation, no input mutation, no command execution, and no implicit built-in score changes.

See `docs/policy-pack-migrations.md` before making any breaking contract change.
