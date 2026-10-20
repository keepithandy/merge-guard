# Automated source-integration checks

Merge Guard uses automated evidence gates for source integration. No mandatory manual code review, peer review, or independent reviewer signoff is required for ordinary development.

- Prove analyzer changes with positive and negative regression fixtures.
- Require `npm test`, `npm run test:security`, `npm run test:public-contracts`, and `npm run release:check`.
- Confirm the configured Node/OS compatibility matrix, smoke and repository integrity workflows pass on the exact intended commit.
- Preserve deterministic analysis, read-only Free scanning, public schemas, dependency boundaries and compatibility.
- Record tested rollback/revert steps and any unverified operational dependencies.

Green source checks are not production-release authorization and do not establish real-world defect detection accuracy. External publication, live checkout, signing and hosted operations require separate explicit authorization and launch evidence.
