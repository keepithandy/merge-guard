# Contributing to merge-guard

Thanks for checking out `merge-guard`.

This project is meant to stay small, practical, and easy to understand.

## Local setup

```bash
npm install
npm run demo
npm run smoke
```

## Before opening a pull request

Please run:

```bash
npm run check
```

## Project style

Good changes for this repo:

- Improve diff analysis
- Add clearer report output
- Add useful rule checks
- Add examples
- Improve docs
- Keep the CLI easy to run

Try to avoid:

- Huge rewrites without a clear reason
- Heavy dependencies too early
- Magic AI behavior with no explanation
- Reports that sound more certain than they are

## Review philosophy

`merge-guard` should help developers ask better questions before merging.

It should be direct, readable, and honest about uncertainty.
