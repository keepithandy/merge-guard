# Release provenance flow

Before a release candidate, generate the committed CycloneDX SBOM, build the npm tarball without publishing, and record its SHA-256 checksum. A release owner reviews the source commit, package contents, SBOM, checksum, and required CI results. Signing is a separate approval step: sign the checksum/provenance statement with the repository's approved release identity, verify it before distribution, and never create credentials automatically. Publishing is not part of validation.
