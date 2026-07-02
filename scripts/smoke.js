import fs from 'node:fs';
import { analyzeDiff, formatMarkdownReport, formatReport } from '../src/analyzeDiff.js';
import { createAiReviewSummary } from '../src/aiReview.js';

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
assertArray(report.files, 'files');
assert(report.files.length === report.summary.changedFiles, 'files breakdown should match changed file count');
assertString(report.files[0].path, 'files[0].path');
assertString(report.files[0].riskLevel, 'files[0].riskLevel');
assertString(report.files[0].reason, 'files[0].reason');

assertArray(report.flags, 'flags');
assertArray(report.suggestedChecks, 'suggestedChecks');
assert(report.suggestedChecks.length > 0, 'suggestedChecks should include at least one check');

const textOutput = formatReport(report);
assert(textOutput.includes('Per-file risk:'), 'text output should include per-file risk');

const markdownOutput = formatMarkdownReport(report);
assert(markdownOutput.includes('# merge-guard report'), 'markdown output should include heading');
assert(markdownOutput.includes('## Per-file risk'), 'markdown output should include per-file risk');
assert(markdownOutput.includes('## Suggested checks'), 'markdown output should include suggested checks');

const docsOnlyDiff = fs.readFileSync('examples/docs-only.diff', 'utf8');
const docsOnlyReport = analyzeDiff(docsOnlyDiff);
assert(docsOnlyReport.docsOnly === true, 'docs-only diff should be detected');
assert(docsOnlyReport.riskLevel === 'LOW', 'docs-only diff should stay low risk');
assert(docsOnlyReport.flags.includes('Docs-only change detected'), 'docs-only flag should be present');

const aiReview = createAiReviewSummary(report, diffText);
assertString(aiReview.mode, 'aiReview.mode');
assertArray(aiReview.summary, 'aiReview.summary');
assertArray(aiReview.possibleBreakpoints, 'aiReview.possibleBreakpoints');
assertString(aiReview.prompt, 'aiReview.prompt');
assert(aiReview.prompt.includes('You are merge-guard'), 'AI review prompt should adapt the prompt template');

console.log('merge-guard smoke passed');
console.log(`riskLevel=${report.riskLevel}`);
console.log(`mergeReadiness=${report.mergeReadiness}`);
console.log(`changedFiles=${report.summary.changedFiles}`);
console.log(`docsOnlyRisk=${docsOnlyReport.riskLevel}`);
