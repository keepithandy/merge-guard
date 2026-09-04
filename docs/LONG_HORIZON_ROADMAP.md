# Merge Guard long-horizon roadmap

Status: directional capability map for planning. This document is deliberately broader than the active execution queue. It is not a release promise, issue list, authorization for external actions, or license to weaken the current privacy and compatibility boundaries.

The purpose of this map is to capture the full product space before selecting phases. A later phase roadmap should choose a small set of outcomes from this document, state what is explicitly deferred, and convert only the selected work into bounded issues.

## Product thesis

Merge Guard should help a reviewer answer five questions quickly and with evidence:

1. What changed, and which parts deserve attention first?
2. What could plausibly break because of this change?
3. Which checks provide the most useful evidence before merge?
4. Which findings are new, persistent, resolved, uncertain, or unsupported?
5. Can the result be reproduced and audited without sending repository contents to a hosted service?

The durable product advantage is not a larger pile of warnings. It is a small, explainable, deterministic review plan that respects incomplete evidence and remains useful without AI, telemetry, code execution, or network access.

## Current baseline

The current `1.3.0-beta.1` source already provides:

- deterministic diff analysis through a local CLI and composite GitHub Action;
- text, Markdown, JSON, annotation, SARIF, managed-comment, and review-projection outputs;
- versioned report, policy, plugin, artifact, comparison, projection, and evaluation contracts;
- project-check suggestions without executing discovered commands;
- optional PR title and body context without treating prose as diff evidence;
- per-file risk, rule explanations, suppressions, policy packs, protected-path guidance, and CODEOWNERS-aware reviewer suggestions;
- explicit repository-impact metadata and an explainable impact graph;
- immutable artifact manifests, prior-evidence verification, finding comparison, and caller-owned CI handoff;
- a local, memory-only review dashboard with strict import and network boundaries;
- deterministic diagnostics, consumer fixtures, release gates, security contracts, and cross-platform compatibility coverage;
- an offline historical-PR evaluation harness with calibration, preregistration, held-out execution, and content-free aggregate results.

The first held-out pilot produced a `stop` decision. Precision and supported-scope recall missed their gates, while median noise, clean-PR specificity, setup effort, and runtime passed. The immediate obligation is to improve signal quality with calibration evidence before adding broad new surface area.

## How to use this roadmap

Each workstream has a stable prefix so future phase plans and issues can refer to candidates without implying that everything will ship.

- `EVAL`: evaluation, labels, and evidence integrity
- `SIGNAL`: finding quality, prioritization, and explanations
- `RECALL`: supported concern coverage
- `DIFF`: diff parsing and change representation
- `CHECK`: verification and test planning
- `IMPACT`: repository graph and ownership intelligence
- `POLICY`: policy authoring and governance
- `REVIEW`: human review experience
- `CI`: GitHub and automation workflows
- `DASH`: local dashboard and visualization
- `EVIDENCE`: durable artifacts, history, and audit
- `EXT`: extension and plugin platform
- `SEC`: security, privacy, and supply-chain trust
- `SCALE`: performance, limits, and reliability
- `DIST`: packaging, release, and distribution
- `ADOPT`: onboarding, documentation, and support
- `ECO`: language, ecosystem, and forge adapters
- `AI`: optional model-assisted review
- `TEAM`: collaboration and hosted capabilities
- `V2`: breaking-change candidates

A candidate enters a phase only when it has a named user outcome, evidence that the problem matters, explicit dependencies, deterministic acceptance criteria, and a rollback boundary.

## Non-negotiable product rules

- Unknown, unavailable, incomplete, unsupported, and untrusted evidence are never presented as clean or safe.
- Default analysis remains local, read-only, deterministic, and useful without an account or API key.
- Repository-controlled data is untrusted input, including diffs, configuration, policy, CODEOWNERS, package metadata, reports, archives, and plugin manifests.
- Merge Guard never executes changed project code, discovered test commands, package lifecycle scripts, build tools, or generated commands without a new explicit consent model.
- Network access, telemetry, hosted storage, background persistence, artifact retention, publication, signing, tagging, and stable Action-reference movement remain separately authorized capabilities.
- Additive v1 work preserves frozen public report, CLI, policy, plugin, artifact, comparison, and Action contracts unless a versioned migration says otherwise.
- Findings remain traceable to explicit evidence. Confidence language cannot turn a heuristic into a fact.
- A passing check proves only the contract it exercises. It does not prove correctness, security, compatibility, or product usefulness outside that scope.
- Held-out evidence is never used for tuning after preregistration.
- Every new input surface receives size, depth, cardinality, encoding, path, symlink, timeout, and privacy boundaries before implementation.

## North-star outcomes

### Reviewer usefulness

- A reviewer can identify the three most important review actions in under one minute.
- Primary findings explain evidence, consequence, uncertainty, and the next useful check.
- Low-risk changes remain quiet without hiding unsupported or incomplete analysis.
- Repeated runs converge on stable identities and do not create comment or annotation churn.

### Signal quality

- Actionable precision meets or exceeds the preregistered threshold on independently labeled held-out changes.
- Supported-scope recall meets or exceeds its threshold, with enough high-severity cases to measure critical recall.
- Finding duplication, keyword-only hits, and generic check inflation remain bounded.
- Rules expose the cases they do not support rather than guessing.

### Operational trust

- Identical explicit inputs produce byte-stable outputs apart from declared generation metadata.
- Every artifact can be tied to product, configuration, policy, input, and prior-evidence identities.
- Degraded permissions, missing history, cancellations, and partial channel failures remain visible.
- Cross-platform behavior is proven on the supported runtime matrix.

### Adoption

- A new repository can reach a useful first report with minimal configuration.
- Teams can start with safe defaults, add explicit policy gradually, and remove Merge Guard cleanly.
- Documentation gives one authoritative path for local use, GitHub use, troubleshooting, upgrades, and rollback.
- Support can diagnose failures from redacted contract evidence rather than repository contents.

## Workstream EVAL — evaluation and evidence integrity

Outcome: product decisions are driven by trustworthy, privacy-safe evidence rather than attractive demo cases.

### Candidate initiatives

- `EVAL-01` Build a larger calibration corpus with independently reviewed, outcome-grounded labels and enough high-severity supported concerns to measure critical recall.
- `EVAL-02` Define labeler guidance with examples for supported, unsupported, disputed, low-risk, excluded, and insufficient-evidence cases.
- `EVAL-03` Record label provenance categories precisely: incident, review comment, maintainer judgment, synthetic control, and future approved sources.
- `EVAL-04` Add an adjudication ledger that preserves both original decisions, the resolution, and the reason without exposing repository identity or source excerpts.
- `EVAL-05` Measure inter-rater agreement by concern family, severity, ecosystem, and change category.
- `EVAL-06` Add corpus coverage reports for repository shape, ecosystem, file type, diff size, rename/copy/binary state, policy use, and change intent.
- `EVAL-07` Detect near-duplicate cases and shared ancestry across calibration and held-out partitions without uploading corpus content.
- `EVAL-08` Add stratified sampling guidance so one repository, authoring style, or change type cannot dominate results.
- `EVAL-09` Define preregistered exclusion rules for corrupt diffs, unsupported formats, label disputes, and integrity failures.
- `EVAL-10` Add rule-family ablation reports that show which metrics move when one signal family is removed, using calibration only.
- `EVAL-11` Track confidence intervals and denominator sufficiency alongside point estimates.
- `EVAL-12` Add benchmark drift checks for corpus, labels, metric implementation, product identity, and thresholds.
- `EVAL-13` Maintain immutable summaries for every pilot, including misses and abandoned attempts.
- `EVAL-14` Add a lightweight reviewer-time study measuring time-to-first-useful-action and time-to-dismiss-noise.
- `EVAL-15` Define a repeatable field-feedback intake that accepts only caller-chosen, redacted evidence.

### Proof gates

- Every held-out case has two genuinely independent decisions and a visible adjudication state.
- High-severity supported concerns have a sufficient denominator before critical recall is claimed.
- Calibration and held-out repositories do not leak across partitions unless a dated exception is preregistered.
- Aggregate output remains content-free and raw material remains caller-owned.
- A new pilot cannot run if corpus, labels, metrics, thresholds, or product identity drift after preregistration.

## Workstream SIGNAL — precision, prioritization, and explanation

Outcome: Merge Guard surfaces fewer findings, ranks them better, and makes every retained warning worth a reviewer's time.

### Candidate initiatives

- `SIGNAL-01` Produce a calibration-only inventory of unmatched findings by rule family, path class, weight, and co-occurring evidence.
- `SIGNAL-02` Replace broad keyword triggers with syntax-aware or structure-aware evidence where deterministic parsing is practical.
- `SIGNAL-03` Require multiple independent evidence points before promoting ambiguous content to a primary finding.
- `SIGNAL-04` Deduplicate findings that describe the same reviewer action across file, package, policy, and global scopes.
- `SIGNAL-05` Separate risk evidence from review-plan evidence so a useful check does not automatically inflate risk.
- `SIGNAL-06` Add explicit finding confidence classes with stable semantics and no probabilistic safety claims.
- `SIGNAL-07` Introduce a primary/secondary/advisory hierarchy with deterministic budgets for each output channel.
- `SIGNAL-08` Add consequence-oriented explanations: what evidence was observed, what might break, why the rule applies, and what would reduce uncertainty.
- `SIGNAL-09` Detect mutually reinforcing findings and present one composed explanation instead of several fragments.
- `SIGNAL-10` Detect mutually contradicting signals and downgrade to an explicit uncertain state.
- `SIGNAL-11` Add path-class baselines so generated, vendored, documentation, fixture, migration, configuration, and runtime files are treated distinctly.
- `SIGNAL-12` Make scoring contributions inspectable and stable without requiring reviewers to understand internal weights.
- `SIGNAL-13` Add a deterministic explanation for why a finding did not become a merge blocker.
- `SIGNAL-14` Add negative fixtures for every high-volume false-positive pattern found during calibration.
- `SIGNAL-15` Define rule retirement, replacement, aliasing, and compatibility semantics.

### Proof gates

- Every precision change is linked to calibration evidence and a focused regression fixture.
- No precision improvement is achieved by silently suppressing unsupported or incomplete analysis.
- The top three actions remain stable for identical inputs.
- Report schema v1 consumers retain their expected fields and semantics.
- A rule-family change includes before/after calibration numerators and denominators.

## Workstream RECALL — supported concern coverage

Outcome: supported high-impact changes are recognized reliably without claiming universal defect detection.

### Candidate initiatives

- `RECALL-01` Build a supported-concern taxonomy with explicit examples and counterexamples.
- `RECALL-02` Measure recall separately for state/persistence, dependency/configuration, routing/entry, async/network, large change, tests, protected paths, and companion changes.
- `RECALL-03` Add high-severity fixtures for destructive persistence migrations, authorization boundaries, entry-point removal, unsafe configuration defaults, and missing compatibility handling.
- `RECALL-04` Improve save-schema and storage-key compatibility evidence for browser applications.
- `RECALL-05` Detect schema, protocol, API, and serialized-data compatibility changes from explicit file patterns and version markers.
- `RECALL-06` Recognize permission and authentication boundary changes without inferring runtime behavior.
- `RECALL-07` Recognize workflow permission, trigger, artifact, and release-path changes in GitHub Actions.
- `RECALL-08` Add infrastructure-change signals for explicit deployment, container, environment, and migration manifests.
- `RECALL-09` Add package-boundary signals for public exports, executable entry points, engine ranges, and peer compatibility.
- `RECALL-10` Add test-relevance checks that distinguish added coverage, modified coverage, deleted coverage, and unrelated test changes.
- `RECALL-11` Treat large deletions and broad renames as separate evidence from raw line count.
- `RECALL-12` Identify unsupported semantic changes clearly and propose manual review rather than a fabricated finding.
- `RECALL-13` Map each supported concern family to an explicit fallback when required context is absent.
- `RECALL-14` Add adversarial recall fixtures designed to avoid obvious keywords while preserving the risky structural change.
- `RECALL-15` Define minimum evidence for a critical finding and prohibit critical severity from single weak heuristics.

### Proof gates

- Recall is reported per family as well as in aggregate.
- At least five independently labeled high-severity supported concerns exist before critical recall is measured.
- Unsupported semantic domains are documented and visible in output.
- New recall signals do not regress clean-control specificity below its gate.
- Every critical finding identifies the exact evidence path and stable rule family.

## Workstream DIFF — change representation and parser fidelity

Outcome: every downstream conclusion rests on a bounded, explicit, cross-platform representation of what the diff actually contains.

### Candidate initiatives

- `DIFF-01` Define a versioned normalized change model shared by CLI, Action, dashboard, evaluation, and future forge adapters.
- `DIFF-02` Preserve file status, old path, new path, mode, binary state, submodule state, hunk ranges, additions, deletions, and truncation state.
- `DIFF-03` Distinguish a rename with edits from delete-plus-add evidence without guessing provenance.
- `DIFF-04` Add bounded combined-diff and merge-commit handling or reject it with an explicit unsupported state.
- `DIFF-05` Preserve no-newline markers, unusual encodings, long lines, quoted paths, and platform path separators safely.
- `DIFF-06` Add streaming or incremental parsing for large diffs while retaining deterministic ordering.
- `DIFF-07` Report partial analysis when input budgets are exceeded instead of dropping the remainder silently.
- `DIFF-08` Add structured evidence for file-mode, executable-bit, symbolic-link, and submodule changes.
- `DIFF-09` Define safe handling for generated patches, patch series, and multiple concatenated diffs.
- `DIFF-10` Add fuzzing and mutation testing for parser boundaries.
- `DIFF-11` Create a public, source-free conformance corpus for diff edge cases.
- `DIFF-12` Add optional line-to-symbol mapping only when a deterministic local parser is available and bounded.

### Proof gates

- The normalized representation is deterministic across supported Node and operating-system versions.
- Oversized or malformed input cannot be mistaken for an empty clean diff.
- Parser failures retain stable diagnostics without source excerpts or absolute paths.
- Dashboard and CLI produce compatible analysis for the same supported raw diff.

## Workstream CHECK — verification and test planning

Outcome: suggested checks are specific, minimal, explainable, and never executed implicitly.

### Candidate initiatives

- `CHECK-01` Rank checks by evidence coverage, cost class, locality, and confidence.
- `CHECK-02` Explain which finding or changed surface caused each suggested check.
- `CHECK-03` Deduplicate equivalent commands discovered from package scripts, documentation, workflow files, and policy.
- `CHECK-04` Distinguish fast smoke, focused unit, integration, compatibility, security, migration, and manual checks.
- `CHECK-05` Infer test relevance from explicit path and workspace relationships rather than command names alone.
- `CHECK-06` Model checks that are unavailable, platform-specific, secret-dependent, destructive, networked, or production-facing.
- `CHECK-07` Let policy owners require a check without claiming it was run or passed.
- `CHECK-08` Accept caller-supplied check results through a versioned evidence contract.
- `CHECK-09` Verify check-result provenance against command identity, commit, environment, and timestamp.
- `CHECK-10` Compare suggested versus completed checks without treating missing execution as success.
- `CHECK-11` Add a manual-verification checklist for UI, accessibility, migration, and operational concerns.
- `CHECK-12` Add a budgeted three-action default with expandable secondary checks.
- `CHECK-13` Support monorepo package-local checks from explicit workspace and impact metadata.
- `CHECK-14` Provide copyable commands with robust shell-specific quoting, while retaining non-execution.
- `CHECK-15` Define a future opt-in execution boundary as a separate product and security decision.

### Proof gates

- The default plan contains no duplicate or unexplainable command.
- Every suggested command includes source provenance and an execution-risk classification.
- No feature marks a command passed without verified caller-supplied evidence.
- Command generation remains injection-safe across supported shells.

## Workstream IMPACT — repository graph and ownership intelligence

Outcome: reviewers understand direct, transitive, shared, generated, and unknown impact from explicit repository evidence.

### Candidate initiatives

- `IMPACT-01` Expand the versioned impact metadata contract with schema, API, runtime, deployment, and data ownership edges.
- `IMPACT-02` Explain why each package or component is considered affected.
- `IMPACT-03` Distinguish direct code impact, transitive dependency impact, shared-file impact, generated impact, and policy-only impact.
- `IMPACT-04` Add owner groups with source priority, ambiguity handling, and missing-owner diagnostics.
- `IMPACT-05` Combine explicit impact metadata and supported CODEOWNERS evidence without silently resolving conflicts.
- `IMPACT-06` Model public API surfaces, executable entry points, persistence boundaries, and deployment units.
- `IMPACT-07` Add graph-delta comparison so reviewers can see ownership or dependency-edge changes.
- `IMPACT-08` Detect orphan, cyclic, dangling, and overly broad graph declarations.
- `IMPACT-09` Add bounded visualization exports for the local dashboard.
- `IMPACT-10` Support multiple explicit metadata files through a versioned composition rule.
- `IMPACT-11` Provide metadata authoring and lint commands that never inspect undeclared repository areas.
- `IMPACT-12` Generate starter metadata only as an explicit local draft requiring review before use.
- `IMPACT-13` Add ecosystem adapters that translate lockfiles or project descriptors only after their trust and compatibility boundaries are defined.
- `IMPACT-14` Preserve unknown impact when the graph is incomplete or stale.

### Proof gates

- Every impact edge is traceable to checked-in or explicitly supplied metadata.
- Missing or invalid metadata never invents dependency relationships.
- Graph analysis remains within documented time and memory budgets.
- Ownership conflicts remain visible until policy resolves them.

## Workstream POLICY — authoring, governance, and change control

Outcome: repositories can express review policy safely, explain changes, and evolve policy without hidden inheritance or silent weakening.

### Candidate initiatives

- `POLICY-01` Add a policy authoring command with schema-aware validation and examples.
- `POLICY-02` Add a policy test command for fixtures, expected findings, expected checks, and expected diagnostics.
- `POLICY-03` Explain the complete resolved policy graph, including defaults, inherited values, overrides, and exceptions.
- `POLICY-04` Add policy-diff output showing stronger, weaker, added, removed, and ambiguous constraints.
- `POLICY-05` Require reasons, owners, and expiry for suppressions and exceptions; make expired entries fail visible.
- `POLICY-06` Add bounded organization-baseline composition only from explicitly supplied local inputs.
- `POLICY-07` Define conflict semantics for repository, package, path, branch, and workflow scopes.
- `POLICY-08` Add policy compatibility ranges and migration diagnostics.
- `POLICY-09` Add stable policy fingerprints to reports and artifact manifests.
- `POLICY-10` Add signed-policy verification as an optional caller-owned layer without inventing a trust authority.
- `POLICY-11` Add protected policy paths and required reviewers from explicit governance metadata.
- `POLICY-12` Distinguish advisory policy, merge-gating policy, and unsupported policy requirements.
- `POLICY-13` Provide starter policies for additional repository shapes only after calibration evidence exists.
- `POLICY-14` Add policy lint rules for redundant, unreachable, expired, or overly broad entries.
- `POLICY-15` Define policy deprecation and compatibility support windows.

### Proof gates

- Resolved policy is deterministic and fully explainable.
- A policy update cannot silently reduce a protected requirement.
- Unknown fields and future schemas fail according to versioned rules.
- Policy validation never executes repository-controlled code or regular expressions outside the safe subset.

## Workstream REVIEW — reviewer-facing experience

Outcome: the human-facing report is concise first, detailed on demand, and consistent across terminal, PR, and dashboard surfaces.

### Candidate initiatives

- `REVIEW-01` Define one canonical information hierarchy shared across renderers.
- `REVIEW-02` Put merge readiness, top evidence, and top checks above secondary detail.
- `REVIEW-03` Group related findings by reviewer action and affected surface.
- `REVIEW-04` Add concise evidence snippets derived from metadata, never raw source excerpts by default.
- `REVIEW-05` Explain uncertainty, unsupported analysis, partial input, and unavailable prior evidence near the decision.
- `REVIEW-06` Add stable anchors and finding identities across comment reruns.
- `REVIEW-07` Budget inline annotations to avoid flooding a pull request.
- `REVIEW-08` Let reviewers expand details without changing the underlying report contract.
- `REVIEW-09` Add accessible color, icon, text, keyboard, screen-reader, and reduced-motion behavior.
- `REVIEW-10` Add compact mobile layouts for GitHub comments and the local dashboard.
- `REVIEW-11` Provide a reviewer checklist that can be exported without claiming completion.
- `REVIEW-12` Add an explicit “why this changed” comparison view for score, readiness, findings, checks, and evidence trust.
- `REVIEW-13` Distinguish new risk from longstanding accepted legacy risk.
- `REVIEW-14` Add presentation-level suppressions only where the underlying finding remains available in machine output.
- `REVIEW-15` Measure comprehension and dismissal behavior in usability studies.

### Proof gates

- A compact report remains materially shorter than the detailed report.
- No renderer changes scoring or evidence semantics.
- Accessibility contracts cover every interactive control and status state.
- Duplicate events converge on one stable managed comment.

## Workstream CI — GitHub and automation workflows

Outcome: teams can adopt Merge Guard in CI with least privilege, predictable artifacts, and resilient behavior across real pull-request states.

### Candidate initiatives

- `CI-01` Publish minimal, strict, monorepo, fork-safe, merge-queue, and caller-owned-artifact examples.
- `CI-02` Add a reusable workflow option alongside the composite Action without hiding permissions or artifact ownership.
- `CI-03` Model draft, ready-for-review, reopened, synchronized, converted, and merge-queue events explicitly.
- `CI-04` Make fork and Dependabot-style permission degradation visible while preserving local evidence.
- `CI-05` Add concurrency guidance that prevents stale runs from overwriting current comments or artifacts.
- `CI-06` Define exact behavior for canceled, timed-out, retried, skipped, and manually rerun jobs.
- `CI-07` Add optional Checks API output only with a reviewed least-privilege permission model.
- `CI-08` Add optional caller-owned SARIF upload examples while keeping upload outside the core Action.
- `CI-09` Add provenance for workflow, Action commit, event, base, head, and repository assertions.
- `CI-10` Detect unsafe unpinned third-party Action examples in Merge Guard's own documentation and fixtures.
- `CI-11` Add self-hosted-runner guidance and threat boundaries.
- `CI-12` Add explicit artifact retention and deletion examples owned by the caller.
- `CI-13` Add merge-gate examples that distinguish tool failure, finding threshold failure, unavailable evidence, and infrastructure failure.
- `CI-14` Add GitHub Enterprise Server compatibility only after supported API and runner versions are named.
- `CI-15` Maintain an end-to-end fixture repository for event and permission behavior.

### Proof gates

- Every example declares exact permissions.
- A fork or permission failure does not erase valid local artifacts.
- A canceled run cannot claim finalization or cleanup that did not occur.
- Action outputs and local CLI outputs remain compatible for identical inputs.

## Workstream DASH — local dashboard and visualization

Outcome: reviewers can explore a report locally without weakening the no-network, memory-only, non-execution boundary.

### Candidate initiatives

- `DASH-01` Finish the file-risk explorer with evidence, findings, ownership, checks, and impact relationships.
- `DASH-02` Add a verification checklist that remains local and does not claim checks were executed.
- `DASH-03` Add current-versus-prior report comparison with trust-state explanations.
- `DASH-04` Add impact-graph visualization with bounded node and edge counts.
- `DASH-05` Add filters for severity, confidence, rule family, path, package, owner, state, and evidence trust.
- `DASH-06` Add accessible keyboard navigation, focus management, screen-reader summaries, and high-contrast themes.
- `DASH-07` Add explicit Markdown and JSON export from validated in-memory state.
- `DASH-08` Add print and PDF-friendly presentation without embedding source content unexpectedly.
- `DASH-09` Add drag-and-drop comparison bundles through a versioned local input contract.
- `DASH-10` Add cancellable worker progress for large supported imports.
- `DASH-11` Preserve the last valid view after failed import, with clear error recovery.
- `DASH-12` Add a capability banner explaining which analysis inputs were and were not available.
- `DASH-13` Add local-only scenario demos built from synthetic public fixtures.
- `DASH-14` Define a future persistent workspace as a separate ADR and storage-boundary version.
- `DASH-15` Define a future collaborative dashboard as a TEAM workstream, not an incremental local-dashboard change.

### Proof gates

- Content Security Policy retains `connect-src 'none'` for the local product.
- Selected content remains in memory unless the user explicitly exports it.
- Invalid input never partially renders or replaces a valid view.
- The dashboard never creates an independent scoring implementation.

## Workstream EVIDENCE — artifacts, history, and audit

Outcome: every review result can be reproduced, compared, retained, or discarded through explicit caller-owned workflows.

### Candidate initiatives

- `EVIDENCE-01` Expand manifests to bind policy, configuration, impact metadata, normalized input, and renderer identities.
- `EVIDENCE-02` Add a versioned evidence bundle containing only explicitly selected artifacts.
- `EVIDENCE-03` Verify bundle completeness and distinguish missing, stale, incompatible, tampered, and unsupported evidence.
- `EVIDENCE-04` Add deterministic multi-report trend analysis without searching remote history.
- `EVIDENCE-05` Add provenance chains for regenerated or transformed artifacts.
- `EVIDENCE-06` Define redaction-safe sharing profiles for support, security review, and audit.
- `EVIDENCE-07` Add retention metadata without performing retention or deletion.
- `EVIDENCE-08` Add caller-controlled signing and verification hooks without prescribing a trust authority.
- `EVIDENCE-09` Add reproducible HTML and PDF report exports with explicit variable fields.
- `EVIDENCE-10` Add stable serialization and canonicalization tests for every new artifact type.
- `EVIDENCE-11` Add cross-version readers with explicit migration and unsupported-state behavior.
- `EVIDENCE-12` Add an evidence inventory command that inspects only explicitly supplied local paths.
- `EVIDENCE-13` Add report lineage for base/head updates and rebases.
- `EVIDENCE-14` Define evidentiary limits: hashes prove byte identity, not correctness or trustworthiness.

### Proof gates

- Every comparison names the exact current and prior identities.
- No command searches workflow history, local disks, or remote storage implicitly.
- Deletion and retention remain caller-owned external actions.
- Canonical output is byte-stable across supported platforms.

## Workstream EXT — extension and plugin platform

Outcome: trusted local extensions can add bounded analysis without compromising core determinism or hiding their authority.

### Candidate initiatives

- `EXT-01` Decide whether repeated user demand justifies moving beyond the current manifest and conformance foundations.
- `EXT-02` Define an explicit install record containing source, checksum, compatibility range, permissions, and approval.
- `EXT-03` Add a local plugin lifecycle: inspect, install, enable, disable, update, rollback, and uninstall.
- `EXT-04` Replace best-effort worker isolation with a documented capability boundary or state clearly that hostile-code isolation is unsupported.
- `EXT-05` Define plugin inputs and outputs as versioned data-only contracts.
- `EXT-06` Add CPU, memory, time, finding-count, output-size, and recursion limits.
- `EXT-07` Add deterministic plugin ordering, conflict handling, and failure quarantine.
- `EXT-08` Bind plugin identities and results into artifact manifests.
- `EXT-09` Add a plugin SDK with fixtures, conformance tests, and compatibility guidance.
- `EXT-10` Add signatures or attestations only through an explicit trust-root model.
- `EXT-11` Define a private local catalog before considering any public registry.
- `EXT-12` Add policy control over which plugins may affect advisory output or merge gating.
- `EXT-13` Define plugin deprecation, revocation, and incident-response procedures.
- `EXT-14` Keep networked or native-code plugins out of scope until a separate architecture and consent review.

### Proof gates

- Core analysis remains useful with all plugins disabled.
- Plugin failure cannot mutate core state, erase evidence, or be interpreted as a clean result.
- Permission grants are explicit and inspectable.
- Repeated field demand exists before the lifecycle becomes active product work.

## Workstream SEC — security, privacy, and supply-chain trust

Outcome: security boundaries are enforced by contracts and defaults, not only described in prose.

### Candidate initiatives

- `SEC-01` Maintain threat models for CLI, Action, dashboard, policy, plugins, artifacts, evaluation, and future hosted components.
- `SEC-02` Add fuzzing for diff, JSON, YAML-adjacent, CODEOWNERS, path, archive, and report parsers.
- `SEC-03` Add resource-exhaustion tests for depth, size, cardinality, long lines, regexes, graphs, and worker output.
- `SEC-04` Add secret-like data detection to optional export and support flows without scanning undeclared files.
- `SEC-05` Harden temporary-file creation, permissions, cleanup, and crash recovery.
- `SEC-06` Add dependency review, lockfile policy, provenance, SBOM, and vulnerability-response gates.
- `SEC-07` Pin and verify release tooling and GitHub Actions by immutable identity where practical.
- `SEC-08` Add reproducible package and Action source checks.
- `SEC-09` Define signed release provenance and post-publication verification as owner-controlled stages.
- `SEC-10` Add security regression fixtures for path escapes, symlinks, traversal, command injection, HTML injection, and unsafe URLs.
- `SEC-11` Add privacy classes for raw source, derived findings, aggregate metrics, diagnostics, and public metadata.
- `SEC-12` Define a vulnerability embargo and coordinated disclosure workflow.
- `SEC-13` Add least-privilege review for every new GitHub permission.
- `SEC-14` Require a new ADR for network, persistence, accounts, native execution, or background services.
- `SEC-15` Add security boundary summaries to machine-readable manifests where enforcement is possible.

### Proof gates

- Security tests run in the release gate and supported platform matrix.
- Failure messages do not reveal tokens, source excerpts, absolute paths, or environment secrets.
- Every external mutation requires explicit owner authorization.
- No security claim exceeds the tested boundary.

## Workstream SCALE — performance, limits, and reliability

Outcome: Merge Guard remains predictable on large repositories and fails visibly when inputs exceed supported limits.

### Candidate initiatives

- `SCALE-01` Publish input budgets for diff bytes, files, hunks, lines, rules, policies, packages, graph edges, checks, findings, and artifacts.
- `SCALE-02` Add representative small, medium, large, and adversarial performance fixtures.
- `SCALE-03` Track median, p95, and worst-case time and memory by input class.
- `SCALE-04` Introduce streaming diff parsing where it improves boundedness without destabilizing output.
- `SCALE-05` Add cancellable worker execution for optional expensive local analyses.
- `SCALE-06` Make truncated or partial results structurally explicit.
- `SCALE-07` Add deterministic sampling only for presentation, never for underlying finding computation.
- `SCALE-08` Cache only immutable, content-addressed local derivations under an explicit opt-in policy.
- `SCALE-09` Add concurrency controls for multi-package analysis and rendering.
- `SCALE-10` Test slow filesystem, restricted permission, low-memory, and interrupted-write behavior.
- `SCALE-11` Add soak tests for repeated runs and worker cleanup.
- `SCALE-12` Define platform-specific budgets only where measured differences justify them.
- `SCALE-13` Preserve deterministic ordering regardless of concurrency.
- `SCALE-14` Add graceful degradation for optional analyzers while keeping core failures visible.

### Proof gates

- Supported inputs remain within published budgets across the runtime matrix.
- Limit breaches have stable diagnostics and cannot produce a false clean result.
- Caching and concurrency do not change identities or ordering.
- Repeated runs do not leak workers, handles, temporary files, or memory beyond stated budgets.

## Workstream DIST — packaging, release, and distribution

Outcome: users can install a verified immutable release through explicitly approved channels and roll back safely.

### Candidate initiatives

- `DIST-01` Decide whether beta evidence is strong enough to authorize a public release candidate.
- `DIST-02` Stage reproducible npm artifacts from an immutable commit.
- `DIST-03` Add owner-approved signing and provenance generation.
- `DIST-04` Publish to npm only through a separately authorized, least-privilege workflow.
- `DIST-05` Create GitHub releases with exact artifact hashes, SBOM, notes, and rollback guidance.
- `DIST-06` Move stable Action references only after exact-commit verification.
- `DIST-07` Prepare GitHub Marketplace metadata only after the Action path is supported and verified.
- `DIST-08` Verify clean installation after publication on every supported Node and operating-system path.
- `DIST-09` Define beta, stable, maintenance, deprecated, and revoked channels.
- `DIST-10` Add release rollback, npm deprecation, Action-reference repair, and user-notification runbooks.
- `DIST-11` Consider standalone binaries or installers only after update, signing, platform, and support costs are accepted.
- `DIST-12` Add package-size and startup-time budgets.
- `DIST-13` Publish support windows and end-of-life policy.
- `DIST-14` Keep preparation, approval, publication, and verification as distinct recorded states.

### Proof gates

- Publication is impossible without a named owner approval record.
- The published bytes match the reviewed staged bytes.
- Post-publication installation is verified independently of staging.
- Rollback and revocation steps are tested before stable release.

## Workstream ADOPT — onboarding, documentation, and support

Outcome: users understand what Merge Guard does, what it does not do, how to adopt it safely, and how to leave.

### Candidate initiatives

- `ADOPT-01` Create a five-minute source-checkout quick start using a synthetic example.
- `ADOPT-02` Create minimal and strict GitHub Action recipes with explicit permissions.
- `ADOPT-03` Add repository-shape guides for single package, monorepo, browser app, backend service, library, infrastructure, and mixed-language repositories.
- `ADOPT-04` Add policy and impact-metadata authoring tutorials.
- `ADOPT-05` Add troubleshooting flows keyed to stable diagnostic IDs.
- `ADOPT-06` Add upgrade, rollback, uninstall, and evidence-cleanup guidance.
- `ADOPT-07` Build a searchable rule catalog with examples, counterexamples, severity, weight, and supported boundaries.
- `ADOPT-08` Publish a report interpretation guide for reviewers and maintainers.
- `ADOPT-09` Add a privacy-safe support bundle containing only user-selected diagnostics and identities.
- `ADOPT-10` Add example repositories and pull requests for every supported journey.
- `ADOPT-11` Define contribution guidance for rules, policies, fixtures, ecosystems, and documentation.
- `ADOPT-12` Track common setup failures and documentation gaps without default telemetry.
- `ADOPT-13` Offer opt-in surveys or issue templates that never attach repository content automatically.
- `ADOPT-14` Maintain one compatibility table for package, Action, schema, policy, plugin, Node, and platform support.
- `ADOPT-15` Add architectural decision summaries for users who need to assess trust boundaries.

### Proof gates

- Every supported journey has prerequisites, success evidence, failure recovery, and uninstall steps.
- Examples are tested and version-pinned.
- Documentation never describes an unpublished channel as available.
- Support requests can be useful without raw source or full environment dumps.

## Workstream ECO — ecosystems, languages, and forges

Outcome: Merge Guard gains ecosystem awareness through explicit adapters without fragmenting its core contracts.

### Candidate initiatives

- `ECO-01` Define an adapter contract for repository metadata, checks, package boundaries, public surfaces, and generated paths.
- `ECO-02` Strengthen Node/npm support for workspaces, exports, engines, scripts, lockfiles, and package boundaries.
- `ECO-03` Expand Python support for `pyproject.toml`, packages, test layouts, tooling, and migration files without executing Python.
- `ECO-04` Evaluate pnpm, Yarn, Bun, Deno, uv, Poetry, and other package-manager metadata only through explicit versioned parsers.
- `ECO-05` Evaluate Go modules, Rust workspaces, Java builds, .NET solutions, Ruby bundles, and PHP Composer based on measured demand.
- `ECO-06` Add infrastructure adapters for Docker, Kubernetes, Terraform, and common deployment manifests with narrow supported semantics.
- `ECO-07` Add database migration and schema adapters with explicit compatibility limits.
- `ECO-08` Add GitLab, Bitbucket, and Azure DevOps report projection only after forge-neutral core contracts exist.
- `ECO-09` Define provider-specific permission, event, annotation, and artifact behavior separately.
- `ECO-10` Keep forge adapters thin: parsing, transport, and projection cannot redefine scoring.
- `ECO-11` Add ecosystem conformance fixtures maintained independently from product repositories.
- `ECO-12` Publish supported-version ranges and graceful unsupported states.

### Proof gates

- Adapter support is justified by real repository evidence and maintained fixtures.
- Unsupported metadata is visible and cannot be mistaken for absent risk.
- The core report and evidence identities remain forge-neutral.
- No adapter executes package managers, builds, tests, or project code.

## Workstream AI — optional model-assisted review

Outcome: AI may improve explanation and organization without becoming a hidden authority or a requirement for core analysis.

### Candidate initiatives

- `AI-01` Define a provider-neutral request and response contract grounded in existing deterministic findings.
- `AI-02` Separate deterministic evidence from model-generated interpretation in every output.
- `AI-03` Require source references to stable finding and path identities rather than unsupported free-form claims.
- `AI-04` Add redaction and data-class previews before any network request.
- `AI-05` Support an explicit local/offline model path where practical.
- `AI-06` Add prompt and response size budgets, timeouts, retries, and cancellation.
- `AI-07` Treat unavailable providers, refused requests, malformed output, and model drift as visible degraded states.
- `AI-08` Evaluate summary faithfulness, omission, hallucination, actionability, and privacy separately from core signal metrics.
- `AI-09` Prevent model output from changing deterministic scores or merge readiness without a future versioned policy decision.
- `AI-10` Add user-controlled provider, model, endpoint, retention, and data-use disclosure.
- `AI-11` Store no prompts or responses by default.
- `AI-12` Add adversarial fixtures for prompt injection embedded in diffs, comments, filenames, configuration, and documentation.
- `AI-13` Label generated content clearly in PR comments, exports, and dashboard views.
- `AI-14` Define a deterministic fallback whenever AI is unavailable or disabled.

### Proof gates

- Core functionality and acceptance gates pass with AI disabled.
- Model output cannot be confused with deterministic evidence.
- Users see exactly what data will leave the machine before opting in.
- Prompt injection cannot grant tools, execute commands, mutate GitHub, or alter policy.

## Workstream TEAM — collaboration and hosted capabilities

Outcome: if the product ever becomes collaborative or hosted, it does so through an explicit new trust model rather than incremental scope creep.

### Candidate initiatives

- `TEAM-01` Validate demand for shared policy, review state, evidence retention, and organization reporting.
- `TEAM-02` Write an architecture decision covering tenancy, identity, authorization, encryption, residency, retention, deletion, audit, and incident response.
- `TEAM-03` Define which repository content, if any, may leave caller infrastructure.
- `TEAM-04` Prefer content-free identities and aggregates over raw diffs.
- `TEAM-05` Add explicit repository and organization installation consent.
- `TEAM-06` Define roles for owner, maintainer, policy administrator, reviewer, auditor, and support.
- `TEAM-07` Add append-only audit events for policy and evidence mutations.
- `TEAM-08` Add customer-controlled retention, export, deletion, and key management where justified.
- `TEAM-09` Separate product analytics from repository analysis and make telemetry opt-in.
- `TEAM-10` Define service availability, backup, restore, disaster recovery, and support obligations.
- `TEAM-11` Complete legal, privacy, abuse, and compliance review before external beta.
- `TEAM-12` Maintain a self-contained local mode even if hosted capabilities exist.

### Entry gate

This workstream stays inactive until field evidence demonstrates repeated collaboration demand that cannot be met through caller-owned GitHub artifacts and local workflows. Activation requires a new ADR, threat model, privacy review, operating model, and explicit owner decision.

## Workstream V2 — breaking-change candidates

Outcome: v2 exists only if evidence shows that additive v1 evolution cannot solve important user problems safely.

### Possible breaking changes

- `V2-01` A normalized report schema centered on stable evidence and finding identities.
- `V2-02` Separation of risk evidence, review actions, merge policy, and execution evidence into distinct contracts.
- `V2-03` A package split between parser, analyzer, policy, renderers, dashboard, and forge adapters.
- `V2-04` A capability-based plugin API with explicit authority and resource budgets.
- `V2-05` A versioned repository model shared by language adapters and impact analysis.
- `V2-06` A first-class partial-analysis model replacing implicit warning conventions.
- `V2-07` A migration from weight accumulation to a more explainable decision model, only if evaluation proves the need.
- `V2-08` Stronger configuration composition and policy scope semantics.
- `V2-09` Structured check evidence and verification-state contracts.
- `V2-10` Forge-neutral event and projection models.
- `V2-11` Explicit local, CI, and hosted operating profiles.
- `V2-12` Removal of obsolete aliases or fields after a measured deprecation window.

### Decision gate

A v2 proposal must include:

- the user problem that cannot be solved additively;
- evidence of repeated demand or measured v1 failure;
- the exact contracts that would break;
- an automated migration or compatibility bridge where feasible;
- rollback and dual-read strategy;
- security, privacy, performance, and support impact;
- an independently reviewed architecture decision;
- a release and deprecation timeline accepted by the owner.

## Cross-cutting research queue

These are questions, not commitments:

- Which finding families account for most actionable value?
- Which finding families account for most unmatched noise?
- Can structural evidence replace keyword triggers without excessive parser complexity?
- Do reviewers prefer fewer high-confidence findings or broader uncertain coverage?
- Which three suggested checks most often change a merge decision?
- How often are repository-impact metadata and CODEOWNERS available and current?
- Which repository shapes need explicit adapters rather than generic diff rules?
- Does comparison across pushes reduce review time or create status churn?
- Are stable finding identities understandable enough for audit and suppression workflows?
- What evidence makes a reviewer trust a `SAFE_TO_MERGE` result?
- What should Merge Guard say when no supported concern family applies?
- How should policy weakening be presented and governed?
- Is the local dashboard materially more useful than Markdown for real reviews?
- Do users need long-lived evidence beyond caller-owned CI artifacts?
- Is there repeated demand for signed policy or plugin artifacts?
- Can an optional AI summary improve comprehension without reducing trust?
- What are the dominant adoption failures: installation, configuration, noise, missing context, permissions, or documentation?
- What is the smallest stable release worth supporting publicly?

## Metrics catalog for future phases

### Signal metrics

- actionable precision, with numerator and denominator;
- supported-scope recall by family and severity;
- critical supported-scope recall with sufficiency threshold;
- unmatched positive findings per PR at median and p90;
- clean-PR specificity;
- duplicate or overlapping findings per PR;
- primary-action count and stability;
- unsupported and partial-analysis rates.

### Reviewer metrics

- time to identify the highest-value review action;
- time to dismiss non-actionable findings;
- check-plan completion and usefulness;
- comprehension of unknown and degraded states;
- reviewer agreement with severity and merge readiness;
- comment churn across reruns;
- accessibility task completion.

### Operational metrics

- median and p95 analysis time by input class;
- peak and retained memory;
- artifact size and package size;
- deterministic output rate across platforms;
- workflow success, retry, cancellation, and degraded-permission behavior;
- installation success across supported journeys;
- support diagnostic resolution rate.

### Safety metrics

- parser and validation failures by category;
- limit-breach handling;
- secret or source leakage in outputs;
- path, symlink, archive, HTML, regex, and command-injection regressions;
- permission expansion and external mutation review;
- dependency and provenance exceptions;
- unresolved security boundaries.

## Dependency rules

- Signal tuning depends on trustworthy calibration labels.
- Held-out evaluation depends on a frozen product, metric implementation, thresholds, and corpus.
- Critical-recall claims depend on a sufficient high-severity denominator.
- New ecosystem rules depend on representative fixtures and a maintained adapter owner.
- New report channels depend on stable underlying evidence contracts.
- Check-result comparison depends on a versioned execution-evidence contract.
- Policy federation depends on deterministic local composition and conflict semantics.
- Plugin lifecycle work depends on demonstrated extension demand and a credible capability boundary.
- Hosted collaboration depends on a new architecture, privacy, security, and operating model.
- v2 planning depends on evidence that additive v1 work is insufficient.
- Public release depends on owner approval, reproducible staging, signed provenance where required, and post-publication verification.

## Explicitly deferred or rejected shortcuts

- Tuning rules against the completed held-out corpus.
- Removing difficult cases or disputed labels to improve reported metrics.
- Treating missing tests, missing history, or failed analysis as a clean result.
- Executing suggested checks automatically in the existing CLI or Action.
- Searching repositories, workflow history, artifacts, or developer machines without an explicit selector.
- Uploading diffs, reports, prompts, or telemetry by default.
- Adding a public plugin registry before install, trust, permission, revocation, and support models exist.
- Adding hosted persistence to the local dashboard incrementally.
- Claiming hostile-code isolation from the current worker boundary.
- Publishing npm packages, GitHub releases, Marketplace entries, or stable Action tags because tests pass.
- Starting v2 to avoid repairing measured v1 signal-quality problems.
- Using AI output as an unlabelled scoring or merge-gating input.

## Candidate phase themes

These are useful groupings for planning, not an approved sequence. The [phase-roadmap approval draft](PHASE_ROADMAP.md) selects a gated order from this map while keeping expansion conditional on evidence and owner decisions:

1. **Evidence repair:** calibration corpus quality, label guidance, high-severity coverage, and audit tooling.
2. **Signal repair:** precision inventory, recall gaps, finding composition, and targeted fixtures.
3. **Second validation:** frozen candidate, new corpus, preregistration, held-out run, and decision.
4. **Reviewer clarity:** canonical report hierarchy, explanation quality, annotation budgets, and comparison UX.
5. **Verification intelligence:** check provenance, ranking, availability, and caller-supplied results.
6. **Repository context:** richer explicit impact, ownership, public-surface, and schema metadata.
7. **Policy operations:** authoring, testing, resolved-policy explanation, diffs, and governance.
8. **CI hardening:** event coverage, merge queues, fork degradation, concurrency, and evidence handoff.
9. **Local exploration:** dashboard explorer, graph views, checklists, comparison, and exports.
10. **Release readiness:** distribution approval, staging, signing, publication, verification, and rollback.
11. **Ecosystem breadth:** adapter contract followed by evidence-backed language and forge support.
12. **Extensibility decision:** confirm demand, then choose whether to activate a trusted plugin lifecycle.
13. **Optional AI:** grounded explanation experiments behind explicit privacy and authority boundaries.
14. **v2 checkpoint:** decide whether any proven need requires a breaking architecture.

## Phase-selection rubric

When this roadmap is converted into phases, score each candidate against:

- magnitude of the observed user problem;
- evidence quality and representativeness;
- expected effect on precision, recall, reviewer time, or adoption;
- compatibility risk;
- security and privacy exposure;
- implementation and maintenance cost;
- reversibility and rollback clarity;
- ability to verify deterministically;
- dependency readiness;
- opportunity cost versus beta recovery.

The default selection bias should favor work that improves measured reviewer usefulness while reducing complexity. Broad surface-area expansion should lose to a smaller evidence-backed correction unless the expansion is required to measure or fix the active problem.

## Definition of phase-ready

A workstream slice is ready for a phase roadmap only when it has:

- a single user-visible outcome;
- a stable workstream identifier;
- evidence or a discovery task that can establish evidence;
- explicit in-scope and out-of-scope behavior;
- inputs, outputs, permissions, persistence, network, and execution boundaries;
- compatibility and migration impact;
- measurable acceptance criteria and exact verification commands;
- dependencies and sequencing constraints;
- rollback and failure behavior;
- documentation and support obligations;
- an owner decision for any publication or external mutation.

## Definition of roadmap success

This roadmap is successful if it helps the project make fewer, better commitments. Shipping every item would be failure by accumulation. The intended end state is a trustworthy review product with a narrow, proven core; a clear explanation of uncertainty; a disciplined path for optional capabilities; and enough evidence to know which ideas should never become product work.
