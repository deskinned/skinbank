//! Tests for the skinbank build pipeline

import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..', '..');
const DIST = join(ROOT, 'dist', 'v1');

beforeAll(() => {
  execFileSync('npx', ['tsx', 'scripts/build-skinbank.ts'], { cwd: ROOT, encoding: 'utf8' });
});

function readJSON(path: string): unknown {
  return JSON.parse(readFileSync(join(DIST, path), 'utf8'));
}

describe('build output', () => {
  it('creates manifest.json', () => {
    expect(existsSync(join(DIST, 'manifest.json'))).toBe(true);
  });

  it('creates catalog.json', () => {
    expect(existsSync(join(DIST, 'catalog.json'))).toBe(true);
  });

  it('creates theme-schema.json', () => {
    expect(existsSync(join(DIST, 'theme-schema.json'))).toBe(true);
  });

  it('creates adapter JSON files', () => {
    const adapters = ['global', 'repository', 'pull-request', 'issues', 'actions', 'profile'];
    for (const name of adapters) {
      expect(existsSync(join(DIST, 'adapters', `${name}.json`)), `${name}.json missing`).toBe(true);
    }
  });

  it('creates primer-map.json', () => {
    expect(existsSync(join(DIST, 'adapters', 'primer-map.json'))).toBe(true);
  });

  it('creates variant JSON files', () => {
    expect(existsSync(join(DIST, 'adapters', 'variant-default.json'))).toBe(true);
    expect(existsSync(join(DIST, 'adapters', 'variant-react-app.json'))).toBe(true);
  });

  it('copies CNAME to dist root', () => {
    expect(existsSync(join(ROOT, 'dist', 'CNAME'))).toBe(true);
  });
});

describe('manifest', () => {
  it('lists all adapters', () => {
    const manifest = readJSON('manifest.json') as { adapters: string[] };
    expect(manifest.adapters).toContain('global');
    expect(manifest.adapters).toContain('repository');
    expect(manifest.adapters.length).toBe(6);
  });

  it('has version 1', () => {
    const manifest = readJSON('manifest.json') as { version: number };
    expect(manifest.version).toBe(1);
  });

  it('includes built timestamp', () => {
    const manifest = readJSON('manifest.json') as { built: string };
    expect(manifest.built).toBeTruthy();
    expect(new Date(manifest.built).getTime()).not.toBeNaN();
  });
});

describe('catalog', () => {
  it('includes the obsidian theme', () => {
    const catalog = readJSON('catalog.json') as { themes: Array<{ id: string }> };
    expect(catalog.themes.some((t) => t.id === 'obsidian')).toBe(true);
  });

  it('includes theme metadata', () => {
    const catalog = readJSON('catalog.json') as {
      themes: Array<{ id: string; name: string; author: string; version: string }>;
    };
    const obsidian = catalog.themes.find((t) => t.id === 'obsidian');
    expect(obsidian?.name).toBe('obsidian');
    expect(obsidian?.author).toBe('deskinned');
    expect(obsidian?.version).toBe('1.0.0');
  });
});

describe('adapter content', () => {
  it('global adapter has correct page field', () => {
    const global = readJSON('adapters/global.json') as { page: string };
    expect(global.page).toBe('global');
  });

  it('adapter components have strategies', () => {
    const repo = readJSON('adapters/repository.json') as {
      components: Record<string, { strategies: unknown[] }>;
    };
    expect(Object.keys(repo.components).length).toBeGreaterThan(0);
    for (const comp of Object.values(repo.components)) {
      expect(comp.strategies.length).toBeGreaterThan(0);
    }
  });
});
