# Merge Guard local dashboard boundary

The dashboard provides the local-import foundation and Human Verification evidence workflow. `architecture-boundary.v1.json` remains the machine-readable source of truth for the local runtime, supported inputs, resource limits, network and storage prohibitions, output behavior, and threat IDs.

Run `node dashboard/server.js` to start the dependency-free loopback shell. It serves only bundled dashboard assets on `127.0.0.1` and accepts no uploads. Diffs, reports, and verification-progress JSON enter only through browser file selection or drag-and-drop and are validated in a module worker.

The implementation sequence remains:

1. #68 — architecture and security boundary;
2. #69 — local diff/report import and the constrained loopback runtime;
3. #70 — report explorer and non-executing verification checklist;
4. #71 — accessible responsive layout and explicit exports.

## Human Verification

Merge Guard tells a reviewer where a change might break. Human Verification records what happened when a person actually exercised those surfaces. It is evidence capture, not automated testing, CI, approval, or a replacement for code review.

Analysis remains first. After importing a report, the dashboard shows comparison context, Review focus, reported files/findings, and suggested checks before the Human Verification area. Starting a verification session creates a current-report plan in which every item begins **Untested**. The user can explicitly choose **Pass**, **Fail**, or **N/A**, add a tester note, add clearly labeled **User-added checks**, and record **Human-observed runtime defects** without converting those observations into Merge Guard scoring findings.

Optional session metadata includes repository/project, branch, pull request number, build/version label, commit SHA, tester, date/time, device, operating system, browser/runtime, objective, and an environment note. The dashboard only prepopulates explicit trustworthy report identity fields; unavailable metadata remains unavailable.

A failed item exposes **Record runtime defect**, and a standalone defect can also be created. Defects record severity, component, expected/actual behavior, reproduction steps, optional environment/evidence references, and related check/finding identities. Evidence references are text-only; the dashboard does not persist screenshots, video, or other binary media.

## Durable evidence and compatibility

The existing portable Markdown verification checklist remains available. Human Verification adds a readable **Merge Guard Human Verification** Markdown export plus machine-readable verification-progress JSON.

Verification-progress schema v2 contains the SHA-256 binding to the canonical imported report, report identity when available, session identity/timestamps, environment metadata, explicit check statuses/notes, custom checks, and human runtime defects. Schema v1 files are still accepted. Restoring legacy v1 evidence is explicit in the UI: `completed=true` is migrated to **Pass** and incomplete checks to **Untested**, and a new export writes schema v2.

Evidence is applied only when its report digest exactly matches an imported report. A mismatch is shown and the evidence file is not applied or modified. Comparing reports never carries a previous human Pass into the current report; new/current checks start Untested, while resolved findings remain comparison state rather than becoming manually Passed.

The browser keeps verification state in memory only. Durable state exists only when the user explicitly downloads Markdown or JSON and later restores the JSON with the exact report. No account, backend, telemetry, hosted storage, project command execution, GitHub mutation, media upload, or automatic issue creation is introduced.

Human Verification never changes the imported report, risk score, thresholds, findings, or review decision semantics. Even when all checks are complete, the strongest completion wording is **“Verification complete — no failures recorded.”** It is not merge approval.

Run `npm run test:dashboard-architecture`, `npm run test:dashboard-import`, `npm run test:dashboard-comparison`, `npm run test:dashboard-verification-progress`, `npm run test:dashboard-review-focus`, `npm run test:dashboard-explorer`, and `npm run test:dashboard-accessibility` to validate the workflow and boundary contracts. See `docs/architecture/dashboard-architecture.md`, the accepted ADR, and the dashboard threat model before changing it.
