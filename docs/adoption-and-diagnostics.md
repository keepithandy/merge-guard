# Adoption and diagnostics

Merge Guard v1.1 focuses on a predictable first-use path. It is local-first: it does not send telemetry, upload repository data, execute discovered project commands, fetch plugins, or publish packages while helping a user diagnose setup.

## Supported journey matrix

| Journey | Prerequisites | Successful result | Common failure and next action | Uninstall or rollback |
| --- | --- | --- | --- | --- |
| Source checkout | Node.js 18+, a reviewed checkout | `node src/cli.js --doctor` reports healthy; a supplied diff produces a report | Unsupported Node or invalid local configuration: run `--doctor --json`, fix the named contract, then retry | Return to the prior reviewed commit; do not weaken a threshold or suppression |
| Local package archive | Node.js 18+ and a locally built `.tgz` | Install the archive into an isolated prefix and run `merge-guard --doctor` | Archive/install mismatch: rebuild from the reviewed source and compare the package checksum | Uninstall from the isolated prefix or restore the last verified archive |
| npm package | A separately authorized, verified npm publication | `npx merge-guard --doctor` reports the published package identity | The v1.0 package is not currently published; do not treat this row as publication approval | Pin or reinstall the last verified npm version after an owner-approved rollback |
| GitHub Action | Checkout permission, complete diff history or an explicit `diff-path` | The Action writes a report and honors the configured threshold | Missing diff history or incompatible input: use the read-only Action example and validate a matching local input file with doctor | Pin a reviewed immutable Action commit; revert caller workflow changes |
| Local dashboard | Node.js and a local browser | Explicitly selected diff/report files render in the loopback dashboard | Unsupported or malformed file: read the typed error, keep the prior valid report, and choose a supported input | Close the dashboard; it has no persistent workspace state |
| Policy manifest | An explicit local JSON manifest | Doctor validates it with `--policy-config <file>` | Invalid or expired policy contract: doctor names the failing field; fix or select a valid manifest | Remove the manifest selection or restore the last reviewed manifest |
| Plugin manifest | An explicit local JSON manifest | Doctor validates it with `--plugin-manifest <file>` | Incompatible or malformed manifest: doctor names the failed plugin contract; do not activate it | Leave the plugin unselected or restore the last reviewed local plugin |

The current v1.0 candidate is prepared but not published. Source checkout, local package, and immutable Action-commit paths are usable now; a public npm package path is deliberately pending a separate release decision.

## Doctor command

Run doctor from the repository root you want to inspect:

```bash
merge-guard --doctor
merge-guard --doctor --json
merge-guard --doctor --json --policy-config merge-guard.policy.json
merge-guard --doctor --json --plugin-manifest plugin.json --action-inputs action-inputs.json
```

Doctor checks the Node runtime, Merge Guard package and SBOM identity, local configuration, explicitly supplied policy/plugin manifests, current-directory repository markers, bundled Action inputs, and an optionally supplied JSON object representing caller Action inputs. It is read-only: it does not analyze a diff, run project code, change files, access the network, discover parent directories, or contact GitHub.

Human output identifies each check as `PASS`, `WARNING`, `ERROR`, or `NOT-CONFIGURED` and includes a next action when one is useful. `--json` produces the versioned `doctor` schema:

```json
{
  "schemaVersion": 1,
  "tool": "merge-guard",
  "version": "1.0.0",
  "command": "doctor",
  "healthy": true,
  "checks": [
    {
      "id": "configuration",
      "status": "pass",
      "message": "Configuration is valid.",
      "nextAction": null
    }
  ]
}
```

The checks are always emitted in the documented order. The command exits `0` when no check has status `error`, and `1` otherwise. Optional configuration, policy, plugin, and caller Action input files report `not-configured` rather than an error when they are not selected.

Doctor deliberately omits supplied values and absolute filesystem paths from its output. A caller Action-input JSON file should contain only normal Action inputs; never place a token, secret, repository excerpt, or other sensitive value in it.

## Action input validation

`--action-inputs` accepts a local JSON object whose keys match the documented composite Action inputs. It validates supported names, Action-style string values, boolean values, the risk preset, threshold, mutually exclusive `policy`/`policy-config`, and repository-relative paths. When a configuration requests `comment: "true"`, doctor emits an advisory because the caller must deliberately grant `pull-requests: write`.

This local input check does not inspect a live GitHub workflow, grant permissions, invoke the Action, or verify a token. The restricted-permission fixture at `test/fixtures/consumer-conformance/restricted-permission-action/` demonstrates a report-only setup with `contents: read` and comments disabled.

## Consumer conformance fixtures

`npm run test:consumer-fixtures` validates small, public fixtures for a standalone Node project, npm workspace, Python project, mixed project, forked pull request, and restricted-permission Action. The fixtures contain only metadata and a prebuilt diff; the test never runs their package, Python, or Action commands.

`npm run test:doctor` verifies stable text/JSON doctor output, safe failure behavior, selected policy/plugin/Action input validation, and output redaction.
