import { compileSafeRegex, SAFE_REGEX_MAX_LENGTH } from './safeRegex.js';

export const POLICY_PACK_SCHEMA_VERSION = 1;
export const REPORT_SCHEMA_VERSION = 1;
export const MERGE_GUARD_VERSION = '0.1.0';

const TOP_LEVEL_FIELDS = new Set([
  'schemaVersion',
  'identity',
  'compatibility',
  'rules',
  'protectedPaths',
  'requiredChecks'
]);
const ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const MAX_PATTERN_LENGTH = 500;

function receivedType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function diagnostic({ severity = 'fatal', path, code, message, value, expected, guidance }) {
  return {
    severity,
    path,
    code,
    message,
    receivedType: receivedType(value),
    expected,
    ...(guidance ? { guidance } : {})
  };
}

function addDiagnostic(target, options) {
  target.push(diagnostic(options));
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizedString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requireObject(value, path, fatal) {
  if (isObject(value)) return true;
  addDiagnostic(fatal, {
    path,
    code: 'invalid-type',
    message: `${path} must be an object.`,
    value,
    expected: 'object'
  });
  return false;
}

function requireString(value, path, fatal, expected = 'non-empty string') {
  const normalized = normalizedString(value);
  if (normalized) return normalized;
  addDiagnostic(fatal, {
    path,
    code: 'required-string',
    message: `${path} must be a non-empty string.`,
    value,
    expected
  });
  return null;
}

function validateId(value, path, fatal) {
  const id = requireString(value, path, fatal, 'lowercase policy identifier');
  if (!id) return null;
  if (!ID_PATTERN.test(id)) {
    addDiagnostic(fatal, {
      path,
      code: 'invalid-id',
      message: `${path} must use lowercase letters, digits, dots, underscores, or hyphens.`,
      value,
      expected: 'lowercase identifier matching ' + ID_PATTERN.source
    });
    return null;
  }
  return id;
}

function parseSemver(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(SEMVER_PATTERN);
  if (!match) return null;
  return {
    value: value.trim(),
    parts: match.slice(1, 4).map(Number)
  };
}

function compareSemver(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left.parts[index] !== right.parts[index]) {
      return left.parts[index] - right.parts[index];
    }
  }
  return 0;
}

function requireSemver(value, path, fatal) {
  const parsed = parseSemver(value);
  if (parsed) return parsed;
  addDiagnostic(fatal, {
    path,
    code: 'invalid-semver',
    message: `${path} must contain a semantic version.`,
    value,
    expected: 'MAJOR.MINOR.PATCH with optional prerelease/build metadata'
  });
  return null;
}

function warnUnknownFields(value, allowed, path, warnings) {
  if (!isObject(value)) return;
  for (const field of Object.keys(value).sort()) {
    if (allowed.has(field)) continue;
    addDiagnostic(warnings, {
      severity: 'warning',
      path: `${path}.${field}`,
      code: 'unknown-field',
      message: `${path}.${field} is not part of policy-pack schema version 1 and will be ignored.`,
      value: value[field],
      expected: 'documented schema field'
    });
  }
}

function validateSchemaVersion(value, fatal) {
  if (value === undefined) {
    addDiagnostic(fatal, {
      path: '$.schemaVersion',
      code: 'missing-schema-version',
      message: 'Policy packs must declare schemaVersion explicitly.',
      value,
      expected: `integer ${POLICY_PACK_SCHEMA_VERSION}`,
      guidance: 'docs/policy-pack-migrations.md#missing-schema-version'
    });
    return null;
  }

  if (!Number.isInteger(value)) {
    addDiagnostic(fatal, {
      path: '$.schemaVersion',
      code: 'invalid-schema-version',
      message: 'schemaVersion must be an integer.',
      value,
      expected: `integer ${POLICY_PACK_SCHEMA_VERSION}`
    });
    return null;
  }

  if (value < POLICY_PACK_SCHEMA_VERSION) {
    addDiagnostic(fatal, {
      path: '$.schemaVersion',
      code: 'legacy-schema-version',
      message: `Policy-pack schema version ${value} is no longer accepted.`,
      value,
      expected: `schema version ${POLICY_PACK_SCHEMA_VERSION}`,
      guidance: 'docs/policy-pack-migrations.md#legacy-schema-versions'
    });
    return null;
  }

  if (value > POLICY_PACK_SCHEMA_VERSION) {
    addDiagnostic(fatal, {
      path: '$.schemaVersion',
      code: 'future-schema-version',
      message: `Policy-pack schema version ${value} is newer than this Merge Guard supports.`,
      value,
      expected: `schema version ${POLICY_PACK_SCHEMA_VERSION}`,
      guidance: 'Upgrade Merge Guard before using this policy pack.'
    });
    return null;
  }

  return value;
}

function validateIdentity(value, fatal, warnings) {
  if (!requireObject(value, '$.identity', fatal)) return null;
  warnUnknownFields(value, new Set(['id', 'name', 'version', 'description']), '$.identity', warnings);

  const id = validateId(value.id, '$.identity.id', fatal);
  const name = requireString(value.name, '$.identity.name', fatal);
  const version = requireSemver(value.version, '$.identity.version', fatal)?.value ?? null;
  const description = normalizedString(value.description);

  if (!description) {
    addDiagnostic(warnings, {
      severity: 'warning',
      path: '$.identity.description',
      code: 'missing-description',
      message: 'A policy description is recommended so selection assumptions are reviewable.',
      value: value.description,
      expected: 'non-empty string'
    });
  }

  return { id, name, version, description };
}

function validateCompatibility(value, fatal, warnings, runtime) {
  if (!requireObject(value, '$.compatibility', fatal)) return null;
  warnUnknownFields(
    value,
    new Set(['minimumMergeGuardVersion', 'maximumMergeGuardVersionExclusive', 'reportSchemaVersion']),
    '$.compatibility',
    warnings
  );

  const minimum = requireSemver(
    value.minimumMergeGuardVersion,
    '$.compatibility.minimumMergeGuardVersion',
    fatal
  );
  const maximum = requireSemver(
    value.maximumMergeGuardVersionExclusive,
    '$.compatibility.maximumMergeGuardVersionExclusive',
    fatal
  );
  const reportSchemaVersion = value.reportSchemaVersion;

  if (!Number.isInteger(reportSchemaVersion) || reportSchemaVersion < 1) {
    addDiagnostic(fatal, {
      path: '$.compatibility.reportSchemaVersion',
      code: 'invalid-report-schema-version',
      message: 'reportSchemaVersion must be a positive integer.',
      value: reportSchemaVersion,
      expected: `integer ${runtime.reportSchemaVersion}`
    });
  } else if (reportSchemaVersion > runtime.reportSchemaVersion) {
    addDiagnostic(fatal, {
      path: '$.compatibility.reportSchemaVersion',
      code: 'future-report-schema-version',
      message: `The policy requires report schema ${reportSchemaVersion}, but this runtime supports ${runtime.reportSchemaVersion}.`,
      value: reportSchemaVersion,
      expected: `integer <= ${runtime.reportSchemaVersion}`,
      guidance: 'Upgrade Merge Guard before selecting this pack.'
    });
  } else if (reportSchemaVersion < runtime.reportSchemaVersion) {
    addDiagnostic(warnings, {
      severity: 'warning',
      path: '$.compatibility.reportSchemaVersion',
      code: 'legacy-report-schema-version',
      message: `The policy targets report schema ${reportSchemaVersion}; compatibility should be reviewed against ${runtime.reportSchemaVersion}.`,
      value: reportSchemaVersion,
      expected: `integer ${runtime.reportSchemaVersion}`
    });
  }

  if (minimum && maximum && compareSemver(minimum, maximum) >= 0) {
    addDiagnostic(fatal, {
      path: '$.compatibility',
      code: 'invalid-version-range',
      message: 'minimumMergeGuardVersion must be lower than maximumMergeGuardVersionExclusive.',
      value,
      expected: 'non-empty semantic-version interval'
    });
  }

  const current = parseSemver(runtime.mergeGuardVersion);
  if (!current) {
    addDiagnostic(fatal, {
      path: '$runtime.mergeGuardVersion',
      code: 'invalid-runtime-version',
      message: 'The Merge Guard runtime version is not valid semantic version data.',
      value: runtime.mergeGuardVersion,
      expected: 'MAJOR.MINOR.PATCH'
    });
  } else {
    if (minimum && compareSemver(current, minimum) < 0) {
      addDiagnostic(fatal, {
        path: '$.compatibility.minimumMergeGuardVersion',
        code: 'incompatible-merge-guard-version',
        message: `This policy requires Merge Guard ${minimum.value} or newer.`,
        value: runtime.mergeGuardVersion,
        expected: `>= ${minimum.value}`,
        guidance: 'Upgrade Merge Guard before selecting this pack.'
      });
    }
    if (maximum && compareSemver(current, maximum) >= 0) {
      addDiagnostic(fatal, {
        path: '$.compatibility.maximumMergeGuardVersionExclusive',
        code: 'incompatible-merge-guard-version',
        message: `This policy does not declare compatibility with Merge Guard ${runtime.mergeGuardVersion}.`,
        value: runtime.mergeGuardVersion,
        expected: `< ${maximum.value}`,
        guidance: 'Use a newer policy-pack version or follow its migration guide.'
      });
    }
  }

  return {
    minimumMergeGuardVersion: minimum?.value ?? null,
    maximumMergeGuardVersionExclusive: maximum?.value ?? null,
    reportSchemaVersion: Number.isInteger(reportSchemaVersion) ? reportSchemaVersion : null
  };
}

function validatePattern(value, path, fatal) {
  const pattern = requireString(value, path, fatal, `safe regular expression <= ${MAX_PATTERN_LENGTH} characters`);
  if (!pattern) return null;
  if (pattern.length > MAX_PATTERN_LENGTH) {
    addDiagnostic(fatal, {
      path,
      code: 'pattern-too-long',
      message: `${path} exceeds the policy pattern length limit.`,
      value,
      expected: `regular expression <= ${MAX_PATTERN_LENGTH} characters`
    });
    return null;
  }
  try {
    compileSafeRegex(pattern, 'i');
  } catch (error) {
    addDiagnostic(fatal, {
      path,
      code: error.code || 'invalid-pattern',
      message: `${path} is not a safe, valid regular expression: ${error.message}`,
      value,
      expected: `safe case-insensitive regular expression <= ${SAFE_REGEX_MAX_LENGTH} characters`
    });
    return null;
  }
  return pattern;
}

function requireArray(value, path, fatal) {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  addDiagnostic(fatal, {
    path,
    code: 'invalid-type',
    message: `${path} must be an array.`,
    value,
    expected: 'array'
  });
  return [];
}

function duplicateId(id, path, ids, fatal) {
  if (!id) return;
  if (ids.has(id)) {
    addDiagnostic(fatal, {
      path,
      code: 'duplicate-id',
      message: `${path} duplicates the identifier "${id}".`,
      value: id,
      expected: 'unique identifier within this policy section'
    });
  } else {
    ids.add(id);
  }
}

function validateRules(value, fatal, warnings) {
  const entries = requireArray(value, '$.rules', fatal);
  const ids = new Set();
  const rules = [];

  for (const [index, rule] of entries.entries()) {
    const base = `$.rules[${index}]`;
    if (!requireObject(rule, base, fatal)) continue;
    warnUnknownFields(rule, new Set(['id', 'label', 'pathPattern', 'linePattern', 'weight', 'check']), base, warnings);

    const id = validateId(rule.id, `${base}.id`, fatal);
    duplicateId(id, `${base}.id`, ids, fatal);
    const label = requireString(rule.label, `${base}.label`, fatal);
    const pathPattern = rule.pathPattern === undefined ? null : validatePattern(rule.pathPattern, `${base}.pathPattern`, fatal);
    const linePattern = rule.linePattern === undefined ? null : validatePattern(rule.linePattern, `${base}.linePattern`, fatal);
    if (rule.pathPattern === undefined && rule.linePattern === undefined) {
      addDiagnostic(fatal, {
        path: base,
        code: 'missing-rule-pattern',
        message: `${base} must define pathPattern, linePattern, or both.`,
        value: rule,
        expected: 'rule object with at least one pattern'
      });
    }

    if (!Number.isInteger(rule.weight) || rule.weight < 0 || rule.weight > 10) {
      addDiagnostic(fatal, {
        path: `${base}.weight`,
        code: 'invalid-weight',
        message: `${base}.weight must be an integer from 0 to 10.`,
        value: rule.weight,
        expected: 'integer 0..10'
      });
    }
    const check = requireString(rule.check, `${base}.check`, fatal);
    rules.push({ id, label, pathPattern, linePattern, weight: rule.weight, check });
  }

  return rules;
}

function validateRequiredChecks(value, fatal, warnings) {
  const entries = requireArray(value, '$.requiredChecks', fatal);
  const ids = new Set();
  const commands = new Set();
  const checks = [];

  for (const [index, check] of entries.entries()) {
    const base = `$.requiredChecks[${index}]`;
    if (!requireObject(check, base, fatal)) continue;
    warnUnknownFields(check, new Set(['id', 'command', 'reason']), base, warnings);

    const id = validateId(check.id, `${base}.id`, fatal);
    duplicateId(id, `${base}.id`, ids, fatal);
    const command = requireString(check.command, `${base}.command`, fatal);
    const reason = requireString(check.reason, `${base}.reason`, fatal);

    if (command && commands.has(command)) {
      addDiagnostic(warnings, {
        severity: 'warning',
        path: `${base}.command`,
        code: 'duplicate-command',
        message: `The required command "${command}" is declared more than once.`,
        value: command,
        expected: 'unique required command'
      });
    }
    if (command) commands.add(command);
    checks.push({ id, command, reason });
  }

  return { checks, ids };
}

function validateStringArray(value, path, fatal) {
  if (value === undefined) return [];
  const entries = requireArray(value, path, fatal);
  const result = [];
  for (const [index, item] of entries.entries()) {
    const normalized = requireString(item, `${path}[${index}]`, fatal);
    if (normalized && !result.includes(normalized)) result.push(normalized);
  }
  return result;
}

function validateProtectedPaths(value, fatal, warnings, requiredCheckIds) {
  const entries = requireArray(value, '$.protectedPaths', fatal);
  const ids = new Set();
  const paths = [];

  for (const [index, protectedPath] of entries.entries()) {
    const base = `$.protectedPaths[${index}]`;
    if (!requireObject(protectedPath, base, fatal)) continue;
    warnUnknownFields(protectedPath, new Set(['id', 'pattern', 'reason', 'requiredCheckIds']), base, warnings);

    const id = validateId(protectedPath.id, `${base}.id`, fatal);
    duplicateId(id, `${base}.id`, ids, fatal);
    const pattern = validatePattern(protectedPath.pattern, `${base}.pattern`, fatal);
    const reason = requireString(protectedPath.reason, `${base}.reason`, fatal);
    const checkIds = validateStringArray(protectedPath.requiredCheckIds, `${base}.requiredCheckIds`, fatal);
    for (const [checkIndex, checkId] of checkIds.entries()) {
      if (!requiredCheckIds.has(checkId)) {
        addDiagnostic(fatal, {
          path: `${base}.requiredCheckIds[${checkIndex}]`,
          code: 'unknown-required-check',
          message: `${base} references required check "${checkId}", which is not declared.`,
          value: checkId,
          expected: 'id from $.requiredChecks'
        });
      }
    }
    paths.push({ id, pattern, reason, requiredCheckIds: checkIds });
  }

  return paths;
}

export function validatePolicyPack(value, runtimeOptions = {}) {
  const fatal = [];
  const warnings = [];
  const runtime = {
    mergeGuardVersion: runtimeOptions.mergeGuardVersion ?? MERGE_GUARD_VERSION,
    reportSchemaVersion: runtimeOptions.reportSchemaVersion ?? REPORT_SCHEMA_VERSION
  };

  if (!isObject(value)) {
    addDiagnostic(fatal, {
      path: '$',
      code: 'invalid-policy-pack',
      message: 'A policy pack must contain a JSON object.',
      value,
      expected: 'policy-pack object'
    });
    return { valid: false, policy: null, fatal, warnings };
  }

  warnUnknownFields(value, TOP_LEVEL_FIELDS, '$', warnings);
  const schemaVersion = validateSchemaVersion(value.schemaVersion, fatal);
  const identity = validateIdentity(value.identity, fatal, warnings);
  const compatibility = validateCompatibility(value.compatibility, fatal, warnings, runtime);
  const rules = validateRules(value.rules, fatal, warnings);
  const requiredCheckResult = validateRequiredChecks(value.requiredChecks, fatal, warnings);
  const protectedPaths = validateProtectedPaths(
    value.protectedPaths,
    fatal,
    warnings,
    requiredCheckResult.ids
  );

  if (!rules.length && !protectedPaths.length && !requiredCheckResult.checks.length) {
    addDiagnostic(warnings, {
      severity: 'warning',
      path: '$',
      code: 'empty-policy-pack',
      message: 'The policy pack declares no rules, protected paths, or required checks.',
      value,
      expected: 'at least one policy behavior'
    });
  }

  const valid = fatal.length === 0;
  return {
    valid,
    policy: valid
      ? {
          schemaVersion,
          identity,
          compatibility,
          rules,
          protectedPaths,
          requiredChecks: requiredCheckResult.checks
        }
      : null,
    fatal,
    warnings
  };
}

export function formatPolicyDiagnostics(diagnostics) {
  if (!Array.isArray(diagnostics) || !diagnostics.length) return '';
  return diagnostics.map((item) =>
    `- [${item.severity.toUpperCase()}] ${item.path}: ${item.message}`
      + (item.guidance ? ` Guidance: ${item.guidance}` : '')
  ).join('\n');
}
