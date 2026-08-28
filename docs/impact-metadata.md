# Impact metadata

Tracking: #136

Impact metadata is an optional, checked-in description of repository relationships. It gives Merge Guard auditable evidence for a later impact-analysis slice; it does not run package managers, build tools, project scripts, plugins, or changed code.

The file is never discovered automatically. A caller must supply its repository-relative path with `--impact-metadata`:

```bash
merge-guard changes.diff --impact-metadata .merge-guard/impact.json --json
```

The current implementation validates and reports the metadata only. It does not change risk scoring, suggested commands, existing package ownership output, or required checks.

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

`packages` declares stable lowercase IDs, repository-relative roots, and optional direct dependency IDs. Every dependency and every ID referenced by `ownership` or `generatedPaths` must be declared in `packages`. A package cannot depend on itself; IDs, roots, and path records are unique.

`ownership` maps a repository-relative path or glob to one or more declared package IDs. `generatedPaths` maps one generated path or glob to its owning package and names its human-readable source. `repositoryWidePaths` lists files or globs whose impact may span package boundaries. Paths must stay inside the repository; symbolic links, files outside the repository, and metadata larger than 256 KiB are rejected.

The contract does not infer edges from lockfiles, imports, package-manager configuration, or repository conventions. If metadata is omitted or rejected, affected dependency state remains unknown. The source is included in the JSON report as `repository.impactMetadata` so a reviewer can trace the input and diagnostics.

Use [`schemas/impact-metadata-v1.schema.json`](../schemas/impact-metadata-v1.schema.json) for editor validation. Merge Guard additionally enforces the runtime safety and cross-reference rules described here.
