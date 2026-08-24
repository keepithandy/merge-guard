# Repository intelligence

Tracking: #39 and #58

Merge Guard inspects repository metadata to make suggested checks and package impact auditable. Inspection is read-only: detected commands are reported but never executed.

## Report fields

Normal CLI JSON reports retain the schema-version 1 `projectChecks` string array and add:

- `projectCheckDetails`: ordered command records with `command`, `category`, `ecosystem`, and one or more `sources`.
- `repository`: detected layout metadata, warnings, package boundaries, and `affectedPackages`.
- `repository.affectedPackages.directPackages`: packages that directly own changed paths.
- `repository.affectedPackages.sharedFiles`: changed paths outside detected package roots.
- `repository.affectedPackages.sharedImpactPackages`: packages potentially affected by repository-level files.

Each source contains a repository-relative metadata path and a plain-language reason. Text and Markdown reports show the same command explanations and a concise repository-impact section.

These fields are additive under `schemaVersion: 1`. Existing field names, types, nesting, scoring, and failure semantics are unchanged.

## Supported JavaScript layouts

Workspace detection supports:

- npm `package.json#workspaces` arrays;
- npm `workspaces.packages` arrays;
- `*`, `**`, and `?` path matching plus leading `!` exclusions;
- nested workspace package roots;
- fallback manifests under `apps/*`, `packages/*`, and `services/*`;
- single root packages.

Malformed manifests and unsafe workspace patterns fail closed and produce warnings. Package ordering and warning ordering are deterministic.

Root JavaScript check detection recognizes npm scripts whose names indicate test, smoke, check, validate, verify, lint, typecheck, build, migration, database, or deployment work. It also recognizes root `smoke*.js`, `smoke*.mjs`, and `smoke*.cjs` files and exact supported commands in a root README.

## Supported Python metadata

Root Python check detection recognizes:

- pytest configuration in `pyproject.toml`, `pytest.ini`, or `setup.cfg`;
- Ruff, Black, and mypy sections in `pyproject.toml`;
- mypy and Flake8 sections in `setup.cfg`;
- Python build metadata in `pyproject.toml` or `setup.py`;
- tox configuration in `tox.ini`;
- root `tests/` or `test_*.py` layouts;
- exact supported Python module commands in a root README.

Supported suggestions include pytest, unittest discovery, Ruff, Black, mypy, Flake8, build, and tox commands. Mixed JavaScript/Python repositories preserve deterministic ecosystem ordering and deduplicate commands found in both metadata and README documentation.

## Affected-package mapping

Diff parsing recognizes modified, added, deleted, and renamed paths. Rename endpoints are mapped independently, so a cross-package move records both the previous and current owning packages.

Ownership uses the longest matching detected package root. This gives nested packages precedence over their parent package. In a single-package repository, the root package owns repository paths.

Paths outside detected package roots are reported as shared files. Every detected package is then listed as potentially shared-impact only. Merge Guard does not infer a dependency edge, transitive impact, build graph, or required execution order.

## Fallback and unsupported cases

When no supported command is found, `projectChecks` and `projectCheckDetails` are empty and the existing generic suggested checks remain unchanged.

The current detector does not:

- execute, install, resolve, or validate a discovered command;
- infer dependencies from lockfiles or imports;
- parse pnpm, Yarn, Rush, Nx, Bazel, Pants, Poetry, uv, or custom task-runner workspace graphs;
- derive Python package boundaries;
- recursively discover verification commands inside every workspace package;
- accept arbitrary README shell lines;
- claim that a repository-level change actually affects every package.

Unsupported or malformed metadata is ignored or surfaced as a warning; it never causes a discovered command to run.

## Conformance gate

Run:

```bash
npm run test:repository
```

The gate executes fixture contracts and deterministic snapshots for npm workspace arrays and objects, fallback monorepo layouts, single packages, JavaScript, Python, mixed projects, malformed and empty projects, nested ownership, root shared files, renames, deletions, and cross-package changes.

The committed baseline is `test/snapshots/repository-intelligence-contracts.json`. Snapshot changes require semantic review; do not regenerate the baseline only to silence a failure.
