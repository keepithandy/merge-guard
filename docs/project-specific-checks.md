# Project-Specific Suggested Checks

merge-guard should prefer concrete project checks when they are available.

## Detection order

1. Read configured checks from `merge-guard.config.json`.
2. Look for common `package.json` scripts:
   - `test`
   - `smoke`
   - `check`
   - `build`
3. Look for root-level smoke files matching `smoke*.mjs`.
4. Fall back to the current generic guidance when no project-specific checks are detected.

## Expected report behavior

Detected checks should appear under `Suggested checks` in plain text, Markdown, and JSON output.

Examples:

```text
Configured check: npm run smoke
Configured check: node smoke_compact_suite.mjs
```

## Guardrail

This feature should detect and print commands only. It should not execute commands.
