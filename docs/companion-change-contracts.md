# Companion-change contracts

Companion-change contracts are an opt-in, deterministic planning primitive for repositories that require related files to move together. A contract has an `id`, a safe regular-expression `trigger`, and one or more safe regular-expression `companions`. When a changed path matches the trigger, every companion expression must match at least one changed path.

The result is advisory evidence: `satisfied` or `missing`, with the triggering and missing paths recorded. It does not execute tests, infer relationships, alter risk scoring, or add fields to the frozen report schema. Invalid expressions are ignored. Repositories can use the primitive from a focused integration or policy layer without making the default scanner noisier.

Example:

```js
{
  "id": "save-migration",
  "trigger": "(^|/)src/save/",
  "companions": ["(^|/)migrations?/", "(^|/)test/"]
}
```

Run the focused contract with `node scripts/companion-change-contracts.js`.
