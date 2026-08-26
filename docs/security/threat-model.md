# Merge Guard security baseline

The normal scanner is local, deterministic, and dependency-free. Its trust boundary includes the local Node runtime and installed package; untrusted input is the diff and repository metadata. It does not upload content, read tokens, execute changed files, or require credentials. Plugin execution remains an explicitly installed, bounded worker concern documented separately.

Security review scope covers malicious diffs, path and configuration confusion, package tampering, dependency substitution, secret exposure, and generated-artifact integrity. Changes that add network access, runtime dependencies, credential use, or code execution require a new review and threat-model update.
