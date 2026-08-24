# Protected-path and CODEOWNERS review guidance

Tracking: #40 and #61

Merge Guard can explain when a selected policy's protected paths match and can suggest owners from the checked-out repository's CODEOWNERS file. This output is guidance only. It does not assign reviewers, call GitHub, verify identities or permissions, request a review, inspect review state, or claim approval.

GitHub's authoritative behavior is documented in [About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners).

## File discovery

Merge Guard checks the same documented location order:

1. `.github/CODEOWNERS`
2. `CODEOWNERS` at the repository root
3. `docs/CODEOWNERS`

The first regular file found is used. Files 3 MB or larger are skipped with a warning.
Symbolic-link CODEOWNERS files are not followed; the scanner warns and continues to the next documented location.

The scanner reads the checked-out working tree. GitHub evaluates the CODEOWNERS file from the pull request's base branch when deciding platform behavior. If the checked-out file is not the base-branch file, Merge Guard's suggestions may differ from GitHub's. Always verify guidance against the base branch and repository settings.

## Supported syntax

The parser is case-sensitive and supports:

- blank lines and `#` comments;
- trailing comments preceded by whitespace;
- `*`, `**`, and `?` wildcards;
- root-anchored patterns beginning with `/`;
- directory patterns ending with `/`;
- multiple owners on one line;
- `@user`, `@organization/team`, and email-shaped owner tokens;
- ownerless matching entries, reported separately as unowned paths;
- last-matching-entry precedence.

Owner strings are syntax-checked only. Merge Guard cannot prove that an account or team exists, is visible, or has write access.

## Safely unsupported syntax

Lines are skipped with structured warnings when they use:

- `!` negation;
- escaped leading `#` patterns;
- `[ ]` character ranges;
- other escaped pattern syntax;
- malformed empty path segments;
- invalid owner tokens.

These limitations align with GitHub's documented CODEOWNERS differences from gitignore where applicable. Merge Guard intentionally fails closed for syntax outside its tested subset instead of guessing.

## Matching output

`reviewGuidance.codeOwners` contains:

- `sourcePath`;
- `suggestions` with path, owners, matched pattern, source line, and `suggested-unverified` status;
- `unownedPaths` for an ownerless last match;
- `unmatchedPaths`;
- structured warnings.

Renames inspect both old and new paths. Deleted files use their previous path.

Every report includes the disclaimer:

> Guidance only: owners are unverified suggestions and do not prove assignment, write access, a review request, or approval.

## Policy protected paths

When a starter policy is explicitly selected, its protected-path expressions are matched against changed paths. A match records:

- the path and protected-path ID;
- policy pack ID and version;
- the policy's reason;
- linked required checks;
- `specialized-review-suggested` status.

Protected-path matches do not change risk scores. Policy risk rules remain the only policy mechanism that changes score, and only after explicit pack selection.

## Conformance

```bash
npm run test:guidance
```

Fixtures cover location precedence, global and nested patterns, wildcard and last-match behavior, multiple owners, emails, ownerless entries, renamed paths, selected-policy protected paths, malformed lines, unsupported syntax, missing files, and the 3 MB limit. The suite proves that guidance leaves risk, readiness, findings, and suggested checks unchanged.
