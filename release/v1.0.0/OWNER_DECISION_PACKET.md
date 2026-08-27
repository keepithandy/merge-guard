# Merge Guard v1.0.0 owner decision packet

Status: **PREPARED — APPROVAL, SIGNING, PUBLICATION, AND VERIFICATION PENDING**

This packet is non-publishing evidence. Passing checks do not authorize any external action.

## Candidate identity

- Source commit: `636a1e9812bb017dae69be122b36555b89db5e77`
- Package: `merge-guard@1.0.0`
- Artifact: `merge-guard-1.0.0.tgz`
- Artifact SHA-256: `04638057316224a49720f1bcd96be614deb9bf27c272800e12e20314218ee890`
- Reproducible rebuild SHA-256: `04638057316224a49720f1bcd96be614deb9bf27c272800e12e20314218ee890`
- Toolchain: Node `v24.16.0`, npm `11.13.0`, `win32/x64`
- GitHub commit verification: **unsigned** (no signer recorded). This is source-commit metadata, not a claim about an artifact signature.

## Subject checksums

| Subject | SHA-256 |
| --- | --- |
| `merge-guard-1.0.0.tgz` | `04638057316224a49720f1bcd96be614deb9bf27c272800e12e20314218ee890` |
| `SBOM.cdx.json` | `bc16fdfa9c1e8b82e6cba48c4589e7439519b5491f155a9336892103d75a9cad` |
| `RELEASE_NOTES.md` | `bc40feb5d27e53c40bd6f2df056e478cc05071639dc87ff4eb2ac6a1f0f45169` |
| `RELEASE_DECISION.md` | `193b7b9dd54dd41c2eaf187e10c3e1a1cdc10613ff9d00ebe778e494f5707bef` |
| `RELEASE_CHECKS.txt` | `553d17aa37fc74e1bbe661f9b46389b806e422e420b17655fe6ed8856ac07150` |

`SHA256SUMS` also binds this packet and `PROVENANCE.json`.

## Validation

- Local release readiness: **108/108 passed** (full output: `RELEASE_CHECKS.txt`)
- Package and SBOM version consistency, archive installation, security, performance, public contract, artifact, distribution, and support gates are included in that result.
- Reproducibility scope: two byte-identical clean builds from the same detached checkout and recorded toolchain.
- GitHub Actions [Node LTS compatibility run 33117775736](https://github.com/keepithandy/merge-guard/actions/runs/33117775736) passed for this exact source commit: Node 18, 20, 22, and 24 on both `ubuntu-latest` and `windows-latest` (8/8 jobs).
- The only local installation path exercised directly was Windows x64/Node 24. The successful GitHub matrix provides the supported Ubuntu and Windows runtime coverage; it does not prove cross-toolchain byte-for-byte artifact identity.

## Known limitations

- Merge Guard is decision support, does not execute suggested project commands, and does not replace testing or review.
- Repository impact is explicit-metadata based; SARIF is not uploaded; the dashboard is local and non-persistent; plugin workers are not a hostile-code sandbox.

## Owner decision and external mutations

- Prepared: **yes**
- Approved: **pending explicit owner record**
- Published: **no**
- Verified: **no**
- Release-subject signature: **unsigned**
- Authorized mutations: **none**

Known approval gap: no requirement or approval record currently establishes whether the source commit itself must be signed. An owner must separately authorize signing, tag creation, npm publication, GitHub release creation, stable Action-reference changes, and Marketplace actions. Follow RELEASE_DECISION.md for publication, abort, rollback, revocation, and support handoff.
