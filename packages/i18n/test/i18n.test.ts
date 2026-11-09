import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messages, flattenMessages, icuArguments, normalizeArabic, formatMoney, formatNumber, formatDateTime, dir } from '../src/index.ts';

const arFlat = flattenMessages(messages.ar);
const enFlat = flattenMessages(messages.en);

test('ar and en have exactly the same keys', () => {
  const a = Object.keys(arFlat).sort();
  const e = Object.keys(enFlat).sort();
  assert.deepEqual(a.filter((k) => !e.includes(k)), [], 'keys missing in en');
  assert.deepEqual(e.filter((k) => !a.includes(k)), [], 'keys missing in ar');
});

test('no empty translations', () => {
  for (const [k, v] of Object.entries({ ...arFlat })) assert.ok(v.trim().length > 0, `ar.${k} is empty`);
  for (const [k, v] of Object.entries({ ...enFlat })) assert.ok(v.trim().length > 0, `en.${k} is empty`);
});

test('ICU arguments match between ar and en for every key', () => {
  for (const key of Object.keys(arFlat)) {
    assert.deepEqual(icuArguments(arFlat[key]!), icuArguments(enFlat[key]!), `argument mismatch in ${key}`);
  }
});

test('Arabic plural messages define all six Arabic plural categories', () => {
  for (const [key, msg] of Object.entries(arFlat)) {
    if (!msg.includes('plural,')) continue;
    for (const cat of ['zero', 'one', 'two', 'few', 'many', 'other']) {
      assert.ok(new RegExp(`\\b${cat}\\s*\\{`).test(msg), `ar.${key} lacks plural category "${cat}"`);
    }
  }
});

test('Arabic copy does not contain Latin-only placeholders like TODO/lorem', () => {
  for (const [k, v] of Object.entries(arFlat)) assert.doesNotMatch(v, /TODO|lorem/i, k);
});

test('dir()', () => {
  assert.equal(dir('ar'), 'rtl');
  assert.equal(dir('en'), 'ltr');
});

test('normalizeArabic: hamza, taa marbuta, diacritics, tatweel, digits', () => {
  assert.equal(normalizeArabic('أحمد'), normalizeArabic('احمد'));
  assert.equal(normalizeArabic('إيمان'), 'ايمان');
  assert.equal(normalizeArabic('فاطمة'), normalizeArabic('فاطمه'));
  assert.equal(normalizeArabic('مُحَمَّد'), 'محمد');
  assert.equal(normalizeArabic('مـــرحبا'), 'مرحبا');
  assert.equal(normalizeArabic('مصطفى'), 'مصطفي');
  assert.equal(normalizeArabic('٠٥٥١٢٣'), '055123');
});

test('formatMoney uses minor units and 3 decimals for KWD/BHD/OMR', () => {
  assert.match(formatMoney(69900n, 'SAR', 'en'), /699\.00/);
  assert.match(formatMoney(12345, 'KWD', 'en'), /12\.345/);
  assert.throws(() => formatMoney(1, 'XYZ', 'en'), /Unsupported currency/);
});

test('Latin digits by default in Arabic, Arabic-Indic on request', () => {
  assert.match(formatNumber(1299, 'ar'), /1[,٬]?299/);
  assert.match(formatNumber(1299, 'ar', 'arab'), /١٬?٢٩٩/);
});

test('formatDateTime renders in the given time zone', () => {
  const d = new Date('2026-11-09T21:30:00Z'); // 00:30 next day in Riyadh
  const s = formatDateTime(d, 'en', 'Asia/Riyadh', 'latn', { day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  assert.match(s, /10/);
  assert.match(s, /00:30/);
});
