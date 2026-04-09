//! Tests for schema validation logic

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import Ajv, { type ValidateFunction } from 'ajv';

const ROOT = join(import.meta.dirname, '..', '..');

function loadSchema(path: string): Record<string, unknown> {
  return yaml.load(readFileSync(join(ROOT, path), 'utf8')) as Record<string, unknown>;
}

function compileSchema(path: string): ValidateFunction {
  const ajv = new Ajv({ allErrors: true });
  return ajv.compile(loadSchema(path));
}

describe('theme schema validation', () => {
  const validate = compileSchema('themes/schema.yaml');

  it('accepts a valid theme', () => {
    const theme = {
      meta: { name: 'test-theme', author: 'test', version: '1.0.0', description: 'A test' },
      tokens: { 'canvas.default': '#000000' },
    };
    expect(validate(theme)).toBe(true);
  });

  it('accepts a Level 2 theme with components', () => {
    const theme = {
      meta: {
        name: 'level-two',
        author: 'test',
        version: '1.0.0',
        description: 'Level 2',
        level: 2,
      },
      tokens: { 'canvas.default': '#000' },
      components: { RepoHeader: { tokens: { 'border.default': '#111' } } },
    };
    expect(validate(theme)).toBe(true);
  });

  it('rejects theme missing meta.name', () => {
    const theme = {
      meta: { author: 'test', version: '1.0.0', description: 'No name' },
      tokens: {},
    };
    expect(validate(theme)).toBe(false);
  });

  it('rejects theme with invalid name pattern', () => {
    const theme = {
      meta: { name: 'UPPER_CASE', author: 'test', version: '1.0.0', description: 'Bad name' },
      tokens: {},
    };
    expect(validate(theme)).toBe(false);
  });

  it('rejects theme with invalid version format', () => {
    const theme = {
      meta: { name: 'test', author: 'test', version: 'v1', description: 'Bad version' },
      tokens: {},
    };
    expect(validate(theme)).toBe(false);
  });

  it('rejects theme with level > 4', () => {
    const theme = {
      meta: { name: 'test', author: 'test', version: '1.0.0', description: 'Bad level', level: 5 },
      tokens: {},
    };
    expect(validate(theme)).toBe(false);
  });

  it('rejects theme missing tokens', () => {
    const theme = {
      meta: { name: 'test', author: 'test', version: '1.0.0', description: 'No tokens' },
    };
    expect(validate(theme)).toBe(false);
  });

  it('validates the obsidian theme file', () => {
    const theme = yaml.load(readFileSync(join(ROOT, 'themes/obsidian/theme.skin'), 'utf8'));
    expect(validate(theme)).toBe(true);
  });
});

describe('adapter schema validation', () => {
  const validate = compileSchema('adapters/schema.yaml');

  it('accepts a valid adapter', () => {
    const adapter = {
      page: 'test',
      components: {
        TestComponent: {
          description: 'A test component',
          strategies: [{ type: 'aria', selector: '[role="banner"]', confidence: 0.9 }],
        },
      },
    };
    expect(validate(adapter)).toBe(true);
  });

  it('rejects adapter missing page field', () => {
    const adapter = {
      components: {
        Test: {
          description: 'test',
          strategies: [{ type: 'aria', selector: 'x', confidence: 0.5 }],
        },
      },
    };
    expect(validate(adapter)).toBe(false);
  });

  it('rejects adapter with invalid strategy type', () => {
    const adapter = {
      page: 'test',
      components: {
        Test: {
          description: 'test',
          strategies: [{ type: 'invalid', selector: 'x', confidence: 0.5 }],
        },
      },
    };
    expect(validate(adapter)).toBe(false);
  });

  it('rejects confidence > 1', () => {
    const adapter = {
      page: 'test',
      components: {
        Test: {
          description: 'test',
          strategies: [{ type: 'aria', selector: 'x', confidence: 1.5 }],
        },
      },
    };
    expect(validate(adapter)).toBe(false);
  });

  it('validates all shipped adapter files', () => {
    const components = ['global', 'repository', 'pull-request', 'issues', 'actions', 'profile'];
    for (const name of components) {
      const data = yaml.load(readFileSync(join(ROOT, `adapters/components/${name}.yaml`), 'utf8'));
      expect(validate(data), `${name}.yaml should be valid`).toBe(true);
    }
  });
});

describe('primer-map validation', () => {
  it('all values start with --', () => {
    const map = yaml.load(readFileSync(join(ROOT, 'adapters/primer-map.yaml'), 'utf8')) as Record<
      string,
      string
    >;
    for (const [key, value] of Object.entries(map)) {
      expect(value, `${key} should map to a CSS custom property`).toMatch(/^--/);
    }
  });
});
