# Merge Guard local dashboard boundary

The dashboard is currently at the accepted architecture-contract stage. `architecture-boundary.v1.json` is the machine-readable source of truth for the planned local runtime, supported inputs, resource limits, network and storage prohibitions, output behavior, and threat IDs.

There is intentionally no `server.js` or browser application in this issue. The implementation sequence is:

1. #68 — architecture and security boundary;
2. #69 — local diff/report import and the constrained loopback runtime;
3. #70 — report explorer and non-executing verification checklist;
4. #71 — accessible responsive layout and explicit exports.

Run `npm run test:dashboard-architecture` to validate this contract. See `docs/architecture/dashboard-architecture.md`, the accepted ADR, and the dashboard threat model before changing it.
