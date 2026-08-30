import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeDiff, formatMarkdownReport, formatReport } from '../src/analyzeDiff.js';
import { createAiReviewSummary } from '../src/aiReview.js';
import { appendCustomRuleWarnings, applyCustomRules } from '../src/customRules.js';
import { appendPrContext, appendPrContextToAiReview, applyPrContext } from '../src/prContext.js';
import { applyProjectChecks, detectProjectCheckDetails, detectProjectChecks } from '../src/projectChecks.js';
import { applyRepositoryIntelligence, inspectRepository } from '../src/repositoryIntelligence.js';
import { formatPullRequestSummary, PULL_REQUEST_SUMMARY_MARKER } from '../src/pullRequestSummary.js';
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
assertString(report.reviewDecision, 'reviewDecision');
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
const pullRequestSummary = formatPullRequestSummary(report);
assert(pullRequestSummary.includes(PULL_REQUEST_SUMMARY_MARKER), 'PR summary should declare its contract marker');
assert(pullRequestSummary.includes('<summary>Files (2)</summary>'), 'PR summary should expand file details');
assert(pullRequestSummary.includes('### Highest-risk files'), 'PR summary should prioritize risky files');

const docsOnlyDiff = fs.readFileSync('examples/docs-only.diff', 'utf8');
const docsOnlyReport = analyzeDiff(docsOnlyDiff);
assert(docsOnlyReport.docsOnly === true, 'docs-only diff should be detected');
assert(docsOnlyReport.riskLevel === 'LOW', 'docs-only diff should stay low risk');
assert(docsOnlyReport.flags.includes('Docs-only change detected'), 'docs-only flag should be present');
assert(docsOnlyReport.rules.some((rule) => rule.id === 'docs-only'), 'docs-only rule should be present');

const keywordNoiseDiff = [
  'diff --git a/src/historicalPrEvaluation.js b/src/historicalPrEvaluation.js',
  'index 1111111..2222222 100644',
  '--- a/src/historicalPrEvaluation.js',
  '+++ b/src/historicalPrEvaluation.js',
  '@@ -1,2 +1,5 @@',
  '+for (const entry of entries) {',
  '+  const result = Promise.resolve(entry);',
  '+  return result;',
  '+}'
].join('\n');
const keywordNoiseReport = analyzeDiff(keywordNoiseDiff);
assert(!keywordNoiseReport.flags.includes('Routing or entry-point logic changed'), 'generic entry variables must not trigger routing risk');
assert(!keywordNoiseReport.flags.includes('Async or network behavior changed'), 'Promise.resolve without I/O must not trigger network risk');
assert(report.suggestedChecks.length > 0, 'reports should expose suggested checks');

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

const commentBody = buildCommentBody(pullRequestSummary);
assert(commentBody.includes(MERGE_GUARD_COMMENT_MARKER), 'PR comment should include stable marker');
assert(commentBody.includes('## merge-guard review summary'), 'PR comment should include compact review summary');

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
  'dashboard/',
  'docs/policy-packs.md',
  'docs/policy-pack-migrations.md',
  'docs/starter-policy-packs.md',
  'docs/review-guidance.md',
  'docs/policy-inheritance.md',
  'docs/pull-request-summaries.md',
  'docs/github-review-outputs.md',
  'docs/finding-comparisons.md',
  'docs/review-experience-fixtures.md',
  'docs/evidence-reproducibility.md',
  'docs/EVALUATION_HARNESS_DESIGN.md',
  'docs/historical-pr-evaluation.md',
  'docs/architecture/dashboard-architecture.md',
  'docs/architecture/dashboard-threat-model.md',
  'docs/architecture/decisions/0001-local-dashboard-boundary.md',
  'action.yml',
  'README.md',
  'CHANGELOG.md',
  'LICENSE'
]) {
  assert(
    packageMetadata.files.includes(packagePath) || (packagePath.startsWith('docs/') && packageMetadata.files.includes('docs/')),
    `package files should include ${packagePath}`
  );
}

const cliSource = fs.readFileSync('src/cli.js', 'utf8');
assert(cliSource.includes('--fail-threshold'), 'CLI should expose fail-threshold override');
assert(cliSource.includes('applyCustomRules'), 'CLI should apply configured custom rules');
assert(cliSource.includes('--pr-title'), 'CLI should expose PR title context');
assert(cliSource.includes('--pr-body'), 'CLI should expose PR body file context');
assert(cliSource.includes('--policy'), 'CLI should expose explicit starter-policy selection');
assert(cliSource.includes('inspectRepository'), 'CLI should inspect repository-specific checks and package impact');

const actionSource = fs.readFileSync('action.yml', 'utf8');
for (const actionContract of ['comment:', 'comment-dry-run:', 'fail-threshold:', 'policy:', 'policy-config:', 'impact-metadata:', 'annotations:', 'sarif:', 'compare:', 'previous-report:', 'previous-manifest:', 'expected-previous-repository:', 'expected-previous-branch:', 'expected-previous-commit:', 'report-path:', 'manifest-path:', 'annotations-path:', 'sarif-path:', 'comparison-path:', 'comparison-status:', 'prior-evidence-status:', 'projection-path:', 'projection-status:', 'diff-path:', '--impact-metadata', '--pr-summary', '--report-json', '--dry-run', 'src/cli.js', 'scripts/pr-comment.js', 'scripts/github-review-outputs.js', 'scripts/compare-reports.js', 'scripts/create-artifact-manifest.js', 'scripts/create-review-projection.js']) {
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
assert(fs.existsSync('src/policyResolution.js'), 'Policy-resolution module should exist');
assert(fs.existsSync('src/pullRequestSummary.js'), 'Pull-request summary module should exist');
assert(fs.existsSync('src/githubReviewOutputs.js'), 'GitHub review-output module should exist');
assert(fs.existsSync('src/findingComparison.js'), 'Finding-comparison module should exist');
assert(fs.existsSync('scripts/review-experience-e2e.js'), 'Review experience fixture runner should exist');
assert(fs.existsSync('scripts/review-projection-contracts.js'), 'Review projection resilience gate should exist');
assert(fs.existsSync('scripts/evidence-reproducibility-contracts.js'), 'Evidence reproducibility gate should exist');
assert(fs.existsSync('scripts/evaluation-design-contracts.js'), 'Historical PR evaluation design gate should exist');
assert(fs.existsSync('src/historicalPrEvaluation.js'), 'Historical PR evaluation module should exist');
assert(fs.existsSync('scripts/evaluate-historical-prs.js'), 'Historical PR evaluation CLI should exist');
assert(fs.existsSync('scripts/historical-pr-evaluation-contracts.js'), 'Historical PR evaluation harness gate should exist');
assert(fs.existsSync('schemas/historical-pr-corpus-v1.schema.json'), 'Historical PR corpus schema should exist');
assert(fs.existsSync('schemas/historical-pr-labels-v1.schema.json'), 'Historical PR labels schema should exist');
assert(fs.existsSync('schemas/historical-pr-case-result-v1.schema.json'), 'Historical PR case-result schema should exist');
assert(fs.existsSync('schemas/historical-pr-evaluation-result-v1.schema.json'), 'Historical PR aggregate-result schema should exist');
assert(fs.existsSync('test/snapshots/evidence-reproducibility-v1.json'), 'Evidence reproducibility hash snapshot should exist');
assert(fs.existsSync('schemas/review-projection-v1.schema.json'), 'Review projection schema should exist');
assert(fs.existsSync('.github/workflows/review-experience-fixture.yml'), 'Review experience workflow should exist');
assert(fs.existsSync('test/fixtures/review-e2e/push-1.diff'), 'First-push review fixture should exist');
assert(fs.existsSync('test/fixtures/review-e2e/push-2.diff'), 'Second-push review fixture should exist');
assert(fs.existsSync('test/snapshots/review-experience-e2e.json'), 'Review experience snapshot should exist');
assert(fs.existsSync('dashboard/architecture-boundary.v1.json'), 'Dashboard boundary manifest should exist');
assert(fs.existsSync('schemas/dashboard-boundary-v1.schema.json'), 'Dashboard boundary schema should exist');
assert(fs.existsSync('scripts/dashboard-architecture-contracts.js'), 'Dashboard architecture gate should exist');
assert(fs.existsSync('scripts/dashboard-import-contracts.js'), 'Dashboard import gate should exist');
assert(fs.existsSync('scripts/dashboard-explorer-contracts.js'), 'Dashboard explorer gate should exist');
assert(fs.existsSync('scripts/dashboard-accessibility-contracts.js'), 'Dashboard accessibility gate should exist');
assert(fs.existsSync('scripts/artifact-manifest-contracts.js'), 'Artifact manifest gate should exist');
assert(fs.existsSync('scripts/evidence-handoff-contracts.js'), 'Evidence handoff gate should exist');
assert(fs.existsSync('schemas/artifact-manifest-v1.schema.json'), 'Artifact manifest schema should exist');
assert(fs.existsSync('scripts/legacy-risk-contracts.js'), 'Legacy risk gate should exist');
assert(fs.existsSync('schemas/legacy-risk-v1.schema.json'), 'Legacy risk schema should exist');
assert(fs.existsSync('scripts/report-trends-contracts.js'), 'Report trends gate should exist');
assert(fs.existsSync('scripts/plugin-manifest-contracts.js'), 'Plugin manifest gate should exist');
assert(fs.existsSync('schemas/plugin-manifest-v1.schema.json'), 'Plugin manifest schema should exist');
assert(fs.existsSync('scripts/plugin-worker-contracts.js'), 'Plugin worker gate should exist');
assert(fs.existsSync('scripts/plugin-attestation-contracts.js'), 'Plugin attestation gate should exist');
assert(fs.existsSync('schemas/plugin-attestation-v1.schema.json'), 'Plugin attestation schema should exist');
assert(fs.existsSync('scripts/plugin-conformance-contracts.js'), 'Plugin conformance gate should exist');
assert(fs.existsSync('scripts/installation-contracts.js'), 'Installation validation gate should exist');
assert(fs.existsSync('dashboard/server.js'), 'Dashboard loopback server should exist');
assert(fs.existsSync('schemas/policy-pack-v1.schema.json'), 'Policy-pack JSON schema should exist');
assert(fs.existsSync('schemas/policy-manifest-v1.schema.json'), 'Policy-manifest JSON schema should exist');
assert(fs.existsSync('schemas/github-review-output-v1.schema.json'), 'GitHub review-output JSON schema should exist');
assert(fs.existsSync('schemas/finding-comparison-v1.schema.json'), 'Finding-comparison JSON schema should exist');
assert(packageMetadata.scripts?.['test:policies'], 'Package should expose the policy conformance gate');
assert(packageMetadata.scripts?.['test:guidance'], 'Package should expose the review-guidance gate');
assert(packageMetadata.scripts?.['test:policy-resolution'], 'Package should expose the policy-resolution gate');
assert(packageMetadata.scripts?.['test:pr-summary'], 'Package should expose the pull-request summary gate');
assert(packageMetadata.scripts?.['test:github-review'], 'Package should expose the GitHub review-output gate');
assert(packageMetadata.scripts?.['test:finding-comparison'], 'Package should expose the finding-comparison gate');
assert(packageMetadata.scripts?.['test:review-e2e'], 'Package should expose the end-to-end review gate');
assert(packageMetadata.scripts?.['test:review-projection'], 'Package should expose the review projection resilience gate');
assert(packageMetadata.scripts?.['test:evidence-reproducibility'], 'Package should expose the evidence reproducibility gate');
assert(packageMetadata.scripts?.['test:evaluation-design'], 'Package should expose the historical PR evaluation design gate');
assert(packageMetadata.scripts?.['test:historical-pr-evaluation'], 'Package should expose the historical PR evaluation harness gate');
assert(packageMetadata.scripts?.['eval:historical-prs'], 'Package should expose the local historical PR evaluation command');
assert(packageMetadata.scripts?.['test:dashboard-architecture'], 'Package should expose the dashboard architecture gate');
assert(packageMetadata.scripts?.['test:dashboard-import'], 'Package should expose the dashboard import gate');
assert(packageMetadata.scripts?.['test:dashboard-explorer'], 'Package should expose the dashboard explorer gate');
assert(packageMetadata.scripts?.['test:dashboard-accessibility'], 'Package should expose the dashboard accessibility gate');
assert(packageMetadata.scripts?.['test:artifact-manifest'], 'Package should expose the artifact manifest gate');
assert(packageMetadata.scripts?.['test:evidence-handoff'], 'Package should expose the evidence handoff gate');
assert(packageMetadata.scripts?.['test:legacy-risk'], 'Package should expose the legacy risk gate');
assert(packageMetadata.scripts?.['test:report-trends'], 'Package should expose the report trends gate');
assert(packageMetadata.scripts?.['test:plugin-manifest'], 'Package should expose the plugin manifest gate');
assert(packageMetadata.scripts?.['test:plugin-worker'], 'Package should expose the plugin worker gate');
assert(packageMetadata.scripts?.['test:plugin-attestation'], 'Package should expose the plugin attestation gate');
assert(packageMetadata.scripts?.['test:plugin-conformance'], 'Package should expose the plugin conformance gate');
assert(packageMetadata.scripts?.['test:installation'], 'Package should expose the installation gate');
assert(packageMetadata.scripts?.['test:security'], 'Package should expose the security gate');
assert(packageMetadata.scripts?.['test:performance'], 'Package should expose the performance gate');
assert(packageMetadata.scripts?.['test:impact-compatibility'], 'Package should expose the impact compatibility gate');
assert(packageMetadata.scripts?.['test:release-candidate'], 'Package should expose the release-candidate gate');
assert(packageMetadata.scripts?.['test:public-contracts'], 'Package should expose the public-contract gate');
assert(packageMetadata.scripts?.['test:release-artifacts'], 'Package should expose the artifact gate');
assert(packageMetadata.scripts?.['test:distribution'], 'Package should expose the distribution gate');
assert(packageMetadata.scripts?.['test:support'], 'Package should expose the support gate');
assert(packageMetadata.scripts?.['test:version'], 'Package should expose the version-consistency gate');
assert(packageMetadata.scripts?.['release:stage'], 'Package should expose the non-publishing release-staging command');
assert(packageMetadata.scripts?.test === 'node scripts/test.js', 'Package should expose one consolidated local test command');
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
assert(readme.includes('Targeted checks'), 'README should document targeted check selection');
assert(readme.includes('advanced subsystems'), 'README should separate optional advanced features from the core path');
assert(readme.includes('review decision'), 'README should document conservative review decisions');
assert(readme.includes('--pr-summary'), 'README should document compact pull-request summaries');
assert(readme.includes('--annotations'), 'README should document changed-line annotation output');
assert(readme.includes('--sarif'), 'README should document optional SARIF output');
assert(readme.includes('compare-reports.js'), 'README should document immutable finding comparison');
assert(readme.includes('caller-owned evidence handoff example'), 'README should document caller-owned evidence handoff');

const reviewWorkflow = fs.readFileSync('.github/workflows/review-experience-fixture.yml', 'utf8');
assert(reviewWorkflow.includes('comment: "false"'), 'Review workflow should exercise report-only mode');
assert(reviewWorkflow.includes('impact-metadata: test/fixtures/impact-metadata/valid.json'), 'Review workflow should exercise explicit impact-metadata Action input');
assert(reviewWorkflow.includes('comment: "true"'), 'Review workflow should exercise comment mode');
assert(reviewWorkflow.includes('comment-dry-run: "true"'), 'Review workflow comment mode should avoid GitHub writes');
assert(reviewWorkflow.includes('annotations: "true"'), 'Review workflow should enable annotations');
assert(reviewWorkflow.includes('sarif: "true"'), 'Review workflow should enable SARIF');
assert(reviewWorkflow.includes('previous-report:'), 'Review workflow should compare successive reports');
assert(reviewWorkflow.includes('previous-manifest:'), 'Review workflow should verify the prior report manifest');
assert(reviewWorkflow.includes('prior-evidence-status'), 'Review workflow should assert prior-evidence status');
assert(!reviewWorkflow.includes('secrets.'), 'Review workflow should not require repository or third-party secrets');

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
