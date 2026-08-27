# v1.0 release artifacts

The v1.0 artifact flow separates preparation, approval, publication, and verification. A locally built package may be prepared and validated without being approved, signed, or distributable. The current decision template is [the v1.0 packet](releases/V1.0.0_RELEASE_DECISION.md).

## Prepare from an immutable source

1. Select a reviewed clean source commit and record its full SHA.
2. Run the complete release, installation, security, performance, public-contract, artifact, distribution, and support gates without release credentials.
3. Build with `npm pack --ignore-scripts` in a clean environment and record operating system, architecture, Node version, npm version, command, and line-ending policy.
4. Repeat the build from the same commit. Claim reproducibility only when the package bytes and SHA-256 digest match.
5. Inspect the archive for expected regular entries, package-root containment, duplicates, links, credentials, and version consistency.

After the reviewed source is committed, stage into a new output path:

```bash
npm run release:stage -- release/v1.0.0
```

The command refuses tracked changes and an existing output path. It creates a detached checkout, runs the complete release gate, produces two package builds, records their byte identity, and writes a subject manifest and provenance. It does not sign, tag, publish, move an Action reference, or infer owner approval.

## Required release subjects

The staged release set contains the npm tarball, CycloneDX SBOM, release notes, owner decision template, complete release-gate output, SHA-256 subject manifest, and provenance statement. A checksum covering only the package does not bind the SBOM, notes, or provenance. Verification must reject missing, duplicate, unexpected, or mismatched subjects.

## Approval, signing, publication, and verification

A named owner must record the exact source commit, reviewed evidence, UTC decision time, and every authorized external mutation. `RELEASE_OWNER_APPROVED=true` is required in the controlled release environment, but it is not approval evidence by itself.

Signing is separately authorized: use only the approved release identity, sign the complete manifest or provenance subject set, and verify the signer before distribution. Never create credentials during validation.

Treat source tagging, npm publication, GitHub release/attachments, stable Action references, and Marketplace listings as independent mutations. After authorized publication, verify the channel package identity, available SHA-256 digest, signature, clean installation and representative analysis, GitHub attachments, Action target, URLs, and timestamps before marking the release verified.

## Abort, revoke, and roll back

Before publication, abort by quarantining or regenerating invalid staging artifacts and leaving every publication state false. If an artifact, digest, signature, or provenance statement is wrong after publication, stop remaining mutations, revoke the affected statement, mark the artifact withdrawn, notify release and support owners, and direct consumers to the last verified release. Registry deprecation, release edits, and Action-reference repair each require separate owner approval. The consumer procedure is in [migrations](migrations.md), and the support handoff is in [support process](support-process.md).
