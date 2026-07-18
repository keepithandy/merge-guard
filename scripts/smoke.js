import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeDiff, formatMarkdownReport, formatReport } from '../src/analyzeDiff.js';
import { createAiReviewSummary } from '../src/aiReview.js';
import { appendCustomRuleWarnings, applyCustomRules } from '../src/customRules.js';
import { appendPrContext, appendPrContextToAiReview, applyPrContext } from '../src/prContext.js';
import { applyProjectChecks, detectProjectChecks } from '../src/projectChecks.js';
import { buildCommentBody, findMergeGuardComment, MERGE_GUARD_COMMENT_MARKER } from './pr-comment.js';

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
assert(report.config.preset === 'standard', 'default preset should be standard');

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
assertArray(report.rules, 'rules');
assert(report.rules.length > 0, 'rules should include at least one explanation');
assertString(report.rules[0].id, 'rules[0].id');
assertString(report.rules[0].label, 'rules[0].label');
assertString(report.rules[0].reason, 'rules[0].reason');
assertNumber(report.rules[0].weight, 'rules[0].weight');
assert(report.rules[0].reason.includes('because'), 'rule explanation should explain why it fired');
assertArray(report.suggestedChecks, 'suggestedChecks');
assert(report.suggestedChecks.length > 0, 'suggestedChecks should include at least one check');

const textOutput = formatReport(report);
assert(textOutput.includes('Per-file risk:'), 'text output should include per-file risk');
assert(textOutput.includes('Rule explanations:'), 'text output should include rule explanations');

const markdownOutput = formatMarkdownReport(report);
assert(markdownOutput.includes('# merge-guard report'), 'markdown output should include heading');
assert(markdownOutput.includes('## Per-file risk'), 'markdown output should include per-file risk');
assert(markdownOutput.includes('## Rule explanations'), 'markdown output should include rule explanations');
assert(markdownOutput.includes('## Suggested checks'), 'markdown output should include suggested checks');

const docsOnlyDiff = fs.readFileSync('examples/docs-only.diff', 'utf8');
const docsOnlyReport = analyzeDiff(docsOnlyDiff);
assert(docsOnlyReport.docsOnly === true, 'docs-only diff should be detected');
assert(docsOnlyReport.riskLevel === 'LOW', 'docs-only diff should stay low risk');
assert(docsOnlyReport.flags.includes('Docs-only change detected'), 'docs-only flag should be present');
assert(docsOnlyReport.rules.some((rule) => rule.id === 'docs-only'), 'docs-only rule should be present');

const relaxedReport = analyzeDiff(diffText, { preset: 'safe' });
const strictReport = analyzeDiff(diffText, { preset: 'strict' });
assert(relaxedReport.config.preset === 'safe', 'safe preset should be reported');
assert(strictReport.config.preset === 'strict', 'strict preset should be reported');
assert(strictReport.riskScore > relaxedReport.riskScore, 'strict preset should score sample diff higher than safe preset');
assert(strictReport.config.failThreshold < relaxedReport.config.failThreshold, 'strict preset should fail earlier than safe preset');

const explicitThresholdReport = analyzeDiff(diffText, { failThreshold: 4 });
assert(explicitThresholdReport.config.failThreshold === 4, 'explicit fail threshold should be retained');

const customRuleConfig = [{
  id: 'save-storage-write',
  label: 'Project save storage changed',
  pathPattern: 'save|state',
  linePattern: 'localStorage|persist',
  weight: 3,
  check: 'Run the project save round-trip smoke.'
}];
const customRuleReport = applyCustomRules(analyzeDiff(diffText), diffText, customRuleConfig);
const customRuleHit = customRuleReport.rules.find((rule) => rule.id === 'custom:save-storage-write');
assert(customRuleHit, 'custom rule should appear in the normal rule output');
assert(customRuleHit.reason.includes('because'), 'custom rule should explain why it fired');
assert(customRuleReport.flags.includes('Project save storage changed'), 'custom rule label should appear in flags');
assert(customRuleReport.suggestedChecks.includes('Run the project save round-trip smoke.'), 'custom rule check should appear in suggested checks');
assert(customRuleReport.riskScore > report.riskScore, 'positive custom rule weight should increase risk score');
assert(customRuleReport.config.customRules.length === 1, 'normalized custom rules should appear in report config');

const invalidCustomRuleReport = applyCustomRules(analyzeDiff(diffText), diffText, [{
  id: 'broken-pattern',
  label: 'Broken pattern',
  pathPattern: '[',
  weight: 2,
  check: 'Review manually.'
}]);
assert(invalidCustomRuleReport.customRuleWarnings.length === 1, 'invalid custom rule should be reported without crashing');
const warningMarkdown = appendCustomRuleWarnings(
  formatMarkdownReport(invalidCustomRuleReport),
  invalidCustomRuleReport.customRuleWarnings,
  'markdown'
);
assert(warningMarkdown.includes('## Custom rule warnings'), 'Markdown should expose invalid custom rule warnings');

const prContext = {
  title: 'Harden save migration boundaries',
  body: 'Summary\n\n- preserves existing save schema\n- adds focused smoke coverage'
};
const contextualReport = applyPrContext(analyzeDiff(diffText), prContext);
assert(contextualReport.prContext.title === prContext.title, 'report should retain PR title context');
const contextualMarkdown = appendPrContext(formatMarkdownReport(contextualReport), prContext, 'markdown');
assert(contextualMarkdown.includes('## Pull request context'), 'Markdown should include PR context section');
assert(contextualMarkdown.includes('Context only'), 'PR context should state that scoring remains diff-based');

const aiReview = appendPrContextToAiReview(createAiReviewSummary(report, diffText), prContext);
assertString(aiReview.mode, 'aiReview.mode');
assertArray(aiReview.summary, 'aiReview.summary');
assertArray(aiReview.possibleBreakpoints, 'aiReview.possibleBreakpoints');
assertString(aiReview.prompt, 'aiReview.prompt');
assert(aiReview.prompt.includes('You are merge-guard'), 'AI review prompt should adapt the prompt template');
assert(aiReview.prompt.includes(prContext.title), 'AI review prompt should include PR title context');
assert(aiReview.prompt.includes('do not use it as a substitute for the diff'), 'AI prompt should preserve diff authority');

const projectFixture = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-project-'));
const emptyFixture = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-guard-empty-'));
try {
  fs.writeFileSync(path.join(projectFixture, 'package.json'), JSON.stringify({
    scripts: {
      test: 'node test.js',
      smoke: 'node smoke.js',
      build: 'node build.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(projectFixture, 'smoke_save.mjs'), 'console.log("ok");\n', 'utf8');
  fs.writeFileSync(path.join(projectFixture, 'README.md'), '```bash\nnpm run verify\n```\n', 'utf8');

  const detectedChecks = detectProjectChecks(projectFixture);
  assert(detectedChecks.includes('npm test'), 'package test script should be detected');
  assert(detectedChecks.includes('npm run smoke'), 'package smoke script should be detected');
  assert(detectedChecks.includes('node smoke_save.mjs'), 'root smoke file should be detected');
  assert(detectedChecks.includes('npm run verify'), 'README check command should be detected');

  const projectCheckReport = applyProjectChecks(analyzeDiff(diffText), detectedChecks);
  assert(projectCheckReport.projectChecks.includes('npm run smoke'), 'report should expose detected project checks');
  assert(projectCheckReport.suggestedChecks[0].startsWith('Project check:'), 'project checks should lead suggested checks');

  const fallbackReport = analyzeDiff(diffText);
  const fallbackChecks = [...fallbackReport.suggestedChecks];
  applyProjectChecks(fallbackReport, detectProjectChecks(emptyFixture));
  assert(fallbackReport.projectChecks.length === 0, 'empty repository should not invent project checks');
  assert(JSON.stringify(fallbackReport.suggestedChecks) === JSON.stringify(fallbackChecks), 'generic fallback checks should remain unchanged');
} finally {
  fs.rmSync(projectFixture, { recursive: true, force: true });
  fs.rmSync(emptyFixture, { recursive: true, force: true });
}

const commentBody = buildCommentBody(markdownOutput);
assert(commentBody.includes(MERGE_GUARD_COMMENT_MARKER), 'PR comment should include stable marker');
assert(commentBody.includes('# merge-guard report'), 'PR comment should include markdown report');

const existingComment = findMergeGuardComment([
  { id: 1, body: 'human review note' },
  { id: 2, body: commentBody }
]);
assert(existingComment?.id === 2, 'existing merge-guard comment should be found by marker');

const packageMetadata = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(packageMetadata.bin?.['merge-guard'] === './src/cli.js', 'package should expose the merge-guard CLI');
for (const packagePath of ['src/', 'scripts/', 'examples/', 'action.yml', 'README.md', 'CHANGELOG.md', 'LICENSE']) {
  assert(packageMetadata.files.includes(packagePath), `package files should include ${packagePath}`);
}

const cliSource = fs.readFileSync('src/cli.js', 'utf8');
assert(cliSource.includes('--fail-threshold'), 'CLI should expose fail-threshold override');
assert(cliSource.includes('applyCustomRules'), 'CLI should apply configured custom rules');
assert(cliSource.includes('--pr-title'), 'CLI should expose PR title context');
assert(cliSource.includes('--pr-body'), 'CLI should expose PR body file context');
assert(cliSource.includes('detectProjectChecks'), 'CLI should detect repository-specific checks');

const actionSource = fs.readFileSync('action.yml', 'utf8');
for (const actionContract of ['comment:', 'fail-threshold:', 'diff-path:', 'src/cli.js', 'scripts/pr-comment.js']) {
  assert(actionSource.includes(actionContract), `action.yml should include ${actionContract}`);
}
assert(fs.existsSync('src/cli.js'), 'Action CLI target should exist');
assert(fs.existsSync('scripts/pr-comment.js'), 'Action comment helper target should exist');
assert(fs.existsSync('src/customRules.js'), 'Custom rule module should exist');
assert(fs.existsSync('src/prContext.js'), 'PR context module should exist');
assert(fs.existsSync('src/projectChecks.js'), 'Project check detector should exist');

const readme = fs.readFileSync('README.md', 'utf8');
assert(readme.includes('npm pack --dry-run'), 'README should document package inspection');
assert(readme.includes('npx --package . merge-guard'), 'README should document npx-style use');
assert(readme.includes('Reusable GitHub Action'), 'README should document reusable Action use');
assert(readme.includes('pull-requests: write'), 'README should document comment permissions');
assert(readme.includes('customRules'), 'README should document custom rules');
assert(readme.includes('pathPattern'), 'README should include a realistic custom path rule');
assert(readme.includes('--pr-title'), 'README should document PR title context');
assert(readme.includes('Project-specific suggested checks'), 'README should document project check detection');

console.log('merge-guard smoke passed');
console.log(`riskLevel=${report.riskLevel}`);
console.log(`mergeReadiness=${report.mergeReadiness}`);
console.log(`changedFiles=${report.summary.changedFiles}`);
console.log(`docsOnlyRisk=${docsOnlyReport.riskLevel}`);
console.log(`strictRiskScore=${strictReport.riskScore}`);
console.log('prCommentMarker=ok');
console.log('packageContract=ok');
console.log('actionContract=ok');
console.log('customRules=ok');
console.log('prContext=ok');
console.log('projectChecks=ok');
