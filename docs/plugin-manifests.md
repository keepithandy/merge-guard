# Local rule-plugin manifests

Plugin manifests define a versioned contract for explicitly installed local rule extensions. Version 1 requires identity, semantic version, Merge Guard/plugin API compatibility, a relative entry point, explicit installation, read-only permissions, an entry-point SHA-256 checksum, deterministic execution checks, a timeout, and a finding limit.

Merge Guard does not discover, download, resolve, or execute plugins from a manifest. A future loader must require an explicit local installation and apply the declared permissions and limits. Unknown permissions, URL entry points, missing checksums, future schemas, and incompatible versions are rejected.

Additive manifest fields require a compatible schema policy. Removed fields, changed types, broadened permissions, altered execution semantics, or incompatible compatibility ranges require a new manifest schema version. See `schemas/plugin-manifest-v1.schema.json`.

```bash
npm run test:plugin-manifest
```
