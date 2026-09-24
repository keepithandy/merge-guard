#!/usr/bin/env node
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createDashboardServer, CONTENT_SECURITY_POLICY } from '../dashboard/server.js';
import { DashboardImportError, DASHBOARD_LIMITS, validateDashboardImport, validateDashboardImportBatch } from '../dashboard/import-contract.js';
import { createVerificationSession, reportIdentity } from '../dashboard/human-verification.js';
import { createVerificationProgress } from '../dashboard/verification-progress.js';
import { extractDashboardFindings } from '../dashboard/comparison.js';

const bytes = (value) => new TextEncoder().encode(value);
const diff = readFileSync('examples/sample.diff', 'utf8');
const report = readFileSync('test/fixtures/finding-comparison/current.json', 'utf8');
const parsedReport = JSON.parse(report);
const legacyProgress = JSON.stringify({
  tool: 'merge-guard-verification-progress', schemaVersion: 1, reportBinding: 'a'.repeat(64),
  checks: [{ findingIdentity: 'builtin-routing-src-app', completed: true, note: 'Ran startup smoke.' }]
});
const currentSession = createVerificationSession({ report: parsedReport, findings: extractDashboardFindings(parsedReport), sessionId: 'import-contract-session', now: '2026-09-21T21:00:00.000Z' });
const currentProgress = JSON.stringify(createVerificationProgress('b'.repeat(64), reportIdentity(parsedReport), currentSession));
assert.equal(validateDashboardImport({ name: 'sample.diff', bytes: bytes(diff) }).kind, 'diff');
assert.equal(validateDashboardImport({ name: 'report.json', bytes: bytes(report) }).report.tool, 'merge-guard');
assert.equal(validateDashboardImport({ name: 'legacy-progress.json', bytes: bytes(legacyProgress) }).progress.schemaVersion, 1);
assert.equal(validateDashboardImport({ name: 'current-progress.json', bytes: bytes(currentProgress) }).progress.schemaVersion, 2);
assert.equal(validateDashboardImportBatch([{ name: 'before.json', bytes: bytes(report) }, { name: 'after.json', bytes: bytes(report) }]).length, 2);
assert.equal(validateDashboardImportBatch([{ name: 'report.json', bytes: bytes(report) }, { name: 'progress.json', bytes: bytes(currentProgress) }]).length, 2);
for (const [input, category] of [
  [{ name: 'report.txt', bytes: bytes(report) }, 'unsupported-type'],
  [{ name: 'binary.patch', bytes: bytes('diff --git a/a b/a\n--- a/a\n+++ b/a\nGIT binary patch') }, 'unsupported-type'],
  [{ name: 'bad.diff', bytes: bytes('not a diff') }, 'malformed-input'],
  [{ name: 'bad.json', bytes: bytes('{') }, 'malformed-input'],
  [{ name: 'bad-progress.json', bytes: bytes(JSON.stringify({ tool: 'merge-guard-verification-progress', schemaVersion: 2, reportBinding: 'a'.repeat(64) })) }, 'malformed-input'],
  [{ name: 'future-progress.json', bytes: bytes(JSON.stringify({ tool: 'merge-guard-verification-progress', schemaVersion: 99, reportBinding: 'a'.repeat(64) })) }, 'malformed-input'],
  [{ name: 'future.json', bytes: bytes(JSON.stringify({ tool: 'merge-guard', schemaVersion: 2 })) }, 'incompatible-schema'],
  [{ name: 'huge.diff', bytes: new Uint8Array(DASHBOARD_LIMITS.diffBytes + 1) }, 'too-large']
]) assert.throws(() => validateDashboardImport(input), (error) => error instanceof DashboardImportError && error.category === category);
assert.throws(() => validateDashboardImportBatch([0, 1, 2].map((index) => ({ name: `${index}.json`, bytes: bytes(report) }))), (error) => error.category === 'unsupported-type');

const server = createDashboardServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
function request(method, requestPath, host = `127.0.0.1:${port}`) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: requestPath, headers: { Host: host } }, (res) => { res.resume(); res.on('end', () => resolve(res)); });
    req.on('error', reject); req.end();
  });
}
try {
  const home = await request('GET', '/');
  assert.equal(home.statusCode, 200); assert.equal(home.headers['content-security-policy'], CONTENT_SECURITY_POLICY); assert.equal(home.headers['cache-control'], 'no-store');
  assert.equal((await request('HEAD', '/app.js')).statusCode, 200);
  assert.equal((await request('HEAD', '/comparison.js')).statusCode, 200);
  assert.equal((await request('HEAD', '/review-focus.js')).statusCode, 200);
  assert.equal((await request('HEAD', '/human-verification.js')).statusCode, 200);
  assert.equal((await request('HEAD', '/verification-progress.js')).statusCode, 200);
  assert.equal((await request('POST', '/')).statusCode, 405);
  assert.equal((await request('GET', '/secret')).statusCode, 404);
  assert.equal((await request('GET', '/', 'localhost:1234')).statusCode, 421);
} finally { await new Promise((resolve) => server.close(resolve)); }
console.log('dashboard import contracts passed');
