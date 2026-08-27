export const SAFE_REGEX_MAX_LENGTH = 500;
const MAX_OPTIONAL_QUANTIFIERS = 8;

export class UnsafeRegexError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'UnsafeRegexError';
    this.code = code;
  }
}

export function validateSafeRegexSource(source) {
  if (typeof source !== 'string' || !source.trim()) {
    throw new UnsafeRegexError('invalid-pattern', 'pattern must be a non-empty string');
  }
  if (source.length > SAFE_REGEX_MAX_LENGTH) {
    throw new UnsafeRegexError(
      'pattern-too-long',
      `pattern exceeds ${SAFE_REGEX_MAX_LENGTH} characters`
    );
  }

  let escaped = false;
  let inCharacterClass = false;
  let wildcardCount = 0;
  let optionalCount = 0;
  let topLevelAlternation = false;
  let groupDepth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (escaped) {
      if (!inCharacterClass && /[1-9]/.test(character)) {
        throw new UnsafeRegexError('unsafe-pattern', 'backreferences are not supported');
      }
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (inCharacterClass) {
      if (character === ']') inCharacterClass = false;
      continue;
    }
    if (character === '[') {
      inCharacterClass = true;
      continue;
    }
    if (character === '(') groupDepth += 1;
    if (character === ')') groupDepth = Math.max(0, groupDepth - 1);
    if (character === '|' && groupDepth === 0) topLevelAlternation = true;
    if (character === '(' && source[index + 1] === '?') {
      throw new UnsafeRegexError('unsafe-pattern', 'lookarounds and extended groups are not supported');
    }
    if (character === '+' || character === '{') {
      throw new UnsafeRegexError('unsafe-pattern', 'unbounded and counted repetition are not supported');
    }
    if (character === '*') {
      if (source[index - 1] !== '.' || wildcardCount > 0) {
        throw new UnsafeRegexError(
          'unsafe-pattern',
          'only one unrestricted .* wildcard is supported'
        );
      }
      wildcardCount += 1;
    }
    if (character === '?') {
      optionalCount += 1;
      if (optionalCount > MAX_OPTIONAL_QUANTIFIERS) {
        throw new UnsafeRegexError(
          'unsafe-pattern',
          `patterns may contain at most ${MAX_OPTIONAL_QUANTIFIERS} optional quantifiers`
        );
      }
    }
  }

  if (wildcardCount && source !== '.*' && (!source.startsWith('^') || topLevelAlternation)) {
    throw new UnsafeRegexError(
      'unsafe-pattern',
      '.* must be anchored at the start of the complete expression'
    );
  }

  try {
    new RegExp(source, 'i');
  } catch (error) {
    throw new UnsafeRegexError('invalid-pattern', error.message);
  }

  return source;
}

export function compileSafeRegex(source, flags = 'i') {
  validateSafeRegexSource(source);
  return new RegExp(source, flags);
}
