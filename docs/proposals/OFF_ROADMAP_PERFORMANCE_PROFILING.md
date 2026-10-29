# Proposal: Performance Profiling

> Status: proposal only; not approved for implementation. Off-roadmap candidate for review.

## Problem and goal
Measure where scans spend time without altering policy decisions or exposing sensitive source content.

## Proposed scope
Design opt-in local timing for stages, file counts, and repeated work; establish reproducible benchmarks and an overhead budget.

## Acceptance criteria
- User-facing behavior and CLI interface are explicitly specified before implementation.
- Existing Free scan correctness, policy outcomes, and backwards compatibility are preserved.
- Documentation covers errors, examples, and limitations.
- Tests and baseline evidence are reviewed before any implementation PR is marked ready.

## Non-goals and guardrails
No telemetry, remote collection, default verbose output, or speculative optimizations without baseline measurements.
- No changes to application code, billing, hosted Pro/Team features, or `main` in this planning PR.
- Do not merge or publish without explicit owner approval.

## Validation plan
Benchmark small/medium repositories, compare profiling on/off, verify deterministic scan results and bounded overhead.

## Open review questions
1. Does this solve a frequent Free-user problem worth prioritizing ahead of the existing roadmap?
2. Which CLI and JSON compatibility guarantees must be absolute?
3. What is the smallest useful implementation slice and measurable success criterion?

## Decision checkpoint
Await owner review; implementation is not authorized by this document.
