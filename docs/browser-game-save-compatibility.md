# Browser-game save compatibility

The explicit `browser-game` starter policy adds deterministic compatibility evidence for literal browser-storage keys and numeric save-version markers changed in a diff. It is opt-in and does not affect repositories that select no policy or a different policy.

Merge Guard records:

- literal keys passed to `localStorage` or `sessionStorage` calls in added and removed lines;
- numeric `SAVE_VERSION`, `saveVersion`, or `save_version` values in added and removed lines;
- migration evidence from changed migration paths or added migration calls;
- focused checks for old-key loading and pre-change save migration.

A removed or renamed storage key produces `review-required` evidence. A changed save version without migration evidence produces a separate concern. Migration evidence changes that version result to `migration-present`, but it is not proof that the migration is correct; the old-save check remains advisory and is never executed automatically.

The scanner only reports literal evidence present in the supplied diff. Dynamic keys, compatibility code outside the diff, and semantic migration correctness remain unknown. The result does not change risk scoring, claim that old saves are safe, read browser storage, execute game code, or modify save data.

```bash
node src/cli.js --policy browser-game --json change.diff
```

The additive `saveCompatibility` report field uses schema version 1 and contains `status`, storage-key and save-version evidence, migration evidence, concerns, and checks. Focused checks participate in the three-item reviewer plan.
