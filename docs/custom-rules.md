# Custom rules

Projects can add lightweight risk detection in `merge-guard.config.json` without changing Merge Guard source.

```json
{
  "customRules": [
    {
      "id": "payment-provider-change",
      "label": "Payment provider integration changed",
      "pathPattern": "^src/payments/",
      "linePattern": "fetch\\(|Authorization|webhook",
      "weight": 4,
      "check": "Run the payment-provider sandbox smoke."
    }
  ]
}
```

## Fields

- `id`: required stable, unique identifier.
- `label`: required human-readable finding label.
- `pathPattern`: optional case-insensitive safe regular expression for changed paths.
- `linePattern`: optional case-insensitive safe regular expression for added lines.
- `weight`: required integer from `0` through `10`.
- `check`: optional suggested verification step.

At least one of `pathPattern` or `linePattern` is required. When both are present, the same file must match the path and contain a matching added line.

## Output

A match appears in:

- `rules` as `custom:<id>`;
- `flags`;
- the per-file risk breakdown;
- `suggestedChecks`;
- `config.customRules`.

A weight of `0` records an informational match without changing the score.

## Validation and safety

Negative, fractional, string, non-finite, and greater-than-10 weights are rejected. Duplicate IDs, unsafe or invalid regular expressions, malformed entries, and missing required fields are ignored safely and reported through configuration or custom-rule warnings.

Patterns are limited to 500 characters and a linear-time-oriented subset: literals, anchors, character classes, alternation, grouping, escapes, up to eight bounded `?` quantifiers, and at most one unrestricted `.*` wildcard. Backreferences, lookarounds, extended groups, `+`, counted repetition, and other `*` repetition are rejected before matching. This prevents repository-controlled configuration from triggering catastrophic regular-expression backtracking in CI.

Custom rules cannot execute commands, make network calls, or replace built-in rules. Built-in scoring and preset thresholds continue to apply.
