# Impact metadata

Tracking: #136 and #138

Impact metadata is an optional, checked-in description of repository relationships. It gives Merge Guard auditable evidence for impact analysis; it does not run package managers, build tools, project scripts, plugins, or changed code.

The file is never discovered automatically. A caller must supply its repository-relative path with `--impact-metadata`:

```bash
merge-guard changes.diff --impact-metadata .merge-guard/impact.json --json
```

Valid metadata produces an additive `repository.impactGraph`. It does not change risk scoring, suggested commands, existing package ownership output, or required checks.

## Version 1 contract

`schemaVersion` must be `1`. Unknown fields produce warnings; malformed, unsafe, or internally inconsistent metadata has `status: "invalid"` and is not used. A valid file produces `status: "valid"`. An omitted file produces `status: "not-provided"`.

```json
{
  "$schema": "../schemas/impact-metadata-v1.schema.json",
  "schemaVersion": 1,
  "packages": [
    {
      "id": "api",
      "root": "packages/api",
      "dependsOn": ["shared"]
    },
    {
      "id": "shared",
      "root": "packages/shared"
    }
  ],
  "ownership": [
    {
      "path": "config/**",
      "packages": ["api", "shared"]
    }
  ],
  "generatedPaths": [
    {
      "path": "packages/api/generated/**",
      "package": "api",
      "source": "api OpenAPI generation"
    }
  ],
  "repositoryWidePaths": [
    ".github/workflows/**",
    "package.json"
  ]
}
```

`packages` declares stable lowercase IDs, exact repository-relative roots (or `.` for the repository root), and optional direct dependency IDs. Package roots cannot contain glob syntax. Every dependency and every ID referenced by `ownership` or `generatedPaths` must be declared in `packages`. A package cannot depend on itself; IDs, roots, and path records are unique.

`ownership` maps a repository-relative path or glob to one or more declared package IDs. `generatedPaths` maps one generated path or glob to its owning package and names its human-readable source. `repositoryWidePaths` lists files or globs whose impact may span package boundaries. Paths must stay inside the repository; drive-qualified paths, URL-like values, symbolic links (including symlinked parent directories), files outside the repository, and metadata larger than 256 KiB are rejected.

The contract does not infer edges from lockfiles, imports, package-manager configuration, or repository conventions. If metadata is omitted or rejected, affected dependency state remains unknown. The source is included in the JSON report as `repository.impactMetadata` so a reviewer can trace the input and diagnostics.

## Explainable impact graph

Changed paths are evaluated against repository-wide paths first, then generated paths, explicit ownership rules, and finally the longest matching declared package root. Path patterns support `*`, `**`, and `?`. Conflicting ownership or generated-path matches remain unknown and produce diagnostics.

Direct packages own a changed path. Transitive packages are reverse dependents reached only through declared `dependsOn` edges. Repository-wide packages are reported separately. Every traversed edge records the selected metadata source and a reason. Generated files retain their declared human-readable source. Unowned paths, ambiguous matches, invalid metadata, and dependency cycles remain explicit diagnostics or unknown evidence.

`repository.impactGraph.status` is `not-provided`, `unknown`, `complete`, or `partial`. `partial` means at least one path or graph condition could not be classified conclusively. The graph never defines build order or changes the scanner score.

Diff evidence preserves rename endpoints, copy source/destination provenance, binary markers, submodule markers, and generated-file declarations without inspecting their contents. Impact-graph parsing is capped at 2,000,000 bytes. Larger inputs and file markers without git headers produce `partial` graphs with deterministic diagnostics rather than guessed ownership. The existing v1 affected-package mapper remains unchanged for ordinary supported diffs.

Use [`schemas/impact-metadata-v1.schema.json`](../schemas/impact-metadata-v1.schema.json) for editor validation. Merge Guard additionally enforces the runtime safety and cross-reference rules described here.

## Compatibility and performance budgets

Impact metadata is additive. A release-blocking contract compares the established v1 score, readiness, summary, per-file findings, rules, flags, suggested checks, configuration, and affected-package output with and without valid impact metadata. Repositories that omit metadata retain explicit `not-provided` evidence and the same v1 behavior.

The large-graph gate traverses a 750-package explicit dependency chain three times. Every run must finish within 3,000 ms, grow the JavaScript heap by no more than 128 MB, produce all 749 transitive packages and edges, and match the prior run as structured data. This gate runs on every supported Node 18/20/22/24 and Ubuntu/Windows combination.
