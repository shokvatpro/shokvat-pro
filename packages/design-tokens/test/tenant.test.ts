import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast } from '../src/color.ts';
import { resolveTenantBranding, validateTenantBranding, tenantCssVariables } from '../src/tenant.ts';
import { flatten, resolveValue } from '../src/tokens.ts';

const base = { displayNameAr: 'مجمع الواحة — تجريبي', displayNameEn: 'Oasis Medical (demo)' };

test('accepts a valid tenant branding', () => {
  assert.deepEqual(validateTenantBranding({ ...base, accentColor: '#7A2E8E', subdomain: 'oasis-demo' }), []);
});

test('rejects keys outside the allow-list (tenants cannot touch platform or status colours)', () => {
  const issues = validateTenantBranding({ ...base, dangerColor: '#00FF00', fontFamily: 'Comic Sans' });
  assert.deepEqual(issues.map((i) => [i.field, i.code]), [['dangerColor', 'not_allowed'], ['fontFamily', 'not_allowed']]);
});

test('rejects reserved or malformed subdomains', () => {
  assert.equal(validateTenantBranding({ ...base, subdomain: 'admin' })[0]?.code, 'reserved');
  assert.equal(validateTenantBranding({ ...base, subdomain: 'Bad_Name' })[0]?.code, 'invalid_format');
});

test('rejects path traversal in logo keys', () => {
  assert.equal(validateTenantBranding({ ...base, logoLightKey: '../other-tenant/logo.png' })[0]?.code, 'invalid_key');
});

test('rejects invalid hex', () => {
  assert.equal(validateTenantBranding({ ...base, accentColor: 'purple' })[0]?.code, 'invalid_hex');
});

test('keeps an accessible accent unchanged in light theme', () => {
  const r = resolveTenantBranding({ ...base, accentColor: '#7A2E8E' });
  assert.equal(r.accent, '#7A2E8E');
});

test('auto-corrects a low-contrast accent (yellow) so white text stays readable', () => {
  const r = resolveTenantBranding({ ...base, accentColor: '#FFD400' });
  assert.ok(r.accentAdjusted);
  assert.ok(r.accent && contrast(r.accent, '#FFFFFF') >= 4.5, `got ${r.accent}`);
});

test('derives a dark-theme accent readable on the dark surface', () => {
  const r = resolveTenantBranding({ ...base, accentColor: '#0B2A55' });
  assert.ok(r.accentOnDark && contrast(r.accentOnDark, '#0D1A2E') >= 4.5, `got ${r.accentOnDark}`);
});

test('tenant CSS only sets tenant variables, never platform ones', () => {
  const css = tenantCssVariables(resolveTenantBranding({ ...base, accentColor: '#7A2E8E' }));
  const declared = [...css.matchAll(/(--[\w-]+):/g)].map((m) => m[1]);
  assert.ok(declared.length > 0);
  for (const name of declared) assert.match(name!, /^--sp-(on-)?tenant-accent$/);
});

test('token references resolve and unknown references fail loudly', () => {
  const table = flatten({ color: { a: { $value: '#111111' }, b: { $value: '{color.a}' } } });
  assert.equal(resolveValue('{color.b}', table), '#111111');
  assert.throws(() => resolveValue('{color.missing}', table), /Unknown token reference/);
});

test('circular references are detected', () => {
  const table = flatten({ x: { $value: '{y}' }, y: { $value: '{x}' } });
  assert.throws(() => resolveValue('{x}', table), /Circular/);
});
