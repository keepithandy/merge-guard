#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

const design = fs.readFileSync('docs/EVALUATION_HARNESS_DESIGN.md', 'utf8');
for (const required of [
  'actionable precision',
  'supported-scope recall',
  'critical supported-scope recall',
  'noise per PR',
  'clean-PR specificity',
  'configuration effort',
  '95th-percentile analysis time',
  'calibration',
  'held-out',
  'preregistered',
  'insufficient-evidence',
  'No telemetry',
  'no diff text',
  'two independent label decisions',
  'at least 50 held-out PRs',
  'at least five repository aliases',
  'actionable precision at least 70%',
  'critical supported-scope recall at least 80%',
  'no greater than one per PR',
  'clean-PR specificity at least 70%',
  'no greater than five minutes',
  '3,000 ms budget'
]) assert(design.includes(required), `evaluation design must define ${required}`);

for (const forbidden of [
  'automatic upload',
  'execution of changed code',
  'tuning on the held-out evaluation partition'
]) assert(design.includes(forbidden), `evaluation design must explicitly prohibit ${forbidden}`);

assert(design.indexOf('1. `validate`') < design.indexOf('2. `run`'), 'corpus validation must precede evaluation execution');
assert(design.includes('Every metric includes its numerator, denominator, excluded cases, and exclusion reasons.'));
assert(design.includes('Thresholds may be revised only before the held-out run'));
assert(design.includes('the next work targets the measured failure rather than adding extension infrastructure'));

console.log('historical PR evaluation harness design contracts passed');
console.log('status=design-accepted,implementation-pending');
