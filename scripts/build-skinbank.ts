//! Compiles adapter YAML + theme .skin files → JSON bundles + manifest for skinbank.gitsk.in

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  copyFileSync,
} from 'node:fs';
import { join, basename } from 'node:path';
import yaml from 'js-yaml';

function loadYaml(filePath: string): unknown {
  return yaml.load(readFileSync(filePath, 'utf8'));
}

function yamlFiles(dir: string): string[] {
  return readdirSync(dir).filter((f: string) => f.endsWith('.yaml'));
}

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist', 'v1');

mkdirSync(join(DIST, 'adapters'), { recursive: true });
mkdirSync(join(DIST, 'themes'), { recursive: true });

const componentsDir = join(ROOT, 'adapters', 'components');
const variantsDir = join(ROOT, 'adapters', 'variants');
const themesDir = join(ROOT, 'themes');

const adapterNames: string[] = [];

if (existsSync(componentsDir)) {
  for (const file of yamlFiles(componentsDir)) {
    const content = loadYaml(join(componentsDir, file));
    const name = basename(file, '.yaml');
    adapterNames.push(name);
    writeFileSync(join(DIST, 'adapters', `${name}.json`), JSON.stringify(content, null, 2));
  }
}

if (existsSync(variantsDir)) {
  for (const file of yamlFiles(variantsDir)) {
    const content = loadYaml(join(variantsDir, file));
    const name = basename(file, '.yaml');
    writeFileSync(join(DIST, 'adapters', `variant-${name}.json`), JSON.stringify(content, null, 2));
  }
}

const primerMapPath = join(ROOT, 'adapters', 'primer-map.yaml');
if (existsSync(primerMapPath)) {
  const primerMap = loadYaml(primerMapPath);
  writeFileSync(join(DIST, 'adapters', 'primer-map.json'), JSON.stringify(primerMap, null, 2));
}

const themeSchemaPath = join(themesDir, 'schema.yaml');
if (existsSync(themeSchemaPath)) {
  const schema = loadYaml(themeSchemaPath);
  writeFileSync(join(DIST, 'theme-schema.json'), JSON.stringify(schema, null, 2));
}

interface ThemeMeta {
  id: string;
  name?: string;
  [key: string]: unknown;
}

const catalog: { themes: ThemeMeta[]; updated: string } = {
  themes: [],
  updated: new Date().toISOString(),
};

if (existsSync(themesDir)) {
  for (const dir of readdirSync(themesDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const skinPath = join(themesDir, dir.name, 'theme.skin');
    if (!existsSync(skinPath)) continue;
    const theme = loadYaml(skinPath) as Record<string, unknown>;
    const meta = theme['meta'] as Record<string, unknown> | undefined;
    catalog.themes.push({ id: dir.name, ...meta });
    writeFileSync(join(DIST, 'themes', `${dir.name}.json`), JSON.stringify(theme, null, 2));
  }
}

writeFileSync(join(DIST, 'catalog.json'), JSON.stringify(catalog, null, 2));

const manifest = {
  version: 1,
  adapters: adapterNames,
  themes: catalog.themes.map((t) => t.id),
  built: new Date().toISOString(),
};
writeFileSync(join(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2));

const cnamePath = join(ROOT, 'static', 'CNAME');
if (existsSync(cnamePath)) {
  copyFileSync(cnamePath, join(ROOT, 'dist', 'CNAME'));
}

console.log(
  `Built skinbank: ${String(adapterNames.length)} adapters, ${String(catalog.themes.length)} themes`,
);
