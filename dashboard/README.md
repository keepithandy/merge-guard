# Merge Guard local dashboard boundary

The dashboard now provides the #69 local-import foundation. `architecture-boundary.v1.json` is the machine-readable source of truth for the local runtime, supported inputs, resource limits, network and storage prohibitions, output behavior, and threat IDs.

Run `node dashboard/server.js` to start the dependency-free loopback shell. It serves only the bundled dashboard assets on `127.0.0.1` and accepts no uploads. Diffs and reports enter only through browser file selection or drag-and-drop and are validated in a module worker.

The implementation sequence is:

1. #68 — architecture and security boundary;
2. #69 — local diff/report import and the constrained loopback runtime;
3. #70 — report explorer and non-executing verification checklist (implemented in the current dashboard shell);
4. #71 — accessible responsive layout and explicit exports.

Run `npm run test:dashboard-import` and `npm run test:dashboard-architecture` to validate the import and boundary contracts. See `docs/architecture/dashboard-architecture.md`, the accepted ADR, and the dashboard threat model before changing it.
