# Proposal: Report Comparison

> Status: proposal only; not approved for implementation. Off-roadmap candidate for review.

## Problem and goal
Compare two saved local scan reports to highlight newly introduced, resolved, and unchanged findings.

## Proposed scope
Define finding identity, matching behavior, schema version handling, deterministic ordering, and human-readable plus machine-readable summaries.

## Acceptance criteria
- User-facing behavior and CLI interface are explicitly specified before implementation.
- Existing Free scan correctness, policy outcomes, and backwards compatibility are preserved.
- Documentation covers errors, examples, and limitations.
- Tests and baseline evidence are reviewed before any implementation PR is marked ready.

## Non-goals and guardrails
Local/offline only; no dashboard, storage service, or change to how scans score risk.
- No changes to application code, billing, hosted Pro/Team features, or `main` in this planning PR.
- Do not merge or publish without explicit owner approval.

## Validation plan
Golden tests for additions/removals, moved files, duplicates, malformed reports, and backwards compatibility.

## Open review questions
1. Does this solve a frequent Free-user problem worth prioritizing ahead of the existing roadmap?
2. Which CLI and JSON compatibility guarantees must be absolute?
3. What is the smallest useful implementation slice and measurable success criterion?

## Decision checkpoint
Await owner review; implementation is not authorized by this document.
