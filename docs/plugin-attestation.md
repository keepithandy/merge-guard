# Plugin checksum and attestation

Plugin attestations bind a validated plugin manifest, plugin source, core version, configuration, input, and output findings to SHA-256 content hashes. The attestation has its own deterministic identity and records the plugin/core versions and input kind.

Verification requires the referenced artifacts when available and rejects mismatched hashes or unverifiable identity. Hashes prove that the supplied bytes are the same bytes that were attested; they do not prove that the plugin is safe, correct, reviewed, or signed. This project does not invent a signing authority. A future user-controlled signing workflow may wrap the immutable attestation.

```bash
npm run test:plugin-attestation
```
