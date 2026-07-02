# GitHub Actions report mode

`merge-guard` can run in CI without an AI provider or API key.

Use `--ci` to:

- print a Markdown merge-readiness report to the job log
- write the same report to the GitHub Actions step summary when `GITHUB_STEP_SUMMARY` is available
- fail the job when the report score reaches the configured `failThreshold`

The default `failThreshold` is `7`. You can override it in `merge-guard.config.json`.

## Example workflow

See `examples/github-actions.yml` for a copyable workflow.

```yaml
name: merge-guard

on:
  pull_request:

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Build pull request diff
        run: git diff --no-ext-diff --unified=80 origin/${{ github.base_ref }}...HEAD > pr.diff
      - name: Run merge-guard
        run: node src/cli.js --ci pr.diff
```

## Optional AI-ready summary

Add `--ai` when you want the report to include an AI-ready review summary and adapted review prompt:

```bash
node src/cli.js --ci --ai pr.diff
```

This mode still runs without an API key. The AI section organizes the rules-based findings and includes a prompt package that can be sent to an AI reviewer later. It does not replace human review and does not prove a pull request is safe.
