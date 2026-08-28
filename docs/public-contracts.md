# v1.0 public-contract freeze

The v1.0 promise covers the documented CLI options and exit statuses, JSON report schema v1, policy manifest v1, plugin manifest/API v1, artifact manifest v1, and doctor JSON schema v1. The opt-in impact metadata v1 contract is additive: it adds an explicit CLI option and `repository.impactMetadata` without changing existing report fields or behavior when no metadata is supplied. Additive fields and options are allowed when old consumers continue to work. Breaking changes require a new major version. Deprecated options and fields remain documented for one major release with migration guidance before removal.

The doctor schema uses `schemaVersion`, `tool`, `version`, `command`, `healthy`, and ordered `checks`. Each check has stable `id`, `status`, `message`, and `nextAction` fields. It is a setup diagnostic, not an analysis report: it does not replace or mutate JSON report schema v1.

Unsupported behavior is explicit: Merge Guard does not infer dependency graphs, upload SARIF, publish packages, execute changed files, discover plugins automatically, or provide a hostile-code sandbox. The conformance suites and release-readiness gate must pass against the release candidate.
