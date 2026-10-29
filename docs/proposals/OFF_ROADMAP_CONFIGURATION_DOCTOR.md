# Proposal: Configuration Doctor

> Status: proposal only; not approved for implementation. Off-roadmap candidate for review.

## Problem and goal
Offer an explicit, read-only diagnostic command to identify configuration and environment problems before a scan.

## Proposed scope
Specify checks for malformed JSON, unknown keys, missing referenced files, invalid paths, and incompatible options; show actionable fixes and clear status codes.

## Acceptance criteria
- User-facing behavior and CLI interface are explicitly specified before implementation.
- Existing Free scan correctness, policy outcomes, and backwards compatibility are preserved.
- Documentation covers errors, examples, and limitations.
- Tests and baseline evidence are reviewed before any implementation PR is marked ready.

## Non-goals and guardrails
Never auto-rewrite config or execute commands; avoid network dependency and changes to normal scan behavior.
- No changes to application code, billing, hosted Pro/Team features, or `main` in this planning PR.
- Do not merge or publish without explicit owner approval.

## Validation plan
Fixtures for malformed config, missing files, Windows paths, permission errors, and clean setup; ensure no files mutate.

## Open review questions
1. Does this solve a frequent Free-user problem worth prioritizing ahead of the existing roadmap?
2. Which CLI and JSON compatibility guarantees must be absolute?
3. What is the smallest useful implementation slice and measurable success criterion?

## Decision checkpoint
Await owner review; implementation is not authorized by this document.
