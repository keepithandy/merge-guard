# Merge Guard local dashboard boundary

The dashboard now provides the #69 local-import foundation. `architecture-boundary.v1.json` is the machine-readable source of truth for the local runtime, supported inputs, resource limits, network and storage prohibitions, output behavior, and threat IDs.

Run `node dashboard/server.js` to start the dependency-free loopback shell. It serves only the bundled dashboard assets on `127.0.0.1` and accepts no uploads. Diffs and reports enter only through browser file selection or drag-and-drop and are validated in a module worker.

The implementation sequence is:

1. #68 — architecture and security boundary;
2. #69 — local diff/report import and the constrained loopback runtime;
3. #70 — report explorer and non-executing verification checklist (implemented in the current dashboard shell);
4. #71 — accessible responsive layout and explicit exports.

Each imported report includes a portable Markdown verification-checklist download. It maps each finding to its affected files, rationale, and suggested check so an author can paste the checklist into a pull request or handoff. It is a work log, not an approval signal, and does not alter the imported report.

Checking a finding and adding an optional note updates the downloaded checklist. A separate verification-progress JSON download saves the same work with a SHA-256 binding to the full imported report. Select that file with the original report to resume; a progress file for another report is visible but cannot be applied.

The dashboard lets the user choose which of two reports is earlier, then classifies findings with the same source, rule ID, and path identity used by Merge Guard's report comparator. New findings lead the view, unchanged findings are collapsed, and a configuration change is called out before interpreting score movement. Its Review focus turns those signals, verification progress, and upcoming suppression expirations into an ordered review queue. It is descriptive only: it never alters scores, findings, or merge decisions.

Run `npm run test:dashboard-import` and `npm run test:dashboard-architecture` to validate the import and boundary contracts. See `docs/architecture/dashboard-architecture.md`, the accepted ADR, and the dashboard threat model before changing it.
