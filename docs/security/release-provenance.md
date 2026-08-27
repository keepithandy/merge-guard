# Release provenance flow

Release provenance binds an immutable source commit to the exact subjects an owner reviews and, if separately authorized, publishes. It records evidence; it does not grant approval.

## Required record

Generate provenance from a clean checkout of the final reviewed commit. Record the package name/version, repository and full commit SHA, build command, UTC time, operating system, architecture, Node and npm versions, source-normalization policy, exact tarball/SBOM/notes/decision/check outputs, every subject SHA-256, release-gate results, clean-build digests, signature status, and independent prepared/approved/published/verified states.

Do not claim reproducibility from one artifact or metadata normalization alone. Two clean builds from the same commit and recorded toolchain must produce byte-identical subjects. A source change invalidates the artifact and every derived checksum.

`npm run release:stage -- <new-release-path>` implements the local non-publishing half of this contract. It records two same-toolchain package digests and scopes the claim accordingly. It does not replace the supported-platform matrix, independent CI evidence, owner approval, or signature verification.

## Approval and recovery boundary

A named release owner reviews the immutable source commit, package contents, SBOM, digest manifest, release notes, known limitations, required CI, and rollback plan. The approval record identifies the reviewed commit, UTC time, and each allowed external mutation. Passing validation or setting an environment variable without that record is not approval.

Signing is separately authorized. Sign the complete manifest or provenance subject set with the approved release identity, then verify the signature and signer before distribution. Never create, retrieve, print, or persist signing or registry credentials during validation.

If any subject or claim is invalid, stop remaining mutations, revoke the affected provenance or signature statement, mark the artifact withdrawn, preserve the evidence, notify the release and support owners, and use the separately approved rollback path in [migrations](../migrations.md). The full procedure is in [release artifacts](../release-artifacts.md).
