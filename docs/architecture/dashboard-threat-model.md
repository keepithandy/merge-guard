# Local dashboard threat model

Tracking: #42 and #68

Boundary contract: `dashboard/architecture-boundary.v1.json`

Last reviewed: 2026-09-21

## Assets

- selected source diffs and patches;
- report fields, including filenames, reasons, PR context, checks, suppressions, and ownership guidance;
- Human Verification session metadata, explicit statuses, tester notes, custom checks, and human-observed runtime defects;
- report-bound verification-progress evidence and its SHA-256 binding;
- the integrity of risk score, readiness, finding identity, and comparison output;
- local filesystem confidentiality outside explicitly selected files;
- browser availability and user control over exports;
- integrity of packaged dashboard assets and the loopback origin.

## Actors and assumptions

In scope:

- a malicious, malformed, deceptive, or oversized selected file;
- untrusted strings inside otherwise valid reports or verification evidence;
- a hostile website probing or rebinding to the loopback server;
- accidental selection of the wrong type or too many reports;
- an exported verification-progress file selected with a different report;
- a previous human Pass being mistaken for current-build evidence;
- runtime-defect text or evidence references being mistaken for deterministic findings;
- stale worker results racing a newer selection;
- a future implementation accidentally adding persistence, execution, network, media upload, or GitHub-write behavior.

Out of scope but documented:

- an attacker who already controls the user's OS account, browser, Node runtime, or installed package files;
- browser/Node zero-day vulnerabilities;
- physical observation or screenshots;
- the truthfulness of human-entered verification observations;
- the trustworthiness of source data before it was placed in a report.

The dashboard does not claim to authenticate reports, prove code safety, execute checks, establish reviewer approval, or validate that a human observation is correct.

## Threats and required controls

| ID | Threat | Required controls | Verification |
| --- | --- | --- | --- |
| DASH-T01 | Active content or report/evidence strings cause DOM XSS | No `innerHTML`, eval, dynamic import, inline script, or user-built navigation; render text with `textContent`; strict local CSP | Malicious-string fixtures and static source scan |
| DASH-T02 | Selected source or verification evidence is exfiltrated | `connect-src 'none'`; no fetch/XHR/WebSocket/EventSource/beacon/ping, telemetry, remote asset, CORS, service worker, server upload, media upload, or GitHub client | Response-header fixture and outbound API static scan |
| DASH-T03 | Oversized/deep input exhausts memory or CPU | Enforce byte, line, depth, cardinality, two-report, one-progress-file, check and runtime-defect limits; worker timeout/cancel; no archives | Boundary and timeout fixtures |
| DASH-T04 | Malformed, legacy, or future schema is silently reinterpreted | Fatal UTF-8 decode; object/tool/schema/required-field checks; explicit v1 legacy migration notice; reject unknown versions before state commit | Malformed, v1, v2, future, scalar, and truncated JSON fixtures |
| DASH-T05 | Loopback server exposes arbitrary files or accepts hostile requests | Bind `127.0.0.1`; ephemeral port; exact Host authority; fixed asset map; GET/HEAD only; no body, CORS, directory listing, symlink, proxy, CONNECT, or upgrade | Server integration cases |
| DASH-T06 | Sensitive Human Verification state persists unexpectedly | Memory-only state; no local/session storage, IndexedDB, Cache Storage, cookie, service worker, server temp file, or remote storage; explicit downloads only; revoke object URLs | Static scan and browser/storage inspection |
| DASH-T07 | Suggested checks, filenames, evidence references, or input data execute code | Never spawn, shell, evaluate, compile untrusted regex, execute imported project code, or treat evidence text as a command/path/module | Static scan and hostile command-string fixtures |
| DASH-T08 | Browser output drifts from authoritative report/scorer or applies human work to the wrong build | Imported reports are display-authoritative; verification evidence requires exact canonical SHA-256 report binding; current-build plan starts Untested; human statuses/defects never change scores/findings | Comparison/binding fixtures and no-recalculation assertions |
| DASH-T09 | Export or error handling leaks more data than selected | User-gesture-only JSON/Markdown downloads; no automatic navigation/upload; no absolute paths, stacks, source excerpts, tokens, or hidden environment data in errors | Export, object-URL revocation, and error-redaction fixtures |

## Abuse cases

**Malicious filename or evidence reference** — display only as text. Never resolve, open, execute, fetch, upload, or send it to the server.

**HTML/Markdown payload** — treat every report and Human Verification string as plain text in the live DOM. The dashboard does not preview exported Markdown as HTML.

**Zip bomb or binary patch** — archives and binary patch bodies are unsupported and rejected. Nothing is decompressed.

**JSON depth/cardinality bomb** — perform bounded structural validation in the worker. New state is not committed until the entire input is accepted.

**DNS rebinding/host confusion** — listen only on numeric IPv4 loopback and reject any Host authority other than the exact printed address and port.

**Score manipulation through human evidence** — a Pass does not lower deterministic risk; a Fail or critical runtime defect does not secretly increase deterministic risk. The report remains unchanged.

**Historical Pass contamination** — a verification session is exact-report bound. Comparison may show historical report context but never copies old Pass into a changed/current report. New/current checks start Untested and resolved report findings are not manual Pass.

**Mismatched verification progress** — show the mismatch, identify evidence/imported report identity when available, and leave the file unapplied and untouched. Never associate by filename, selection order, or suggested-check index alone.

**Runtime defect confusion** — use `human-runtime-defect` structure and “Human-observed runtime defect” language. Never add these records to `report.rules`, risk score, or review-decision logic.

## Security invariants

1. No selected byte crosses the browser-to-server or browser-to-remote boundary.
2. No imported or human-entered value becomes executable code, HTML, a filesystem path, or a network destination.
3. No report score, finding, readiness value, threshold, or `NO_CONFIGURED_BLOCKERS` meaning is recalculated during Human Verification.
4. No suggested/manual check or imported project command is executed by the dashboard.
5. No review state survives reload unless the user explicitly downloads it and later imports it with its exactly bound report.
6. Invalid or mismatched evidence cannot partially replace valid state.
7. The loopback process can read only its explicit packaged asset allowlist.
8. Human runtime defects remain structurally separate from deterministic Merge Guard findings.
9. Human Verification performs no automatic GitHub write, issue creation, media upload, or code change.

## Residual risk

A valid maximum-size file can still consume noticeable local CPU and memory. Packaged code or dependencies can be compromised before execution. Browser extensions can inspect page content. Exported files can later be shared or opened in another renderer with different security behavior. Human-entered evidence can be mistaken or incomplete. These risks are reduced by limits, dependency minimization, exact report binding, local processing, explicit export, and careful product wording, but are not eliminated.

Any implementation exception must name affected threat IDs, include tests, update the manifest/schema and this model, and receive explicit review. It cannot be introduced as an undocumented convenience.
