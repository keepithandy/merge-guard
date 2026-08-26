# v1.0 release artifacts

Build artifacts from a reviewed commit with `npm pack --ignore-scripts`, archive the exact package and release notes, generate a SHA-256 checksum and CycloneDX SBOM, and sign the provenance statement using the approved release identity. Verification compares the checksum, SBOM package/version, signature identity, and required CI results before publication.

Publishing is a separate manually approved step. `RELEASE_OWNER_APPROVED=true` and an identified owner are required for every publish action. Validation never publishes or creates credentials. If an artifact or signature is wrong, revoke the provenance statement, mark the artifact withdrawn, and roll back to the last verified release; the rollback procedure is documented in `docs/migrations.md`.
