# Proposal: CLI Error Recovery

> Status: proposal only; not approved for implementation. Off-roadmap candidate for review.

## Problem and goal
Make CLI failures consistent, understandable, and safe to recover from.

## Proposed scope
Catalog error categories and stable exit codes; specify contextual messages, next-action suggestions, and stdout/stderr separation.

## Acceptance criteria
- User-facing behavior and CLI interface are explicitly specified before implementation.
- Existing Free scan correctness, policy outcomes, and backwards compatibility are preserved.
- Documentation covers errors, examples, and limitations.
- Tests and baseline evidence are reviewed before any implementation PR is marked ready.

## Non-goals and guardrails
Do not silently suppress failures, modify files, or change successful command output without a compatibility review.
- No changes to application code, billing, hosted Pro/Team features, or `main` in this planning PR.
- Do not merge or publish without explicit owner approval.

## Validation plan
Table-driven error tests, shell integration tests on Windows/Linux, JSON-output contract tests, and clean exit-code checks.

## Open review questions
1. Does this solve a frequent Free-user problem worth prioritizing ahead of the existing roadmap?
2. Which CLI and JSON compatibility guarantees must be absolute?
3. What is the smallest useful implementation slice and measurable success criterion?

## Decision checkpoint
Await owner review; implementation is not authorized by this document.
