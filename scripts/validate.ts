//! Validates adapter and theme files against their JSON Schemas

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv';

const ROOT = join(import.meta.dirname, '..');

const args = process.argv.slice(2);
const themesOnly = args.includes('--themes-only');
const adaptersOnly = args.includes('--adapters-only');
const singleTheme = args.includes('--theme') ? args[args.indexOf('--theme') + 1] : null;

interface ValidationResult {
  file: string;
  valid: boolean;
  errors: string[];
}

function loadYamlSchema(path: string): Record<string, unknown> {
  return yaml.load(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function compileSchema(schemaPath: string): ValidateFunction {
  const ajv = new Ajv({ allErrors: true });
  return ajv.compile(loadYamlSchema(schemaPath));
}

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((e) => `${e.instancePath} ${e.message ?? 'unknown error'}`);
}

function validateFiles(): ValidationResult[] {
  const results: ValidationResult[] = [];

  if (!adaptersOnly) {
    const validateTheme = compileSchema(join(ROOT, 'themes', 'schema.yaml'));

    if (singleTheme) {
      const data = yaml.load(readFileSync(singleTheme, 'utf8'));
      const valid = validateTheme(data);
      results.push({
        file: singleTheme,
        valid: valid,
        errors: valid ? [] : formatErrors(validateTheme.errors),
      });
    } else {
      const themesDir = join(ROOT, 'themes');
      if (existsSync(themesDir)) {
        for (const dir of readdirSync(themesDir, { withFileTypes: true })) {
          if (!dir.isDirectory()) continue;
          const skinPath = join(themesDir, dir.name, 'theme.skin');
          if (!existsSync(skinPath)) continue;
          const data = yaml.load(readFileSync(skinPath, 'utf8'));
          const valid = validateTheme(data);
          results.push({
            file: `themes/${dir.name}/theme.skin`,
            valid: valid,
            errors: valid ? [] : formatErrors(validateTheme.errors),
          });
        }
      }
    }
  }

  if (!themesOnly) {
    const validateAdapter = compileSchema(join(ROOT, 'adapters', 'schema.yaml'));

    const componentsDir = join(ROOT, 'adapters', 'components');
    if (existsSync(componentsDir)) {
      for (const file of readdirSync(componentsDir).filter((f) => f.endsWith('.yaml'))) {
        const data = yaml.load(readFileSync(join(componentsDir, file), 'utf8'));
        const valid = validateAdapter(data);
        results.push({
          file: `adapters/components/${file}`,
          valid: valid,
          errors: valid ? [] : formatErrors(validateAdapter.errors),
        });
      }
    }

    const primerMapPath = join(ROOT, 'adapters', 'primer-map.yaml');
    if (existsSync(primerMapPath)) {
      const primerMap = yaml.load(readFileSync(primerMapPath, 'utf8')) as Record<string, string>;
      const invalidTokens: string[] = [];
      for (const [key, value] of Object.entries(primerMap)) {
        if (typeof value !== 'string' || !value.startsWith('--')) {
          invalidTokens.push(`${key}: value must be a CSS custom property starting with --`);
        }
      }
      results.push({
        file: 'adapters/primer-map.yaml',
        valid: invalidTokens.length === 0,
        errors: invalidTokens,
      });
    }
  }

  return results;
}

const results = validateFiles();
let hasErrors = false;

for (const result of results) {
  if (result.valid) {
    console.log(`  ✓ ${result.file}`);
  } else {
    hasErrors = true;
    console.error(`  ✗ ${result.file}`);
    for (const err of result.errors) {
      console.error(`    → ${err}`);
    }
  }
}

const total = results.length;
const failed = results.filter((r) => !r.valid).length;
console.log(`\n${String(total)} files validated, ${String(failed)} failed`);
process.exit(hasErrors ? 1 : 0);
