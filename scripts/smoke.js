import fs from 'node:fs';
import { analyzeDiff } from '../src/analyzeDiff.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertString(value, fieldName) {
  assert(typeof value === 'string' && value.length > 0, `${fieldName} should be a non-empty string`);
}

function assertArray(value, fieldName) {
  assert(Array.isArray(value), `${fieldName} should be an array`);
}

function assertNumber(value, fieldName) {
  assert(Number.isFinite(value), `${fieldName} should be a finite number`);
}

const diffText = fs.readFileSync('examples/sample.diff', 'utf8');
const report = analyzeDiff(diffText);

assert(report && typeof report === 'object', 'report should be an object');
assertString(report.riskLevel, 'riskLevel');
assertString(report.mergeReadiness, 'mergeReadiness');
assertNumber(report.riskScore, 'riskScore');

assert(report.summary && typeof report.summary === 'object', 'summary should be an object');
assertNumber(report.summary.changedFiles, 'summary.changedFiles');
assertNumber(report.summary.addedLines, 'summary.addedLines');
assertNumber(report.summary.removedLines, 'summary.removedLines');
assertArray(report.summary.files, 'summary.files');

assertArray(report.flags, 'flags');
assertArray(report.suggestedChecks, 'suggestedChecks');
assert(report.suggestedChecks.length > 0, 'suggestedChecks should include at least one check');

console.log('merge-guard smoke passed');
console.log(`riskLevel=${report.riskLevel}`);
console.log(`mergeReadiness=${report.mergeReadiness}`);
console.log(`changedFiles=${report.summary.changedFiles}`);
