# Migrations, upgrades, rollback, and limitations

Keep existing Action inputs and CLI flags when upgrading within a contract version. Review the changelog and rerun `npm run check`, `npm run release:check`, and the documented policy gates before adoption. Configuration and policy manifests are versioned; unknown future schemas fail closed.

To roll back, pin the Action to the prior reviewed commit or restore the prior npm package version, then rerun the same gates. Do not roll back by weakening a threshold or suppressing a finding. Known limitations include local-only analysis, no automatic dependency graph inference, no SARIF upload, and no claim that plugin workers are a hostile-code sandbox.
