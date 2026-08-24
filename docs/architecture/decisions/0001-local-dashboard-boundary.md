# ADR 0001: Local loopback dashboard with browser-memory file processing

Date: 2026-08-24

Status: Accepted

Decision owners: Merge Guard maintainers

Tracking: #42 and #68

## Context

Merge Guard needs a browser interface for exploring local diffs and versioned reports. These artifacts can contain proprietary source, filenames, pull-request text, ownership data, and operational checks. A dashboard must not silently convert a local review tool into a hosted data processor, duplicate the scorer, or create a privileged desktop shell.

The implementation also needs consistent ES-module/worker behavior and response security headers. Opening an HTML file directly with `file://` does not provide that reliable origin or header boundary.

## Decision

Use a dependency-free Node static server bound to `127.0.0.1` on an ephemeral port and a packaged browser application.

The server serves only a fixed asset allowlist and accepts only GET/HEAD. User-selected files never reach the server: an explicit browser file picker or drop gives them to a dedicated module worker, which enforces the versioned limits and returns a validated immutable model. Browser state is memory-only, and exports occur only through explicit Markdown/JSON downloads.

Set a deny-by-default CSP with `connect-src 'none'`; package every runtime asset locally; prohibit accounts, remote origins, telemetry, update checks, service workers, persistent browser/server storage, dynamic code, untrusted HTML, and check execution.

Imported reports retain their values. Raw diffs may be analyzed only through shared Merge Guard core modules. Comparison reuses the stable CLI comparison module.

The exact decision is machine-readable in `dashboard/architecture-boundary.v1.json`. The schema and contract gate prevent implementation drift.

## Consequences

Positive:

- source and reports remain local and in-memory;
- the server has no upload, parser, write, proxy, or arbitrary-file surface;
- browser security headers and module workers behave consistently;
- the dashboard cannot silently phone home;
- shared core modules preserve behavioral alignment with the CLI;
- no account, cloud resource, API key, native installer, or runtime dependency is required.

Costs:

- users must have supported Node.js and start a local command;
- repository-aware data unavailable in an imported report cannot be inferred from a raw diff;
- selected state is intentionally lost on reload;
- browser tests must validate both the static-server headers and worker path;
- future network or persistence features require a new ADR and boundary-contract version.

## Alternatives considered

Hosted web application — rejected because it creates upload, retention, authentication, privacy, and service-operation obligations that contradict local-first scope.

Desktop shell such as Electron or Tauri — rejected for v0.6 because native filesystem/IPC capabilities add a larger privileged surface and packaging burden without being necessary for file picker/drop workflows.

Direct `file://` application — rejected because origin behavior, ES modules, workers, CSP headers, and browser compatibility are less consistent.

Node-side file upload and parsing — rejected because it transfers sensitive file content across another process boundary and creates request-body, storage, and filename/path handling risks.

Reimplemented browser scorer — rejected because it can drift from CLI findings and violate the dashboard's viewer boundary.

Persistent browser cache — rejected because reports may contain sensitive source context, and persistence is unnecessary for the v0.6 review session.

## Revisit criteria

Revisit only if a later roadmap item explicitly requires collaboration, durable local workspaces, a native package, or remote data. The proposal must document migration, consent, encryption/retention, compatibility, and a new threat model; roadmap completion alone does not authorize such a change.
