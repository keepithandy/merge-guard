# Rule suppressions

Suppressions annotate known findings without changing Merge Guard's risk decision.

```json
{
  "suppressions": [
    {
      "ruleId": "routing-or-entry",
      "pathPattern": "^src/legacy/",
      "reason": "Approved migration tracked separately.",
      "owner": "team-tools",
      "expires": "2027-12-31"
    }
  ]
}
```

## Required fields

- `ruleId`: built-in rule ID or custom rule ID. A custom suppression may use the configured ID or `custom:<id>`.
- `reason`: why the exception exists.
- `owner`: person or team responsible for removing it.
- `expires`: ISO date in `YYYY-MM-DD` form.

`pathPattern` is optional. When present, at least one file matched by the finding must satisfy the case-insensitive safe regular-expression subset documented in [custom rules](custom-rules.md). Unsafe expressions are ignored and reported in `suppressionWarnings`.

## Active suppressions

An active matching suppression copies the finding into `suppressedFindings` with its reason, owner, expiry, and path pattern. The original finding remains in `rules`.

Suppressions never:

- remove findings;
- reduce file or report scores;
- change risk level or merge readiness;
- bypass `failThreshold`.

## Expired and invalid suppressions

Expiry is evaluated in UTC by calendar date. A suppression whose `expires` date is earlier than the current date is not applied and produces a warning.

Malformed entries, missing required fields, invalid dates, invalid path expressions, and duplicate rule/path pairs are ignored and exposed in `suppressionWarnings`. Valid but unmatched suppressions remain in `config.suppressions` and create no `suppressedFindings`.

Deterministic active, expired, unmatched, and malformed examples are covered by `npm run test:snapshots`.
