# Changelog

## Unreleased

- Added project-defined `customRules` with path and added-line regular expressions.
- Custom rule hits now share the normal rule, flag, score, file-risk, and suggested-check output.
- Invalid custom rules are ignored safely and reported as warnings.
- Added optional PR title/body context while keeping diff scoring authoritative.
- Added read-only project check detection from package scripts, root smoke files, and README commands.
- Completed npm/npx package guidance and reusable GitHub Action inputs.

## 0.1.0 - MVP CLI foundation

Initial usable merge-guard MVP.

Included features:

- rules-based diff scanner
- plain text reports
- Markdown reports
- JSON reports
- CI mode
- GitHub PR comment workflow support
- docs-only change detection
- per-file risk breakdown
- risk presets: safe, standard, strict
- rule explanations
- configurable high-risk paths
- configurable test commands
- optional AI-ready review summary prompt output

## Release checklist

Before cutting a release:

- run `npm run smoke`
- run `npm run demo`
- verify `node src/cli.js --markdown examples/sample.diff`
- verify `node src/cli.js --json examples/sample.diff`
- confirm README usage still matches CLI behavior
- update this changelog
- do not publish automatically from an issue pass
