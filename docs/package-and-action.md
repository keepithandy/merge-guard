# Package and release verification

## Local package shape

`package.json` exposes the CLI binary:

```json
{
  "bin": {
    "merge-guard": "./src/cli.js"
  },
  "engines": {
    "node": ">=18"
  }
}
```

After local installation:

```bash
merge-guard examples/sample.diff
merge-guard --markdown examples/sample.diff
merge-guard --json examples/sample.diff
merge-guard --doctor
```

After a future npm publication, the intended package invocation is:

```bash
npx merge-guard examples/sample.diff
```

This repository does not publish automatically from validation issues or pull requests.

## Composite Action

The root `action.yml` wraps the same CLI. Its inputs and pull request context behavior are documented in `docs/GITHUB_ACTIONS.md`.

```yaml
- uses: keepithandy/merge-guard@main
  with:
    preset: strict
    fail-threshold: "5"
    comment: "true"
```

## Verification commands

Run the complete local contract set before tagging or publishing:

```bash
npm run smoke
npm run test:cli
npm run test:snapshots
npm run test:review-e2e
npm run test:dashboard-architecture
npm run test:version
npm run test:doctor
npm run test:consumer-fixtures
npm run release:check
npm run demo
node src/cli.js --markdown examples/sample.diff
node src/cli.js --json examples/sample.diff
npm pack --dry-run
```

`npm run release:check` runs every documented local contract gate, including package/runtime/SBOM consistency, local/global/npx-style installation, security, performance, public contracts, artifacts, distribution, and support. `npm run test:review-e2e` separately validates the complete GitHub review path, while `npm run test:dashboard-architecture` validates the accepted local browser/process/file/network boundary. These commands do not publish.

Stage a reviewed immutable candidate with `npm run release:stage -- release/v1.0.0`; the command builds twice from a detached checkout and records the complete subject hashes without signing, tagging, or publishing. The GitHub compatibility matrix runs these contracts on Node 18, 20, 22, and 24 across Ubuntu and Windows. A configured matrix is not a passing result for a candidate; see `docs/releases/V1.0.0_RELEASE_DECISION.md`.

## Manual release checklist

Before a release:

- confirm every required workflow is green on the intended commit;
- update `CHANGELOG.md` and package version intentionally;
- review contract snapshot changes and migration notes;
- verify README and Action examples against current behavior;
- inspect `npm pack --dry-run` contents;
- create tags, packages, and GitHub releases only through an explicit manual release decision.
