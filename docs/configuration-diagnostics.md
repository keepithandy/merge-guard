# Configuration diagnostics

Merge Guard validates `merge-guard.config.json` before analyzing a diff.

## Fatal diagnostics

The CLI exits non-zero when:

- the file is invalid JSON;
- the top-level value is not an object;
- `preset` is not `safe`, `standard`, or `strict`;
- `failThreshold` is not a positive integer;
- `highRiskPaths` or `testCommands` is not an array of non-empty strings.

Text and Markdown modes print a readable diagnostic list to stderr. JSON mode prints:

```json
{
  "error": "invalid merge-guard.config.json",
  "code": "INVALID_CONFIGURATION",
  "diagnostics": [
    {
      "severity": "fatal",
      "path": "failThreshold",
      "code": "invalid-value",
      "message": "failThreshold must be a positive integer.",
      "receivedType": "number",
      "expected": "integer >= 1"
    }
  ]
}
```

No normal report is emitted for a fatal configuration error.

## Non-fatal diagnostics

Malformed custom-rule entries are ignored so built-in analysis can continue. Their structured warnings appear in the normal report's `configDiagnostics`; rule-normalization details also appear in `customRuleWarnings`.

Suppression validation uses `suppressionWarnings`. See `docs/suppressions.md`.

## Diagnostic fields

Each structured configuration diagnostic contains:

- `severity`
- `path`
- `code`
- `message`
- `receivedType`
- `expected`

Callers should use `code` and `path` for automation and treat `message` as human-readable context.
