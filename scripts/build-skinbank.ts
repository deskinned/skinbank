//! Compiles adapter YAML + theme .skin files → JSON bundles + manifest for skinbank.gitsk.in

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import yaml from 'js-yaml';

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist', 'v1');

mkdirSync(join(DIST, 'adapters'), { recursive: true });
mkdirSync(join(DIST, 'themes'), { recursive: true });

const componentsDir = join(ROOT, 'adapters', 'components');
const variantsDir = join(ROOT, 'adapters', 'variants');
const themesDir = join(ROOT, 'themes');

const adapters: Record<string, unknown> = {};

if (existsSync(componentsDir)) {
  for (const file of readdirSync(componentsDir).filter((f) => f.endsWith('.yaml'))) {
    const content = yaml.load(readFileSync(join(componentsDir, file), 'utf8'));
    const name = basename(file, '.yaml');
    adapters[name] = content;
    writeFileSync(join(DIST, 'adapters', `${name}.json`), JSON.stringify(content, null, 2));
  }
}

if (existsSync(variantsDir)) {
  for (const file of readdirSync(variantsDir).filter((f) => f.endsWith('.yaml'))) {
    const content = yaml.load(readFileSync(join(variantsDir, file), 'utf8'));
    const name = basename(file, '.yaml');
    writeFileSync(join(DIST, 'adapters', `variant-${name}.json`), JSON.stringify(content, null, 2));
  }
}

const primerMapPath = join(ROOT, 'adapters', 'primer-map.yaml');
if (existsSync(primerMapPath)) {
  const primerMap = yaml.load(readFileSync(primerMapPath, 'utf8'));
  writeFileSync(join(DIST, 'adapters', 'primer-map.json'), JSON.stringify(primerMap, null, 2));
}

const themeSchemaPath = join(themesDir, 'schema.yaml');
if (existsSync(themeSchemaPath)) {
  const schema = yaml.load(readFileSync(themeSchemaPath, 'utf8'));
  writeFileSync(join(DIST, 'theme-schema.json'), JSON.stringify(schema, null, 2));
}

const catalog: { themes: unknown[]; updated: string } = {
  themes: [],
  updated: new Date().toISOString(),
};

if (existsSync(themesDir)) {
  for (const dir of readdirSync(themesDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const skinPath = join(themesDir, dir.name, 'theme.skin');
    if (!existsSync(skinPath)) continue;
    const theme = yaml.load(readFileSync(skinPath, 'utf8')) as Record<string, unknown>;
    const meta = theme.meta as Record<string, unknown>;
    catalog.themes.push({ id: dir.name, ...meta });
    writeFileSync(join(DIST, 'themes', `${dir.name}.json`), JSON.stringify(theme, null, 2));
  }
}

writeFileSync(join(DIST, 'catalog.json'), JSON.stringify(catalog, null, 2));

const manifest = {
  version: 1,
  adapters: Object.keys(adapters),
  themes: catalog.themes.map((t) => (t as Record<string, unknown>).id),
  built: new Date().toISOString(),
};
writeFileSync(join(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2));

const cnamePath = join(ROOT, 'static', 'CNAME');
if (existsSync(cnamePath)) {
  copyFileSync(cnamePath, join(ROOT, 'dist', 'CNAME'));
}

console.log(`Built skinbank: ${Object.keys(adapters).length} adapters, ${catalog.themes.length} themes`);
