# Policy-pack migrations

Tracking: #59

Policy-pack `schemaVersion` and pack `identity.version` serve different purposes:

- increment `identity.version` when the policy's rules, paths, checks, or assumptions change;
- increment `schemaVersion` only when the policy data contract changes incompatibly.

## Missing schema version

Unversioned packs are rejected. Add `"schemaVersion": 1`, move pack metadata under `identity`, and add an explicit `compatibility` object. Do not guess a schema version from field names.

## Legacy schema versions

Schema versions lower than 1 are rejected. The pre-v1 roadmap did not define a stable reusable-pack format, so automatic migration would be ambiguous.

Migrate manually into:

1. `identity` with a stable ID, name, semantic version, and description;
2. `compatibility` with inclusive minimum and exclusive maximum Merge Guard versions plus `reportSchemaVersion`;
3. `rules` using explicit IDs, weights, patterns, and checks;
4. `requiredChecks` using stable IDs, commands, and reasons;
5. `protectedPaths` referencing required checks by ID.

Then run `npm run test:policies` and review every diagnostic.

## Future schema versions

A runtime must reject a pack whose `schemaVersion` it does not understand. Upgrade Merge Guard to a release that documents support for that schema; never rewrite the version number merely to bypass validation.

## Breaking-change process

Any removal, rename, type change, semantic reinterpretation, incompatible nesting change, or altered precedence rule requires all of the following:

1. increment `POLICY_PACK_SCHEMA_VERSION`;
2. add a new machine-readable schema file without deleting prior schemas still under support;
3. add explicit old-to-new field mappings and worked migration examples here;
4. retain fixture coverage for supported legacy readers and new readers;
5. document compatibility windows and rejection behavior;
6. update report and policy conformance snapshots after semantic review;
7. call out whether selecting the migrated pack changes scoring, checks, paths, or exceptions.

Additive optional fields may remain in schema version 1 only when existing fields keep their names, types, nesting, meaning, and precedence. Unknown version-1 fields currently produce warnings and are ignored.

## Rollback

Keep the previous pack file and identity version available until the migrated pack passes conformance. Rollback means selecting the previous validated pack explicitly; it must not involve changing schema numbers or silently falling back after a fatal diagnostic.
