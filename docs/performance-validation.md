# Performance budgets and soak validation

`npm run test:performance` runs deterministic small, medium, and large unified-diff fixtures. The current budgets are 500 ms, 1 s, and 3 s respectively, with a 128 MiB per-run heap-growth budget and a 2 MB fixture input ceiling. Each fixture is repeated three times and reports are compared byte-for-byte by value. The gate fails clearly when a budget or configured input limit is exceeded.

These are release-candidate guardrails, not a reason to remove findings or weaken scanner behavior. CI records runtime-specific results through the Node matrix.
