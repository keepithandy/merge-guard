# Custom Rule Config Scope

## Goal

Custom rules should let projects add lightweight risk detection without editing merge-guard source code.

## Proposed config idea

A future `merge-guard.config.json` entry could define:

- rule id
- label
- weight
- file path match text
- suggested check text

## Behavior target

- invalid custom rules should not crash normal scans
- matching custom rules should appear in `rules`
- matching custom rules should contribute to risk score
- custom rule checks should appear in suggested checks
- built-in rules should keep working unchanged

## Guardrails

- keep rules simple
- do not execute commands from custom rules
- do not add network calls
- do not require an AI API key

## Status

This document scopes the feature. The scanner implementation still needs a focused code pass and smoke coverage.
