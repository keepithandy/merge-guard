# v1.0 public-contract freeze

The v1.0 promise covers the documented CLI options and exit statuses, JSON report schema v1, policy manifest v1, plugin manifest/API v1, and artifact manifest v1. Additive fields and options are allowed when old consumers continue to work. Breaking changes require a new major version. Deprecated options and fields remain documented for one major release with migration guidance before removal.

Unsupported behavior is explicit: Merge Guard does not infer dependency graphs, upload SARIF, publish packages, execute changed files, discover plugins automatically, or provide a hostile-code sandbox. The conformance suites and release-readiness gate must pass against the release candidate.
