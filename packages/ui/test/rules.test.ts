/**
 * Enforces the UI rules from CLAUDE.md on component source:
 *  - logical (RTL-safe) spacing/position only — no ml-/mr-/pl-/pr-/left-/right-/text-left/text-right
 *  - no raw hex colours in components (use semantic tokens)
 *  - no hard-coded user-facing strings in component markup (text must come from props / i18n)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = readdirSync(src, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile() && /\.tsx?$/.test(d.name))
  .map((d) => join(d.parentPath, d.name));

/** Physical-direction utilities (checked per class token, after stripping variants like `hover:`). */
const PHYSICAL = /^-?(?:m[lr]|p[lr]|left|right|border-[lr]|rounded-[lr]|rounded-[tb][lr]|scroll-[mp][lr]|text-left|text-right|float-left|float-right)(?:-|$)/;

for (const file of files) {
  const code = readFileSync(file, 'utf8');
  const classStrings = [...code.matchAll(/(['"`])((?:(?!\1).)*)\1/g)].map((m) => m[2] ?? '');
  const rel = file.slice(src.length + 1);

  test(`${rel}: no physical left/right utilities`, () => {
    const hits = classStrings
      .flatMap((s) => s.split(/\s+/))
      .filter((token) => {
        const parts = token.split(':');
        const utility = parts[parts.length - 1] ?? '';
        const scopedToDirection = parts.slice(0, -1).some((v) => v === 'rtl' || v === 'ltr');
        return !scopedToDirection && PHYSICAL.test(utility);
      });
    assert.deepEqual(hits, []);
  });

  test(`${rel}: no hex colours`, () => {
    assert.deepEqual(code.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [], []);
  });

  test(`${rel}: no hard-coded Arabic/English text between JSX tags`, () => {
    const text = [...code.matchAll(/>\s*([A-Za-z؀-ۿ][^<{}]*?)\s*</g)].map((m) => m[1]);
    assert.deepEqual(text, []);
  });
}
