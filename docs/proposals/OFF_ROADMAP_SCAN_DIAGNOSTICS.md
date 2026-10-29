# Proposal: Scan Diagnostics

> Status: proposal only; not approved for implementation. Off-roadmap candidate for review.

## Problem and goal
Make scan findings explainable with stable rule identifiers, evidence, and precise remediation.

## Proposed scope
Define a structured finding with rule ID, severity, evidence path/line when available, rationale, and recommended next step; keep existing risk scoring unchanged.

## Acceptance criteria
- User-facing behavior and CLI interface are explicitly specified before implementation.
- Existing Free scan correctness, policy outcomes, and backwards compatibility are preserved.
- Documentation covers errors, examples, and limitations.
- Tests and baseline evidence are reviewed before any implementation PR is marked ready.

## Non-goals and guardrails
Document output compatibility for existing CLI and JSON consumers; no changes to risk policy or labels.
- No changes to application code, billing, hosted Pro/Team features, or `main` in this planning PR.
- Do not merge or publish without explicit owner approval.

## Validation plan
Unit tests for missing evidence, duplicate findings, stable ordering, and unchanged legacy output; golden snapshot tests.

## Open review questions
1. Does this solve a frequent Free-user problem worth prioritizing ahead of the existing roadmap?
2. Which CLI and JSON compatibility guarantees must be absolute?
3. What is the smallest useful implementation slice and measurable success criterion?

## Decision checkpoint
Await owner review; implementation is not authorized by this document.
