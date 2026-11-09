import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast } from '../src/color.ts';
import { loadTheme, type ThemeName } from '../src/tokens.ts';

/**
 * Every pair here is a real foreground/background combination used in the UI.
 * If someone changes a colour in tokens/*.json and breaks readability, this test fails.
 */
const TEXT_PAIRS: Array<[fg: string, bg: string]> = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'],
  ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'],
  ['brand', 'surface'], ['brand', 'bg'],
  ['primary', 'surface'], ['primary', 'bg'],
  ['on-primary', 'primary'], ['on-primary', 'primary-hover'],
  ['on-accent', 'accent'],
  ['success-text', 'success-soft'], ['warning-text', 'warning-soft'],
  ['danger-text', 'danger-soft'], ['info-text', 'info-soft'], ['neutral-text', 'neutral-soft'],
  ['danger-text', 'surface'],
  ['sidebar-text', 'sidebar'], ['sidebar-text', 'sidebar-active'],
];

/** Non-text UI (focus rings, solid status dots, strong borders) needs 3:1. */
const UI_PAIRS: Array<[fg: string, bg: string]> = [
  ['focus', 'surface'], ['focus', 'bg'],
  ['success', 'surface'], ['warning', 'surface'], ['danger', 'surface'], ['accent', 'surface'],
];

for (const theme of ['light', 'dark'] as ThemeName[]) {
  const t = loadTheme(theme);
  for (const [fg, bg] of TEXT_PAIRS) {
    test(`${theme}: ${fg} on ${bg} ≥ 4.5:1`, () => {
      const ratio = contrast(t[fg]!, t[bg]!);
      assert.ok(ratio >= 4.5, `${t[fg]} on ${t[bg]} = ${ratio.toFixed(2)}:1`);
    });
  }
  for (const [fg, bg] of UI_PAIRS) {
    test(`${theme}: ${fg} on ${bg} ≥ 3:1 (non-text)`, () => {
      const ratio = contrast(t[fg]!, t[bg]!);
      assert.ok(ratio >= 3, `${t[fg]} on ${t[bg]} = ${ratio.toFixed(2)}:1`);
    });
  }
}

test('contrast(): known WCAG values', () => {
  assert.equal(contrast('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(contrast('#FFFFFF', '#FFFFFF').toFixed(1), '1.0');
});

test('logo navy is the brand colour in light theme', () => {
  assert.equal(loadTheme('light').brand, '#071E3F');
});
