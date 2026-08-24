import fs from 'node:fs';
import path from 'node:path';

const SCRIPT_PRIORITY = [
  'smoke',
  'test',
  'check',
  'validate',
  'lint',
  'typecheck',
  'build',
  'migrate',
  'migration',
  'db',
  'database',
  'deploy'
];
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

function safeReadText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function scriptCategory(name) {
  if (/smoke|test/i.test(name)) return 'test';
  if (/lint|typecheck|check|verify|validate/i.test(name)) return 'lint';
  if (/build/i.test(name)) return 'build';
  if (/migrat/i.test(name)) return 'migration';
  if (/database|\bdb\b/i.test(name)) return 'database';
  if (/deploy|release/i.test(name)) return 'deployment';
  return 'verification';
}

function commandDetail(command, {
  category = 'verification',
  ecosystem = 'generic',
  path: sourcePath,
  reason
}) {
  return {
    command,
    category,
    ecosystem,
    sources: [{ path: sourcePath, reason }]
  };
}

function mergeDetails(details) {
  const byCommand = new Map();

  for (const detail of details) {
    if (!detail || typeof detail.command !== 'string' || !detail.command.trim()) continue;
    const command = detail.command.trim();

    if (!byCommand.has(command)) {
      byCommand.set(command, {
        command,
        category: detail.category,
        ecosystem: detail.ecosystem,
        sources: []
      });
    }

    const target = byCommand.get(command);
    for (const source of detail.sources || []) {
      if (!source || typeof source.path !== 'string' || typeof source.reason !== 'string') continue;
      if (!target.sources.some((existing) => existing.path === source.path && existing.reason === source.reason)) {
        target.sources.push({ path: source.path, reason: source.reason });
      }
    }
  }

  return [...byCommand.values()].map((detail) => ({
    ...detail,
    sources: detail.sources.sort((left, right) =>
      left.path.localeCompare(right.path) || left.reason.localeCompare(right.reason)
    )
  }));
}

function packageScriptDetails(cwd) {
  const packageJson = safeReadJson(path.join(cwd, 'package.json'));
  const scripts = packageJson?.scripts;
  if (!scripts || typeof scripts !== 'object' || Array.isArray(scripts)) return [];

  const scriptNames = Object.keys(scripts).filter((name) => typeof scripts[name] === 'string');
  const selected = [];

  for (const preferredName of SCRIPT_PRIORITY) {
    if (scriptNames.includes(preferredName)) selected.push(preferredName);
  }

  for (const scriptName of scriptNames.sort()) {
    if (/smoke|test|check|verify|validate|lint|typecheck|build|migrat|database|(^|:)db($|:)|deploy/i.test(scriptName)) {
      selected.push(scriptName);
    }
  }

  return uniq(selected).map((scriptName) =>
    commandDetail(
      scriptName === 'test' ? 'npm test' : 'npm run ' + scriptName,
      {
        category: scriptCategory(scriptName),
        ecosystem: 'node',
        path: 'package.json#scripts.' + scriptName,
        reason: 'npm script "' + scriptName + '" is defined'
      }
    )
  );
}

function rootSmokeDetails(cwd) {
  try {
    return fs.readdirSync(cwd, { withFileTypes: true })
      .filter((entry) => entry.isFile() && SMOKE_FILE_PATTERN.test(entry.name))
      .map((entry) =>
        commandDetail('node ' + entry.name, {
          category: 'test',
          ecosystem: 'node',
          path: entry.name,
          reason: 'root smoke file is present'
        })
      )
      .sort((left, right) => left.command.localeCompare(right.command));
  } catch {
    return [];
  }
}

function hasSection(content, sectionName) {
  if (!content) return false;
  const escaped = sectionName.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&');
  return new RegExp('^\\s*\\[' + escaped + '\\]\\s*(?:[#;].*)?$', 'mi').test(content);
}

function pythonMetadataDetails(cwd) {
  const details = [];
  const pyproject = safeReadText(path.join(cwd, 'pyproject.toml'));
  const setupCfg = safeReadText(path.join(cwd, 'setup.cfg'));
  const toxIni = safeReadText(path.join(cwd, 'tox.ini'));
  const pytestIni = safeReadText(path.join(cwd, 'pytest.ini'));

  if (hasSection(pyproject, 'tool.pytest.ini_options') || pytestIni !== null || hasSection(setupCfg, 'tool:pytest')) {
    const sourcePath = hasSection(pyproject, 'tool.pytest.ini_options')
      ? 'pyproject.toml#tool.pytest.ini_options'
      : pytestIni !== null
        ? 'pytest.ini'
        : 'setup.cfg#tool:pytest';
    details.push(commandDetail('python -m pytest', {
      category: 'test',
      ecosystem: 'python',
      path: sourcePath,
      reason: 'pytest configuration is present'
    }));
  }

  if (hasSection(pyproject, 'tool.ruff')) {
    details.push(commandDetail('python -m ruff check .', {
      category: 'lint',
      ecosystem: 'python',
      path: 'pyproject.toml#tool.ruff',
      reason: 'Ruff configuration is present'
    }));
  }

  if (hasSection(pyproject, 'tool.black')) {
    details.push(commandDetail('python -m black --check .', {
      category: 'lint',
      ecosystem: 'python',
      path: 'pyproject.toml#tool.black',
      reason: 'Black configuration is present'
    }));
  }

  if (hasSection(pyproject, 'tool.mypy') || hasSection(setupCfg, 'mypy')) {
    details.push(commandDetail('python -m mypy .', {
      category: 'lint',
      ecosystem: 'python',
      path: hasSection(pyproject, 'tool.mypy') ? 'pyproject.toml#tool.mypy' : 'setup.cfg#mypy',
      reason: 'mypy configuration is present'
    }));
  }

  if (hasSection(setupCfg, 'flake8')) {
    details.push(commandDetail('python -m flake8', {
      category: 'lint',
      ecosystem: 'python',
      path: 'setup.cfg#flake8',
      reason: 'Flake8 configuration is present'
    }));
  }

  if (hasSection(pyproject, 'build-system') || fs.existsSync(path.join(cwd, 'setup.py'))) {
    details.push(commandDetail('python -m build', {
      category: 'build',
      ecosystem: 'python',
      path: hasSection(pyproject, 'build-system') ? 'pyproject.toml#build-system' : 'setup.py',
      reason: 'Python build metadata is present'
    }));
  }

  if (hasSection(toxIni, 'tox') || hasSection(toxIni, 'testenv')) {
    details.push(commandDetail('python -m tox', {
      category: 'test',
      ecosystem: 'python',
      path: 'tox.ini',
      reason: 'tox environment configuration is present'
    }));
  }

  const testsDirectory = path.join(cwd, 'tests');
  let hasRootTests = false;
  try {
    hasRootTests = fs.statSync(testsDirectory).isDirectory();
  } catch {
    try {
      hasRootTests = fs.readdirSync(cwd, { withFileTypes: true })
        .some((entry) => entry.isFile() && /^test_.*\.py$/i.test(entry.name));
    } catch {
      hasRootTests = false;
    }
  }

  if (hasRootTests && !details.some((detail) => detail.command === 'python -m pytest')) {
    details.push(commandDetail('python -m unittest discover', {
      category: 'test',
      ecosystem: 'python',
      path: fs.existsSync(testsDirectory) ? 'tests/' : 'test_*.py',
      reason: 'root Python test layout is present'
    }));
  }

  return details;
}

function normalizeReadmeLine(line) {
  return line
    .trim()
    .replace(/^[-*]\s+/, '')
    .replace(/^\$\s+/, '')
    .replace(/^\x60+|\x60+$/g, '')
    .trim();
}

function readmeCommand(line) {
  if (/^npm (?:test|run [\w:.-]+)$/.test(line)) {
    return { command: line, ecosystem: 'node', category: scriptCategory(line) };
  }

  if (/^node smoke[^\s]*\.(?:mjs|cjs|js)$/.test(line)) {
    return { command: line, ecosystem: 'node', category: 'test' };
  }

  const pythonPattern = /^python3? -m (?:pytest|unittest discover|ruff check \.|black --check \.|flake8|mypy \.|build|tox)(?:\s+[-\w./:=,]+)*$/;
  if (pythonPattern.test(line)) {
    const command = line.replace(/^python3 /, 'python ');
    const moduleName = command.slice('python -m '.length).split(/\s+/)[0];
    return {
      command,
      ecosystem: 'python',
      category: /pytest|unittest|tox/.test(moduleName)
        ? 'test'
        : /ruff|black|flake8|mypy/.test(moduleName)
          ? 'lint'
          : 'build'
    };
  }

  return null;
}

function readmeDetails(cwd) {
  const details = [];

  for (const readmeName of README_NAMES) {
    const content = safeReadText(path.join(cwd, readmeName));
    if (content === null) continue;

    for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
      const detected = readmeCommand(normalizeReadmeLine(rawLine));
      if (!detected) continue;
      details.push(commandDetail(detected.command, {
        category: detected.category,
        ecosystem: detected.ecosystem,
        path: README_NAMES[README_NAMES.indexOf(readmeName)] + ':' + (index + 1),
        reason: 'verification command is documented in the root README'
      }));
    }
  }

  return details;
}

export function detectProjectCheckDetails(cwd = process.cwd()) {
  return mergeDetails([
    ...packageScriptDetails(cwd),
    ...pythonMetadataDetails(cwd),
    ...rootSmokeDetails(cwd),
    ...readmeDetails(cwd)
  ]);
}

export function detectProjectChecks(cwd = process.cwd()) {
  return detectProjectCheckDetails(cwd).map((detail) => detail.command);
}

export function applyProjectChecks(report, checks) {
  const values = Array.isArray(checks) ? checks : [];
  const details = mergeDetails(
    values.filter((check) => check && typeof check === 'object' && !Array.isArray(check))
  ).filter((detail) => detail.sources.length);
  const legacyCommands = values
    .filter((check) => typeof check === 'string' && check.trim())
    .map((check) => check.trim());
  const detected = uniq([
    ...details.map((detail) => detail.command),
    ...legacyCommands
  ]);

  report.projectChecks = detected;
  report.projectCheckDetails = details;

  if (detected.length) {
    report.suggestedChecks = uniq([
      ...detected.map((command) => 'Project check: ' + command),
      ...(report.suggestedChecks || [])
    ]);
  }

  return report;
}
