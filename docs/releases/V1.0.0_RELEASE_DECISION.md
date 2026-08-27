# Merge Guard v1.0.0 release decision packet

Status: **PREPARATION IN PROGRESS — AUTHORIZATION PENDING**

This is the owner-facing decision template for a generated v1.0.0 candidate packet. It never authorizes signing, tagging, npm publication, a GitHub release, a stable Action reference, or a Marketplace listing. Passing validation never implies approval.

## Independent release states

| State | Current template value | Meaning |
| --- | --- | --- |
| Prepared | Pending a generated packet | An immutable commit, reproducible artifacts, checksums, and validation evidence are recorded. |
| Approved | Pending | A named owner records the reviewed commit, UTC decision time, and each permitted external mutation. |
| Published | No | An authorized external mutation has completed and its channel identifier is recorded. |
| Verified | No | Post-publication package, digest, installation, release, and Action-reference checks have passed. |

These states are independent: preparation does not imply approval, approval of one channel does not approve another, and publication does not imply verification. The candidate remains unsigned until signing is separately approved and verified.

## Candidate identity and required evidence

The generated packet under `release/v1.0.0/` records the final values for the exact candidate. Do not substitute `main`, a branch name, or a mutable `HEAD` for its full source SHA.

| Evidence | Required record |
| --- | --- |
| Source identity | Full reviewed commit SHA, clean-checkout status, repository URL, Node/npm/toolchain and build time |
| Package | `merge-guard@1.0.0`, archive name, archive contents, and SHA-256 digest |
| SBOM | CycloneDX package name, version, purl, copied SBOM digest, and match with the packaged SBOM |
| Validation | Local contract, installation, security, performance, public-contract, artifact, distribution, support, and readiness results |
| Reproducibility | Two byte-identical clean builds from the same commit and recorded toolchain |
| Platform matrix | Immutable successful run evidence for Node 18, 20, 22, and 24 on Ubuntu and Windows |
| Limitations | The release notes’ supported boundary and known limitations |

`npm run release:stage -- release/v1.0.0` creates the non-publishing packet only from a clean immutable commit. It does not create credentials, sign, tag, publish, or change a release reference.

## Owner decision record

- Decision: **pending**
- Release owner: **not recorded**
- Decision time (UTC): **not recorded**
- Reviewed source commit: **not recorded**
- Evidence packet and checksum manifest: **not recorded**
- Authorized external mutations: **none**

`RELEASE_OWNER_APPROVED=true` may be set only after this record is complete in the controlled release environment. The variable is a guardrail, not evidence of approval.

Each item needs a separate explicit owner decision:

- [ ] sign the complete release-subject manifest with the approved identity;
- [ ] create the immutable `v1.0.0` source tag;
- [ ] publish `merge-guard@1.0.0` to npm;
- [ ] create a GitHub release and attach the approved subjects;
- [ ] create or move any stable GitHub Action reference;
- [ ] publish or update any Marketplace listing.

## Approved publication sequence

1. Confirm the packet’s full candidate SHA, checksums, platform evidence, known limitations, and recovery plan.
2. Record the named owner, UTC decision, and only the external mutations approved for this release.
3. If separately approved, sign and verify the complete manifest before distribution.
4. Execute only the individually approved external mutations; record each channel URL, immutable identifier, and timestamp.
5. Verify published bytes or checksums where exposed, package metadata, clean installation and sample behavior, GitHub release attachments, and stable Action target.
6. Change the state to **Verified** only after the post-publication checks are recorded.

## Abort, rollback, revocation, and support handoff

Before publication, stop on any failed digest, validation, approval, or signature check; quarantine or regenerate the staging directory and leave all channel states false. If a channel is already changed, stop the remaining mutations, record the partial state, notify the release and support owners, and use only separately approved registry, release, or Action-reference remediation.

For a defective published package or Action reference, direct consumers to the last verified immutable package or commit, retain the evidence, revoke the affected provenance or signature statement, mark the artifact withdrawn, and open the support incident process. Do not make rollback appear successful by weakening thresholds or suppressing findings. The detailed operating procedures are in [release artifacts](../release-artifacts.md), [migrations](../migrations.md), [support process](../support-process.md), and [release provenance](../security/release-provenance.md).
