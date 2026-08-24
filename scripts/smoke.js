import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeDiff, formatMarkdownReport, formatReport } from '../src/analyzeDiff.js';
import { createAiReviewSummary } from '../src/aiReview.js';
import { appendCustomRuleWarnings, applyCustomRules } from '../src/customRules.js';
import { appendPrContext, appendPrContextToAiReview, applyPrContext } from '../src/prContext.js';
import { applyProjectChecks, detectProjectCheckDetails, detectProjectChecks } from '../src/projectChecks.js';
import { applyRepositoryIntelligence, inspectRepository } from '../src/repositoryIntelligence.js';
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
const crlfReport = analyzeDiff(diffText.replace(/\r?\n/g, '\r\n'));
const noContextReport = applyPrContext(analyzeDiff(diffText), null);

assert(crlfReport.files.length === report.files.length, 'CRLF diffs should preserve changed files');
assert(
  crlfReport.summary.addedLines === report.summary.addedLines
    && crlfReport.summary.removedLines === report.summary.removedLines,
  'CRLF diffs should preserve changed line counts'
);
assert(noContextReport.prContext === null, 'missing PR context should remain optional');
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
  id: 'app-readiness-guard',
  label: 'App readiness guard changed',
  pathPattern: 'src/app',
  linePattern: 'ready',
  weight: 3,
  check: 'Run the app startup smoke.'
}];
const customRuleReport = applyCustomRules(analyzeDiff(diffText), diffText, customRuleConfig);
const customRuleHit = customRuleReport.rules.find((rule) => rule.id === 'custom:app-readiness-guard');
assert(customRuleHit, 'custom rule should appear in the normal rule output');
assert(customRuleHit.reason.includes('because'), 'custom rule should explain why it fired');
assert(customRuleReport.flags.includes('App readiness guard changed'), 'custom rule label should appear in flags');
assert(customRuleReport.suggestedChecks.includes('Run the app startup smoke.'), 'custom rule check should appear in suggested checks');
assert(customRuleReport.riskScore > report.riskScore, 'positive custom rule weight should increase risk score');
assert(customRuleReport.config.customRules.length === 1, 'normalized custom rules should appear in report config');

const edgeCases = JSON.parse(fs.readFileSync('test/fixtures/custom-rules/edge-cases.json', 'utf8'));
const zeroWeightReport = applyCustomRules(analyzeDiff(diffText), diffText, [edgeCases.zeroWeight]);
const zeroWeightHit = zeroWeightReport.rules.find((rule) => rule.id === 'custom:zero-weight');
assert(zeroWeightHit?.weight === 0, 'zero-weight custom rule should remain visible with weight zero');
assert(zeroWeightReport.riskScore === report.riskScore, 'zero-weight custom rule should not change total risk');
assert(zeroWeightReport.files[0].riskScore === report.files[0].riskScore, 'zero-weight custom rule should not change per-file risk');

const maximumWeightReport = applyCustomRules(analyzeDiff(diffText), diffText, [edgeCases.maximumWeight]);
const maximumWeightHit = maximumWeightReport.rules.find((rule) => rule.id === 'custom:maximum-weight');
assert(maximumWeightHit?.weight === 10, 'maximum custom rule weight should be accepted');
assert(maximumWeightReport.riskScore === report.riskScore + 10, 'maximum custom rule weight should be applied exactly once');

const negativeWeightReport = applyCustomRules(analyzeDiff(diffText), diffText, [edgeCases.negativeWeight]);
assert(negativeWeightReport.rules.every((rule) => rule.id !== 'custom:negative-weight'), 'negative custom rule weight should be rejected');
assert(negativeWeightReport.customRuleWarnings.some((warning) => warning.includes('0 to 10')), 'negative weight warning should document the permitted range');

const extremeWeightReport = applyCustomRules(analyzeDiff(diffText), diffText, [edgeCases.extremeWeight]);
assert(extremeWeightReport.rules.every((rule) => rule.id !== 'custom:extreme-weight'), 'extreme custom rule weight should be rejected');

const coercedWeightReport = applyCustomRules(analyzeDiff(diffText), diffText, [edgeCases.coercedWeight]);
assert(coercedWeightReport.rules.every((rule) => rule.id !== 'custom:coerced-weight'), 'string custom rule weight should not be coerced');

const duplicateRules = [edgeCases.duplicateWeight, { ...edgeCases.duplicateWeight, label: 'Duplicate second rule' }];
const duplicateRuleReport = applyCustomRules(analyzeDiff(diffText), diffText, duplicateRules);
assert(duplicateRuleReport.config.customRules.length === 1, 'duplicate custom rule ids should be applied only once');
assert(duplicateRuleReport.customRuleWarnings.some((warning) => warning.includes('duplicate rule id')), 'duplicate custom rule ids should produce a warning');

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
  const detectedDetails = detectProjectCheckDetails(projectFixture);
  assert(detectedChecks.includes('npm test'), 'package test script should be detected');
  assert(detectedChecks.includes('npm run smoke'), 'package smoke script should be detected');
  assert(detectedChecks.includes('node smoke_save.mjs'), 'root smoke file should be detected');
  assert(detectedChecks.includes('npm run verify'), 'README check command should be detected');

  const projectCheckReport = applyProjectChecks(analyzeDiff(diffText), detectedDetails);
  assert(projectCheckReport.projectChecks.includes('npm run smoke'), 'report should expose detected project checks');
  assert(projectCheckReport.projectCheckDetails.length === detectedDetails.length, 'report should expose project check details');
  assert(
    projectCheckReport.projectCheckDetails.every((detail) =>
      detail.sources.length && detail.sources.every((source) => source.path && source.reason)
    ),
    'every project check detail should explain its source'
  );
  assert(projectCheckReport.suggestedChecks[0].startsWith('Project check:'), 'project checks should lead suggested checks');
  assert(formatReport(projectCheckReport).includes('Project check sources:'), 'text output should explain project checks');
  assert(formatMarkdownReport(projectCheckReport).includes('## Project check sources'), 'Markdown should explain project checks');

  const legacyCheckReport = applyProjectChecks(analyzeDiff(diffText), detectedChecks);
  assert(
    JSON.stringify(legacyCheckReport.projectChecks) === JSON.stringify(detectedChecks),
    'legacy string project-check input should remain compatible'
  );
  assert(legacyCheckReport.projectCheckDetails.length === 0, 'legacy string input should not invent source metadata');

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
for (const packagePath of [
  'src/',
  'scripts/',
  'examples/',
  'policies/',
  'schemas/',
  'docs/policy-packs.md',
  'docs/policy-pack-migrations.md',
  'docs/starter-policy-packs.md',
  'docs/review-guidance.md',
  'action.yml',
  'README.md',
  'CHANGELOG.md',
  'LICENSE'
]) {
  assert(packageMetadata.files.includes(packagePath), `package files should include ${packagePath}`);
}

const cliSource = fs.readFileSync('src/cli.js', 'utf8');
assert(cliSource.includes('--fail-threshold'), 'CLI should expose fail-threshold override');
assert(cliSource.includes('applyCustomRules'), 'CLI should apply configured custom rules');
assert(cliSource.includes('--pr-title'), 'CLI should expose PR title context');
assert(cliSource.includes('--pr-body'), 'CLI should expose PR body file context');
assert(cliSource.includes('--policy'), 'CLI should expose explicit starter-policy selection');
assert(cliSource.includes('inspectRepository'), 'CLI should inspect repository-specific checks and package impact');

const actionSource = fs.readFileSync('action.yml', 'utf8');
for (const actionContract of ['comment:', 'fail-threshold:', 'policy:', 'diff-path:', 'src/cli.js', 'scripts/pr-comment.js']) {
  assert(actionSource.includes(actionContract), `action.yml should include ${actionContract}`);
}
assert(fs.existsSync('src/cli.js'), 'Action CLI target should exist');
assert(fs.existsSync('scripts/pr-comment.js'), 'Action comment helper target should exist');
assert(fs.existsSync('src/customRules.js'), 'Custom rule module should exist');
assert(fs.existsSync('src/prContext.js'), 'PR context module should exist');
assert(fs.existsSync('src/projectChecks.js'), 'Project check detector should exist');
assert(fs.existsSync('src/affectedPackages.js'), 'Affected-package mapper should exist');
assert(fs.existsSync('src/repositoryIntelligence.js'), 'Repository-intelligence composer should exist');
assert(fs.existsSync('src/policyPacks.js'), 'Policy-pack validator should exist');
assert(fs.existsSync('src/starterPolicies.js'), 'Starter-policy loader should exist');
assert(fs.existsSync('src/reviewGuidance.js'), 'Review-guidance module should exist');
assert(fs.existsSync('schemas/policy-pack-v1.schema.json'), 'Policy-pack JSON schema should exist');
assert(packageMetadata.scripts?.['test:policies'], 'Package should expose the policy conformance gate');
assert(packageMetadata.scripts?.['test:guidance'], 'Package should expose the review-guidance gate');
for (const policyId of ['frontend', 'backend', 'library', 'browser-game', 'infrastructure']) {
  assert(fs.existsSync(`policies/starter/${policyId}.json`), `Starter policy ${policyId} should exist`);
}

const readme = fs.readFileSync('README.md', 'utf8');
assert(readme.includes('npm pack --dry-run'), 'README should document package inspection');
assert(readme.includes('npx --package . merge-guard'), 'README should document npx-style use');
assert(readme.includes('Reusable GitHub Action'), 'README should document reusable Action use');
assert(readme.includes('pull-requests: write'), 'README should document comment permissions');
assert(readme.includes('customRules'), 'README should document custom rules');
assert(readme.includes('pathPattern'), 'README should include a realistic custom path rule');
assert(readme.includes('--pr-title'), 'README should document PR title context');
assert(readme.includes('Project-specific suggested checks'), 'README should document project check detection');
assert(readme.includes('Policy-pack schema'), 'README should document the policy-pack contract');
assert(readme.includes('--policy frontend'), 'README should document explicit starter-policy selection');
assert(readme.includes('CODEOWNERS guidance'), 'README should document guidance-only ownership suggestions');

const fixtureRoot = path.resolve('test/fixtures');
const affectedFixtureDiff = fs.readFileSync(
  path.join(fixtureRoot, 'affected-packages', 'changes.diff'),
  'utf8'
);
const repositoryReport = applyRepositoryIntelligence(
  analyzeDiff(affectedFixtureDiff),
  inspectRepository(affectedFixtureDiff, path.join(fixtureRoot, 'npm-workspaces'))
);
assert(repositoryReport.repository.kind === 'npm-workspaces', 'report should expose repository layout');
assert(
  repositoryReport.repository.affectedPackages.directPackages.length === 3,
  'report should expose directly affected packages'
);
assert(
  repositoryReport.repository.affectedPackages.sharedFiles.some((file) => file.path === 'package.json'),
  'report should expose repository-level shared files'
);
assert(formatMarkdownReport(repositoryReport).includes('## Repository impact'), 'Markdown should expose repository impact');

const nodeFixtureChecks = detectProjectChecks(path.join(fixtureRoot, 'node-project'));
assert(nodeFixtureChecks.includes('npm test'), 'Node fixture should detect npm test');
assert(nodeFixtureChecks.includes('npm run smoke'), 'Node fixture should detect npm smoke');
assert(nodeFixtureChecks.includes('npm run verify:content'), 'Node fixture should detect named verification scripts');
assert(nodeFixtureChecks.includes('node smoke_save.mjs'), 'Node fixture should detect root smoke files');
assert(nodeFixtureChecks.includes('npm run verify'), 'Node fixture should detect README npm commands');
assert(nodeFixtureChecks.includes('node smoke_readme.js'), 'Node fixture should detect README smoke commands');

const pythonFixtureChecks = detectProjectChecks(path.join(fixtureRoot, 'python-project'));
assert(pythonFixtureChecks.includes('python -m pytest'), 'Python fixture should detect pytest metadata');
assert(pythonFixtureChecks.includes('python -m unittest discover -s tests'), 'Python fixture should detect documented unittest commands');
assert(pythonFixtureChecks.includes('python -m ruff check .'), 'Python fixture should detect Ruff configuration');
assert(pythonFixtureChecks.includes('python -m build'), 'Python fixture should detect build metadata');
assert(pythonFixtureChecks.includes('python -m tox'), 'Python fixture should detect tox configuration');
assert(new Set(pythonFixtureChecks).size === pythonFixtureChecks.length, 'Python fixture commands should be deduplicated');

const malformedFixtureChecks = detectProjectChecks(path.join(fixtureRoot, 'malformed-package'));
assert(malformedFixtureChecks.length === 0, 'Malformed package fixture should fail closed');

const emptyFixtureChecks = detectProjectChecks(path.join(fixtureRoot, 'empty'));
assert(emptyFixtureChecks.length === 0, 'Empty fixture should not invent project checks');

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
