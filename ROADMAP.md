# Merge Guard Roadmap

This roadmap tracks the path from the current developer-tool prototype to a stable v1.0 release.

## Active priority

### v0.2 — Stabilization and integration

Tracking issue: [#38](https://github.com/keepithandy/merge-guard/issues/38)

Prove that the merged CLI, configuration diagnostics, suppressions, JSON schema, release checks, project fixtures, and GitHub Actions workflows operate reliably together.

## Planned milestones

| Version | Focus | Tracking |
| --- | --- | --- |
| v0.3 | Repository intelligence | [#39](https://github.com/keepithandy/merge-guard/issues/39) |
| v0.4 | Reusable policy packs | [#40](https://github.com/keepithandy/merge-guard/issues/40) |
| v0.5 | GitHub review experience | [#41](https://github.com/keepithandy/merge-guard/issues/41) |
| v0.6 | Local review dashboard | [#42](https://github.com/keepithandy/merge-guard/issues/42) |
| v0.7 | Baselines and regression tracking | [#43](https://github.com/keepithandy/merge-guard/issues/43) |
| v0.8 | Extensible rule system | [#44](https://github.com/keepithandy/merge-guard/issues/44) |
| v0.9 | Release candidate | [#45](https://github.com/keepithandy/merge-guard/issues/45) |
| v1.0 | Stable release | [#46](https://github.com/keepithandy/merge-guard/issues/46) |

The umbrella tracker is [#47](https://github.com/keepithandy/merge-guard/issues/47).

## Roadmap rules

- A milestone begins only after the prior milestone's exit gate is satisfied.
- Delivery work should be split into narrow, testable issues.
- Risk scoring changes require explicit fixtures and compatibility notes.
- Detected project commands remain read-only until explicitly configured.
- Merge Guard must not require AI, hosted storage, or external services.
- Breaking report, policy, or plugin changes require a schema-version change and migration guidance.
