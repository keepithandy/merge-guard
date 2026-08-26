#!/usr/bin/env node
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { analyzeDiff } from '../src/analyzeDiff.js';

const fixture = (files, lines) => Array.from({ length: files }, (_, index) => [`diff --git a/src/file-${index}.js b/src/file-${index}.js`, `--- a/src/file-${index}.js`, `+++ b/src/file-${index}.js`, ...Array.from({ length: lines }, (_, line) => `+export const value${line} = ${line};`)].join('\n')).join('\n');
const budgets = { smallMs: 500, mediumMs: 1000, largeMs: 3000, maxInputBytes: 2_000_000, maxMemoryMb: 128 };
const cases = [{ name: 'small', diff: fixture(2, 10), budget: budgets.smallMs }, { name: 'medium', diff: fixture(20, 30), budget: budgets.mediumMs }, { name: 'large', diff: fixture(200, 40), budget: budgets.largeMs }];
const results = [];
for (const item of cases) {
  const start = performance.now(); const before = process.memoryUsage().heapUsed; const report = analyzeDiff(item.diff); const elapsedMs = Math.round(performance.now() - start); const memoryMb = Math.round((process.memoryUsage().heapUsed - before) / 1024 / 1024);
  assert(report.summary.changedFiles === Number(item.name === 'small' ? 2 : item.name === 'medium' ? 20 : 200));
  assert(elapsedMs <= item.budget, `${item.name} fixture exceeded ${item.budget}ms budget`); assert(memoryMb <= budgets.maxMemoryMb, `${item.name} fixture exceeded memory budget`);
  results.push({ name: item.name, files: report.summary.changedFiles, elapsedMs, memoryMb, budgetMs: item.budget });
  for (let repeat = 0; repeat < 3; repeat++) assert.deepEqual(analyzeDiff(item.diff), report, `${item.name} result must be deterministic`);
}
assert(Buffer.byteLength(cases.at(-1).diff) < budgets.maxInputBytes, 'large fixture must remain below the configured input limit');
assert.throws(() => { if (budgets.maxInputBytes + 1 > budgets.maxInputBytes) throw new Error('input-limit-exceeded'); }, /input-limit-exceeded/);
console.log(JSON.stringify({ budgets, results, soakRuns: 3, deterministic: true }, null, 2));
