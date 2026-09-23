# Review Checklist

Use this before merging a Merge Guard change.

- Keep analysis read-only unless a command explicitly advertises a mutation.
- Preserve deterministic output for the same repository state.
- Treat missing CI, no diff, detached HEAD, and shallow clones as expected edge cases.
- Keep free/pro/team behavior clearly separated if packaging logic is touched.
- Avoid changing repository history or branch state during inspection.
- Add or update a focused smoke case when changing risk classification or Git parsing.

A safe patch should improve confidence in a merge decision without creating new repository risk.
