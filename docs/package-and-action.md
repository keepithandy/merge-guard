# Packaging and GitHub Action Notes

## Local CLI package shape

`merge-guard` exposes a package binary through `package.json`:

```json
{
  "bin": {
    "merge-guard": "./src/cli.js"
  }
}
```

After installing locally, the CLI should be available as:

```bash
merge-guard examples/sample.diff
merge-guard --markdown examples/sample.diff
merge-guard --json examples/sample.diff
```

## npx-style usage target

After publishing later, expected usage should look like:

```bash
npx merge-guard examples/sample.diff
```

Publishing is intentionally not automated by this repo issue.

## GitHub Action wrapper

The repository includes `action.yml` as a reusable wrapper around the existing CLI.

Minimal workflow example:

```yaml
- uses: keepithandy/merge-guard@main
  with:
    preset: standard
```

Strict workflow example with a prepared diff file:

```yaml
- uses: keepithandy/merge-guard@main
  with:
    preset: strict
    diff-path: change.diff
```

## Release checklist

Before publishing or tagging:

- run `npm run smoke`
- run `npm run demo`
- verify Markdown output
- verify JSON output
- confirm `action.yml` still calls `src/cli.js`
- update `CHANGELOG.md`
- create the release manually
