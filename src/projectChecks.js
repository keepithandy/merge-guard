import fs from 'node:fs';
import path from 'node:path';

const SCRIPT_PRIORITY = ['smoke', 'test', 'check', 'validate', 'lint', 'build'];
const SMOKE_FILE_PATTERN = /^smoke[^/]*\.(?:mjs|cjs|js)$/i;
const README_NAMES = ['README.md', 'README.txt', 'README'];

function uniq(values) {
  return [...new Set(values)];
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function packageScriptCommands(cwd) {
  const packageJson = safeReadJson(path.join(cwd, 'package.json'));
  const scripts = packageJson?.scripts;
  if (!scripts || typeof scripts !== 'object') return [];

  const scriptNames = Object.keys(scripts).filter((name) => typeof scripts[name] === 'string');
  const selected = [];

  for (const preferredName of SCRIPT_PRIORITY) {
    if (scriptNames.includes(preferredName)) selected.push(preferredName);
  }

  for (const scriptName of scriptNames.sort()) {
    if (/smoke|test|check|verify|validate/i.test(scriptName)) selected.push(scriptName);
  }

  return uniq(selected).map((scriptName) =>
    scriptName === 'test' ? 'npm test' : `npm run ${scriptName}`
  );
}

function rootSmokeCommands(cwd) {
  try {
    return fs.readdirSync(cwd, { withFileTypes: true })
      .filter((entry) => entry.isFile() && SMOKE_FILE_PATTERN.test(entry.name))
      .map((entry) => `node ${entry.name}`)
      .sort();
  } catch {
    return [];
  }
}

function readmeCommands(cwd) {
  const commands = [];

  for (const readmeName of README_NAMES) {
    const readmePath = path.join(cwd, readmeName);
    if (!fs.existsSync(readmePath)) continue;

    let content = '';
    try {
      content = fs.readFileSync(readmePath, 'utf8');
    } catch {
      continue;
    }

    for (const line of content.split('\n')) {
      const trimmed = line.trim().replace(/^`|`$/g, '');
      if (/^npm (?:test|run [\w:.-]+)$/.test(trimmed)) commands.push(trimmed);
      if (/^node smoke[^\s]*\.(?:mjs|cjs|js)$/.test(trimmed)) commands.push(trimmed);
    }
  }

  return commands;
}

export function detectProjectChecks(cwd = process.cwd()) {
  return uniq([
    ...packageScriptCommands(cwd),
    ...rootSmokeCommands(cwd),
    ...readmeCommands(cwd)
  ]);
}

export function applyProjectChecks(report, checks) {
  const detected = Array.isArray(checks)
    ? uniq(checks.filter((check) => typeof check === 'string' && check.trim()).map((check) => check.trim()))
    : [];

  report.projectChecks = detected;

  if (detected.length) {
    report.suggestedChecks = uniq([
      ...detected.map((command) => `Project check: ${command}`),
      ...(report.suggestedChecks || [])
    ]);
  }

  return report;
}
