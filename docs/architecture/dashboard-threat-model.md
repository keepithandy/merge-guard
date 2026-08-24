# Local dashboard threat model

Tracking: #42 and #68

Boundary contract: `dashboard/architecture-boundary.v1.json`

Last reviewed: 2026-08-24

## Assets

- selected source diffs and patches;
- report fields, including filenames, reasons, PR context, checks, suppressions, and ownership guidance;
- the integrity of risk score, readiness, finding identity, and comparison output;
- local filesystem confidentiality outside explicitly selected files;
- browser availability and user control over exports;
- integrity of packaged dashboard assets and the loopback origin.

## Actors and assumptions

In scope:

- a malicious, malformed, deceptive, or oversized selected file;
- untrusted strings inside otherwise valid reports;
- a hostile website probing or rebinding to the loopback server;
- accidental selection of the wrong type or too many reports;
- stale worker results racing a newer selection;
- a future implementation accidentally adding persistence, execution, or network behavior.

Out of scope but documented:

- an attacker who already controls the user's OS account, browser, Node runtime, or installed package files;
- browser/Node zero-day vulnerabilities;
- physical observation or screenshots;
- the trustworthiness of source data before it was placed in a report.

The dashboard does not claim to authenticate reports, prove code safety, execute checks, or establish reviewer approval.

## Threats and required controls

| ID | Threat | Required controls | Verification |
| --- | --- | --- | --- |
| DASH-T01 | Active content or report strings cause DOM XSS | No `innerHTML`, eval, dynamic import, inline script, or user-built URL; render text with `textContent`; strict local CSP | Malicious-string browser fixtures and static source scan |
| DASH-T02 | Selected source is exfiltrated | `connect-src 'none'`; no fetch/XHR/WebSocket/EventSource/beacon/ping, telemetry, remote asset, CORS, service worker, or server upload | Response-header fixture, outbound API static scan, browser network assertion |
| DASH-T03 | Oversized/deep input exhausts memory or CPU | Check `File.size` before read; enforce byte, line, depth, cardinality, and two-report limits; worker timeout/cancel; no archives | Boundary and timeout fixtures at and above every limit |
| DASH-T04 | Malformed or future schema is interpreted as valid | Fatal UTF-8 decode; object-root/tool/schema/required-field checks; reject before state commit; typed errors | Malformed, legacy, future, scalar, and truncated JSON fixtures |
| DASH-T05 | Loopback server exposes arbitrary files or accepts hostile requests | Bind `127.0.0.1`; ephemeral port; exact Host authority; fixed asset map; GET/HEAD only; no body, CORS, directory listing, symlink, proxy, CONNECT, or upgrade | Server integration cases for traversal, encoded paths, Host changes, methods, and upgrade/connect |
| DASH-T06 | Sensitive review state persists after the session | Memory-only state; no local/session storage, IndexedDB, Cache Storage, cookie, service worker, server temp file, or remote storage; revoke export URLs | Browser storage inspection before/after import, export, and reload |
| DASH-T07 | Suggested checks, filenames, or input data execute code | Never spawn, shell, evaluate, compile untrusted regex, or treat input as a path/module; checklist is display-only | Static scan and hostile command-string fixtures |
| DASH-T08 | Browser output drifts from authoritative report/scorer | Imported reports are display-authoritative; raw diffs and comparisons call shared core modules only; exports preserve values | Cross-runtime report/comparison snapshots and no-recalculation assertions |
| DASH-T09 | Export or error handling leaks more data than selected | User-gesture-only JSON/escaped Markdown downloads; no automatic navigation; no absolute paths, stacks, excerpts, tokens, or environment data in errors | Export escaping, object-URL revocation, and error-redaction fixtures |

## Abuse cases

Malicious filename — display only the basename as text. Never resolve, normalize, open, execute, or send it to the server.

HTML/Markdown payload — treat every report string as plain text in the live DOM. Markdown export escapes control syntax/HTML according to the existing formatter contract; the dashboard does not preview exported Markdown as HTML.

Zip bomb or binary patch — archives and binary patch bodies are unsupported and rejected before parsing. Nothing is decompressed.

JSON depth/cardinality bomb — perform bounded structural validation in the worker and terminate on the time budget. The new state is not committed until the entire input is accepted.

DNS rebinding/host confusion — listen only on numeric IPv4 loopback and reject any Host authority other than the exact printed address and port. Do not trust forwarded headers.

Stale worker response — associate every import with a monotonically increasing request ID. Ignore results that do not match the current request and terminate the prior worker when a new import starts.

Score manipulation — display imported values exactly and identify their schema/tool version. Never lower risk based on UI state, checked checklist items, missing history, suppressed annotations, or PR prose.

## Security invariants

1. No selected byte crosses the browser-to-server or browser-to-remote boundary.
2. No imported value becomes executable code, HTML, a filesystem path, or a network destination.
3. No report score, finding, readiness value, or threshold is recalculated during report viewing.
4. No check is executed by the dashboard.
5. No review state survives reload unless a later, separately authorized contract replaces this invariant.
6. Invalid input cannot partially replace valid state.
7. The loopback process can read only its explicit packaged asset allowlist.

## Residual risk

A valid maximum-size file can still consume noticeable local CPU and memory. Packaged code or dependencies can be compromised before execution. Browser extensions can inspect page content. Exported files can later be shared or opened in another renderer with different security behavior. These risks are reduced by limits, dependency minimization, local processing, explicit export, and clear warnings, but are not eliminated.

Any implementation exception must name affected threat IDs, include tests, update the manifest/schema and this model, and receive explicit review. It cannot be introduced as an undocumented convenience.
