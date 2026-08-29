# Immutable report artifact manifests

Merge Guard artifact manifests provide reproducible provenance for a generated report without embedding the report, local paths, source files, or secrets. The versioned contract is `schemas/artifact-manifest-v1.schema.json` and the implementation is `src/artifactManifest.js`.

The v1.3 prior-evidence selector can bind an explicitly supplied previous report to its manifest, verify the report content hash and manifest identity, and optionally assert repository, branch, and commit identity before finding comparison. See [finding comparisons](finding-comparisons.md).

Each manifest separates generated metadata from repository evidence:

- `generated` records the tool, tool version, and explicit UTC generation time;
- `evidence` records the repository, commit, input type, branch when available, and resolved configuration;
- `contentHashes` records SHA-256 hashes for the report, configuration, and evidence;
- `report` identifies the compatible report schema and its content hash;
- `artifactId` is the SHA-256 identity of the complete manifest content excluding the ID itself.

Creation requires an explicit commit, repository, input type, configuration, report, and timestamp. `validateArtifactManifest` rejects incomplete, unsupported, malformed, tampered, or identity-inconsistent manifests. Supplying the report to validation also verifies the report content hash.

Manifests are portable JSON metadata. They do not upload, retain, or authenticate the report; users remain responsible for local storage, explicit upload, access control, and retention. Hashes provide integrity checks, not signatures or proof that the evidence is trustworthy.

For reproducibility, callers may supply `--generated-at` explicitly. Production's default current timestamp at `generated.at` and the resulting `artifactId` are the only documented generated-metadata variability; report, configuration, and evidence content hashes remain stable. See [durable review evidence reproducibility](evidence-reproducibility.md).

```bash
npm run test:artifact-manifest
npm run test:evidence-reproducibility
```
