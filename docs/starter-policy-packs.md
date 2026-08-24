# Starter policy packs

Tracking: #40 and #60

Merge Guard ships five reviewed schema-version 1 starter packs. They are examples with explicit assumptions, not universal best practices. No pack is selected by default.

Select one in the CLI:

```bash
node src/cli.js --policy frontend change.diff
```

Or in the composite Action:

```yaml
- uses: keepithandy/merge-guard@main
  with:
    policy: infrastructure
```

An unknown pack ID fails clearly. Loading or listing a pack does not apply it; `--policy` or the programmatic `applyPolicyPack()` call is required.

## Frontend

ID: `frontend` / `merge-guard.starter.frontend`

Assumes a browser-facing JavaScript or TypeScript application with a root unit/component suite and production build.

Required checks:

- `npm test` for unit and component behavior;
- `npm run build` for production bundling and assets.

The pack highlights browser storage and client-routing changes. Authentication UI paths are protected guidance linked to both required checks.

## Backend

ID: `backend` / `merge-guard.starter.backend`

Assumes an API or service repository with automated tests and reviewable database migrations.

Required checks:

- `npm test` for service and integration behavior;
- `npm run migrate:check` for non-production migration validation.

The pack highlights authorization boundaries and database migrations. It does not run migrations or claim that a migration is safe.

## Library

ID: `library` / `merge-guard.starter.library`

Assumes a reusable npm-style package whose exports and packed files are consumer compatibility boundaries.

Required checks:

- `npm test` for unit and contract behavior;
- `npm pack --dry-run` to inspect the package without publishing.

The pack highlights public exports, package metadata, and compatibility markers. It does not infer semantic-version impact automatically.

## Browser game

ID: `browser-game` / `merge-guard.starter.browser-game`

Assumes a browser game with persistent save data, a render loop, and deterministic smoke coverage.

Required checks:

- `npm run smoke` for startup, save/load, and the primary play loop;
- `npm test` for deterministic state behavior.

The pack highlights save-format and game-loop timing changes. Save paths are protected guidance because existing player progress may depend on compatibility.

## Infrastructure

ID: `infrastructure` / `merge-guard.starter.infrastructure`

Assumes infrastructure-as-code or deployment workflow changes with non-destructive validation and plan review.

Required checks:

- `npm run validate` for configuration syntax;
- `npm run plan` for a non-destructive human-reviewed plan.

The pack highlights workflow permissions/deployments and infrastructure resource definitions. It never applies infrastructure, reads secrets, or treats a generated plan as approval.

## Report behavior

Explicit selection adds:

- a `policyPacks` identity/version record;
- a `config.policyPacks` compatibility record;
- namespaced findings such as `policy:merge-guard.starter.frontend:browser-storage-change`;
- `policyRequiredChecks` with command, reason, pack ID, and pack version;
- required checks at the front of `suggestedChecks`.

Policy rule weights affect the selected report, but built-in preset definitions remain unchanged. Policy findings are marked `policy: true` and `custom: false` so consumers can distinguish their source.

Protected paths are matched separately under `reviewGuidance` and never alter score. See [protected-path and CODEOWNERS review guidance](review-guidance.md).

## Fixtures and conformance

Each pack has a deterministic diff fixture under `test/fixtures/starter-policies/` plus expected finding IDs, score deltas, and required commands in `expectations.json`.

```bash
npm run test:policies
```

The suite validates all five packs, applies each to its fixture, checks deterministic output, verifies explicit-only selection, and rejects unknown or duplicate selection.
