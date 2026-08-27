# Consumer conformance fixtures

These small, secret-free fixtures model supported adoption paths without running project code or reaching a registry. Contract tests inspect only their checked-in metadata and prebuilt pull-request diff.

- `standalone-node`: one Node package with an optional Merge Guard configuration.
- `npm-workspace`: a private npm workspace with one package member.
- `python`: a Python project identified by `pyproject.toml`.
- `mixed`: a repository with Node and Python project markers.
- `forked-pull-request`: public pull-request event metadata and a prebuilt diff from a fork.
- `restricted-permission-action`: a read-only Action configuration with comments disabled.
