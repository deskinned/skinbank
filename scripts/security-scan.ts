//! Static CSS security scanner — checks customCSS and component css blocks for attack patterns

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const ROOT = join(import.meta.dirname, '..');

const args = process.argv.slice(2);
const singleTheme = args.includes('--theme') ? args[args.indexOf('--theme') + 1] : null;

const ALLOWED_URL_DOMAINS = [
  'data:',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'gitsk.in',
  'skinbank.gitsk.in',
];

type Severity = 'BLOCK' | 'FLAG';

interface Finding {
  severity: Severity;
  pattern: string;
  line: number;
  context: string;
}

function selectorDepth(css: string): number {
  let maxDepth = 0;
  const selectorRegex = /^[^{@]+(?=\{)/gm;
  let match: RegExpExecArray | null;
  while ((match = selectorRegex.exec(css)) !== null) {
    const parts = match[0].split(/\s+/).filter((s) => s.length > 0);
    if (parts.length > maxDepth) maxDepth = parts.length;
  }
  return maxDepth;
}

function checkLine(line: string, lineNum: number, findings: Finding[]): void {
  if (/@import/i.test(line)) {
    findings.push({ severity: 'BLOCK', pattern: '@import', line: lineNum, context: line.trim() });
  }

  if (/expression\s*\(/i.test(line)) {
    findings.push({
      severity: 'BLOCK',
      pattern: 'expression()',
      line: lineNum,
      context: line.trim(),
    });
  }

  if (/-moz-binding/i.test(line)) {
    findings.push({
      severity: 'BLOCK',
      pattern: '-moz-binding',
      line: lineNum,
      context: line.trim(),
    });
  }

  if (/behavior\s*:/i.test(line)) {
    findings.push({ severity: 'BLOCK', pattern: 'behavior:', line: lineNum, context: line.trim() });
  }

  const urlMatches = [...line.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)];
  for (const urlMatch of urlMatches) {
    const url = urlMatch[1] ?? '';
    const isAllowed = ALLOWED_URL_DOMAINS.some(
      (domain) => url.startsWith(domain) || url.includes(`//${domain}`),
    );
    if (!isAllowed) {
      findings.push({
        severity: 'BLOCK',
        pattern: 'url() with non-allowlisted domain',
        line: lineNum,
        context: line.trim(),
      });
    }
  }

  if (/content\s*:\s*attr\s*\(/i.test(line)) {
    findings.push({
      severity: 'FLAG',
      pattern: 'content: attr() — potential data leaking',
      line: lineNum,
      context: line.trim(),
    });
  }

  if (/:has\s*\(.*(?:input|textarea|form|\[type=['"]?password['"]?\])/i.test(line)) {
    findings.push({
      severity: 'BLOCK',
      pattern: ':has() targeting input/form elements — CSS keylogger risk',
      line: lineNum,
      context: line.trim(),
    });
  }
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    '\n'.repeat((match.match(/\n/g) ?? []).length),
  );
}

function scanCSS(rawCSS: string): Finding[] {
  const findings: Finding[] = [];
  const css = stripComments(rawCSS);
  const lines = css.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined) checkLine(line, i + 1, findings);
  }

  // Check position + z-index combo across the full CSS
  const positionBlocks = css.matchAll(
    /position\s*:\s*(?:fixed|absolute)[^}]*z-index\s*:\s*(\d+)/gi,
  );
  for (const match of positionBlocks) {
    if (parseInt(match[1] ?? '0', 10) > 9999) {
      findings.push({
        severity: 'FLAG',
        pattern: 'position: fixed/absolute with z-index > 9999 — UI spoofing risk',
        line: 0,
        context: match[0].trim(),
      });
    }
  }

  const depth = selectorDepth(css);
  if (depth > 10) {
    findings.push({
      severity: 'FLAG',
      pattern: `Selector depth ${String(depth)} > 10 — performance DoS risk`,
      line: 0,
      context: '',
    });
  }

  return findings;
}

interface ThemeData {
  customCSS?: string;
  components?: Record<string, { css?: string }>;
}

function extractCSS(theme: ThemeData): string[] {
  const blocks: string[] = [];
  if (theme.customCSS) blocks.push(theme.customCSS);
  if (theme.components) {
    for (const comp of Object.values(theme.components)) {
      if (comp.css) blocks.push(comp.css);
    }
  }
  return blocks;
}

function scanTheme(path: string, label: string): { label: string; findings: Finding[] } {
  const theme = yaml.load(readFileSync(path, 'utf8')) as ThemeData;
  const cssBlocks = extractCSS(theme);
  const findings: Finding[] = [];
  for (const css of cssBlocks) {
    findings.push(...scanCSS(css));
  }
  return { label, findings };
}

const results: { label: string; findings: Finding[] }[] = [];

if (singleTheme) {
  results.push(scanTheme(singleTheme, singleTheme));
} else {
  const themesDir = join(ROOT, 'themes');
  if (existsSync(themesDir)) {
    for (const dir of readdirSync(themesDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const skinPath = join(themesDir, dir.name, 'theme.skin');
      if (!existsSync(skinPath)) continue;
      results.push(scanTheme(skinPath, `themes/${dir.name}/theme.skin`));
    }
  }
}

let hasBlocks = false;

for (const { label, findings } of results) {
  if (findings.length === 0) {
    console.log(`  ✓ ${label} — clean`);
    continue;
  }

  const blocks = findings.filter((f) => f.severity === 'BLOCK');
  const flags = findings.filter((f) => f.severity === 'FLAG');

  if (blocks.length > 0) hasBlocks = true;

  console.log(
    `  ${blocks.length > 0 ? '✗' : '⚠'} ${label} — ${String(blocks.length)} blocked, ${String(flags.length)} warnings`,
  );
  for (const f of findings) {
    const prefix = f.severity === 'BLOCK' ? 'BLOCKED' : 'WARNING';
    const loc = f.line > 0 ? ` (line ${String(f.line)})` : '';
    console.log(`    ${prefix}: ${f.pattern}${loc}`);
    if (f.context) console.log(`      ${f.context}`);
  }
}

if (results.length === 0) {
  console.log('No themes to scan');
}

console.log(
  `\n${String(results.length)} themes scanned, ${String(results.filter((r) => r.findings.some((f) => f.severity === 'BLOCK')).length)} blocked`,
);
process.exit(hasBlocks ? 1 : 0);
