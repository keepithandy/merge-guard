#!/usr/bin/env node

import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { analyzeDiff } from '../src/analyzeDiff.js';
import { mapChangedFilesToPackages } from '../src/affectedPackages.js';
import { buildImpactGraph } from '../src/impactGraph.js';
import { applyRepositoryIntelligence } from '../src/repositoryIntelligence.js';

const budgets = { packages: 750, maxElapsedMs: 3000, maxHeapGrowthMb: 128, soakRuns: 3 };
const diff = [
  'diff --git a/packages/p000/src/index.js b/packages/p000/src/index.js',
  '--- a/packages/p000/src/index.js',
  '+++ b/packages/p000/src/index.js',
  '+export async function fetchState() {}'
].join('\n');
const packages = Array.from({ length: budgets.packages }, (_, index) => {
  const id = `p${String(index).padStart(3, '0')}`;
  return { id, root: `packages/${id}`, dependsOn: index ? [`p${String(index - 1).padStart(3, '0')}`] : [] };
});
const metadata = {
  status: 'valid', sourcePath: '.merge-guard/impact.json', schemaVersion: 1, packages,
  ownership: [], generatedPaths: [], repositoryWidePaths: [], diagnostics: []
};
const workspaceModel = {
  kind: 'npm-workspaces', rootPackage: { name: 'fixture', root: '.' }, workspacePatterns: ['packages/*'],
  packages: packages.map(({ id, root }) => ({ name: id, root, workspace: true, source: 'workspace' })), warnings: []
};
const affectedPackages = mapChangedFilesToPackages(diff, workspaceModel);
const unavailable = {
  status: 'not-provided', sourcePath: null, schemaVersion: null,
  packages: [], ownership: [], generatedPaths: [], repositoryWidePaths: [], diagnostics: []
};

function intelligence(impactMetadata) {
  return { ...workspaceModel, impactMetadata, impactGraph: buildImpactGraph(diff, impactMetadata), affectedPackages, projectCheckDetails: [] };
}

function v1Projection(report) {
  return {
    tool: report.tool, version: report.version, riskLevel: report.riskLevel, mergeReadiness: report.mergeReadiness,
    riskScore: report.riskScore, docsOnly: report.docsOnly, config: report.config, summary: report.summary,
    files: report.files, rules: report.rules, flags: report.flags, suggestedChecks: report.suggestedChecks,
    affectedPackages: report.repository.affectedPackages
  };
}

const baseline = applyRepositoryIntelligence(analyzeDiff(diff), intelligence(unavailable));
const explicit = applyRepositoryIntelligence(analyzeDiff(diff), intelligence(metadata));
assert.equal(baseline.repository.impactMetadata.status, 'not-provided');
assert.equal(baseline.repository.impactGraph.status, 'not-provided');
assert.deepEqual(v1Projection(explicit), v1Projection(baseline), 'impact metadata must remain additive to established v1 behavior');

let referenceGraph;
const results = [];
for (let run = 0; run < budgets.soakRuns; run += 1) {
  const heapBefore = process.memoryUsage().heapUsed;
  const started = performance.now();
  const graph = buildImpactGraph(diff, metadata);
  const elapsedMs = Math.round(performance.now() - started);
  const heapGrowthMb = Math.max(0, Math.round((process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024));
  assert(elapsedMs <= budgets.maxElapsedMs, `large graph exceeded ${budgets.maxElapsedMs}ms budget`);
  assert(heapGrowthMb <= budgets.maxHeapGrowthMb, `large graph exceeded ${budgets.maxHeapGrowthMb}MB heap-growth budget`);
  assert.equal(graph.status, 'complete');
  assert.equal(graph.directPackages.length, 1);
  assert.equal(graph.transitivePackages.length, budgets.packages - 1);
  assert.equal(graph.edges.length, budgets.packages - 1);
  if (referenceGraph) assert.deepEqual(graph, referenceGraph, 'large explicit graph must be deterministic');
  referenceGraph = graph;
  results.push({ run: run + 1, elapsedMs, heapGrowthMb });
}

console.log(JSON.stringify({ compatibility: 'v1 fields unchanged', budgets, results, deterministic: true }, null, 2));
