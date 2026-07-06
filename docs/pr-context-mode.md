# PR Context Mode Scope

## Goal

PR context mode should let merge-guard include pull request title/body context alongside the diff report.

## Why

Diffs show what changed. PR text often explains why it changed, what was tested, and what reviewers should pay attention to.

## Behavior target

- accept optional PR title text
- accept optional PR body text
- include that context in plain text, Markdown, and JSON output
- include PR context in AI-ready review summaries when `--ai` is used
- keep risk scoring based on the diff, not PR prose

## Guardrails

- do not invent intent from missing PR text
- do not let PR text override risky diff findings
- do not require GitHub API access for the basic mode
- do not remove current stdin/file diff workflows

## Status

This document scopes the feature. The CLI implementation and smoke coverage still need a focused follow-up pass.
