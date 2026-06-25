# merge-guard roadmap

This roadmap keeps the project focused and buildable.

## v0.1 - Local diff scanner

Goal: make the repo useful without any external service.

- [x] Create project identity
- [x] Add README
- [x] Add Node CLI scaffold
- [x] Add basic diff analyzer
- [x] Add sample diff
- [x] Add report format docs
- [ ] Add more sample diffs
- [ ] Add simple test runner
- [ ] Add better risk scoring notes

## v0.2 - Better review rules

Goal: make the rules smarter before adding AI.

- [ ] Detect changed test coverage more accurately
- [ ] Add per-file risk scores
- [ ] Add framework-aware checks for React, Vite, Node, and TypeScript
- [ ] Add config for project-specific rules
- [ ] Add `merge-guard.config.json`

## v0.3 - GitHub Actions mode

Goal: make `merge-guard` useful inside pull requests.

- [ ] Add GitHub Actions example
- [ ] Read pull request diff in CI
- [ ] Print markdown report to job summary
- [ ] Support pass/fail threshold
- [ ] Add docs for using it in another repo

## v0.4 - AI review layer

Goal: add plain-English reasoning on top of the rules-based scan.

- [ ] Add prompt template for AI review
- [ ] Add optional provider adapter
- [ ] Add local-only fallback mode
- [ ] Generate PR summary
- [ ] Generate suggested smoke tests
- [ ] Generate reviewer checklist

## v0.5 - PR comment bot

Goal: post a clean merge report directly on GitHub pull requests.

- [ ] Create GitHub app or token-based action mode
- [ ] Comment on pull requests
- [ ] Update existing bot comment instead of spamming
- [ ] Add markdown report formatting
- [ ] Add repo-specific labels or status checks

## Product direction

`merge-guard` should stay narrow:

- It reviews diffs.
- It explains risk.
- It suggests checks.
- It helps developers decide what to review next.

It should not pretend to replace testing, code review, or developer judgment.
