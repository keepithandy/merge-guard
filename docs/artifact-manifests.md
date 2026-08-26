# Immutable report artifact manifests

Merge Guard artifact manifests provide reproducible provenance for a generated report without embedding the report, local paths, source files, or secrets. The versioned contract is `schemas/artifact-manifest-v1.schema.json` and the implementation is `src/artifactManifest.js`.

Each manifest separates generated metadata from repository evidence:

- `generated` records the tool, tool version, and explicit UTC generation time;
- `evidence` records the repository, commit, input type, branch when available, and resolved configuration;
- `contentHashes` records SHA-256 hashes for the report, configuration, and evidence;
- `report` identifies the compatible report schema and its content hash;
- `artifactId` is the SHA-256 identity of the complete manifest content excluding the ID itself.

Creation requires an explicit commit, repository, input type, configuration, report, and timestamp. `validateArtifactManifest` rejects incomplete, unsupported, malformed, tampered, or identity-inconsistent manifests. Supplying the report to validation also verifies the report content hash.

Manifests are portable JSON metadata. They do not upload, retain, or authenticate the report; users remain responsible for local storage, explicit upload, access control, and retention. Hashes provide integrity checks, not signatures or proof that the evidence is trustworthy.

```bash
npm run test:artifact-manifest
```
