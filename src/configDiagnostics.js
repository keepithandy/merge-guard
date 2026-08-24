const VALID_PRESETS = new Set(['safe', 'standard', 'strict']);

function receivedType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function makeDiagnostic({ severity, path, code, message, value, expected }) {
  return {
    severity,
    path,
    code,
    message,
    receivedType: receivedType(value),
    expected
  };
}

function addArrayDiagnostics(diagnostics, value, fieldName, expected) {
  if (!Array.isArray(value)) {
    diagnostics.push(makeDiagnostic({
      severity: 'fatal',
      path: fieldName,
      code: 'invalid-type',
      message: `${fieldName} must be an array.`,
      value,
      expected
    }));
    return;
  }

  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string' || !item.trim()) {
      diagnostics.push(makeDiagnostic({
        severity: 'fatal',
        path: `${fieldName}[${index}]`,
        code: 'invalid-item',
        message: `${fieldName}[${index}] must be a non-empty string.`,
        value: item,
        expected: 'non-empty string'
      }));
    }
  }
}

function addCustomRuleWarning(diagnostics, path, code, message, value, expected) {
  diagnostics.push(makeDiagnostic({
    severity: 'warning',
    path,
    code,
    message,
    value,
    expected
  }));
}

function validateCustomRules(value, diagnostics) {
  if (value === undefined) return;

  if (!Array.isArray(value)) {
    addCustomRuleWarning(
      diagnostics,
      'customRules',
      'invalid-type',
      'customRules will be ignored because it must be an array.',
      value,
      'array of rule objects'
    );
    return;
  }

  for (const [index, rule] of value.entries()) {
    const basePath = `customRules[${index}]`;

    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      addCustomRuleWarning(
        diagnostics,
        basePath,
        'invalid-item',
        `${basePath} will be ignored because it must be an object.`,
        rule,
        'object'
      );
      continue;
    }

    for (const field of ['id', 'label']) {
      if (typeof rule[field] !== 'string' || !rule[field].trim()) {
        addCustomRuleWarning(
          diagnostics,
          `${basePath}.${field}`,
          'required-string',
          `${basePath}.${field} is required for a custom rule.`,
          rule[field],
          'non-empty string'
        );
      }
    }

    if (!Number.isFinite(rule.weight)) {
      addCustomRuleWarning(
        diagnostics,
        `${basePath}.weight`,
        'invalid-number',
        `${basePath}.weight will be ignored because it must be a finite number.`,
        rule.weight,
        'finite number'
      );
    }

    for (const field of ['pathPattern', 'linePattern']) {
      if (rule[field] !== undefined && typeof rule[field] !== 'string') {
        addCustomRuleWarning(
          diagnostics,
          `${basePath}.${field}`,
          'invalid-type',
          `${basePath}.${field} must be a string when provided.`,
          rule[field],
          'string'
        );
      }
    }
  }
}

export function validateConfig(config) {
  const fatal = [];
  const warnings = [];

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    fatal.push(makeDiagnostic({
      severity: 'fatal',
      path: '$',
      code: 'invalid-config',
      message: 'merge-guard.config.json must contain a JSON object.',
      value: config,
      expected: 'object'
    }));
    return { fatal, warnings };
  }

  if (config.preset !== undefined) {
    if (typeof config.preset !== 'string') {
      fatal.push(makeDiagnostic({
        severity: 'fatal',
        path: 'preset',
        code: 'invalid-type',
        message: 'preset must be a string.',
        value: config.preset,
        expected: 'safe, standard, or strict'
      }));
    } else if (!VALID_PRESETS.has(config.preset.trim().toLowerCase())) {
      fatal.push(makeDiagnostic({
        severity: 'fatal',
        path: 'preset',
        code: 'invalid-value',
        message: `preset "${config.preset}" is not supported.`,
        value: config.preset,
        expected: 'safe, standard, or strict'
      }));
    }
  }

  if (config.failThreshold !== undefined) {
    if (!Number.isFinite(config.failThreshold) || !Number.isInteger(config.failThreshold) || config.failThreshold < 1) {
      fatal.push(makeDiagnostic({
        severity: 'fatal',
        path: 'failThreshold',
        code: 'invalid-value',
        message: 'failThreshold must be a positive integer.',
        value: config.failThreshold,
        expected: 'integer >= 1'
      }));
    }
  }

  if (config.highRiskPaths !== undefined) {
    addArrayDiagnostics(fatal, config.highRiskPaths, 'highRiskPaths', 'array of non-empty strings');
  }

  if (config.testCommands !== undefined) {
    addArrayDiagnostics(fatal, config.testCommands, 'testCommands', 'array of non-empty strings');
  }

  validateCustomRules(config.customRules, warnings);
  return { fatal, warnings };
}

export function formatDiagnostics(diagnostics, mode = 'text') {
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) return '';

  if (mode === 'json') return JSON.stringify(diagnostics, null, 2);

  const lines = diagnostics.map((diagnostic) =>
    `- [${diagnostic.severity.toUpperCase()}] ${diagnostic.path}: ${diagnostic.message} Expected ${diagnostic.expected}; received ${diagnostic.receivedType}.`
  );

  return lines.join('\n');
}

export class ConfigurationError extends Error {
  constructor(message, diagnostics) {
    super(message);
    this.name = 'ConfigurationError';
    this.diagnostics = diagnostics;
  }
}
