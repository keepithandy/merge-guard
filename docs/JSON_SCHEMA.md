# JSON report schema

merge-guard JSON reports expose a top-level `schemaVersion` so integrations can identify a compatible report contract.

## Version 1.0.0

Required top-level fields:

- `tool` — always `"merge-guard"`.
- `schemaVersion` — currently `"1.0.0"`.
- `version`, `riskLevel`, `mergeReadiness`, `riskScore`, and `docsOnly`.
- `config`, `summary`, `files`, `rules`, `flags`, and `suggestedChecks`.

Optional fields are added only when their related mode is active, including `prContext`, `projectChecks`, `customRuleWarnings`, and `aiReview`.

Compatibility rules:

- New optional fields are additive and keep the same major schema version.
- Required-field removal, type changes, or changed meaning require a new major schema version.
- Consumers should ignore unknown fields and use `schemaVersion` to select parsing behavior.
