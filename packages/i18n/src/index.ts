import ar from '../messages/ar.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };

export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ar';

export type Messages = typeof ar;
export const messages: Record<Locale, Messages> = { ar, en };

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

export function dir(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** Numerals preference (decision Q-09): Latin digits by default, Arabic-Indic optional per user. */
export type Numerals = 'latn' | 'arab';

function tag(locale: Locale, numerals: Numerals): string {
  return locale === 'ar' ? `ar-SA-u-nu-${numerals}` : `en-GB-u-nu-${numerals}`;
}

/** Minor units per ISO 4217 for supported markets. KWD/BHD/OMR use 3 decimals. */
export const CURRENCY_MINOR_UNITS: Record<string, number> = {
  SAR: 2, EGP: 2, AED: 2, QAR: 2, KWD: 3, BHD: 3, OMR: 3, USD: 2,
};

/** Formats an amount stored in minor units (never floats in storage). */
export function formatMoney(amountMinor: bigint | number, currency: string, locale: Locale, numerals: Numerals = 'latn'): string {
  const units = CURRENCY_MINOR_UNITS[currency];
  if (units === undefined) throw new Error(`Unsupported currency: ${currency}`);
  const value = Number(amountMinor) / 10 ** units;
  return new Intl.NumberFormat(tag(locale, numerals), {
    style: 'currency', currency, minimumFractionDigits: units, maximumFractionDigits: units,
  }).format(value);
}

export function formatNumber(value: number, locale: Locale, numerals: Numerals = 'latn'): string {
  return new Intl.NumberFormat(tag(locale, numerals)).format(value);
}

/** Times are stored in UTC and always rendered in an explicit IANA zone (branch or user). */
export function formatDateTime(date: Date, locale: Locale, timeZone: string, numerals: Numerals = 'latn', opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }): string {
  return new Intl.DateTimeFormat(tag(locale, numerals), { ...opts, timeZone }).format(date);
}

/**
 * Normalises Arabic text for search: strips diacritics and tatweel, unifies alef/yaa/taa-marbuta forms,
 * maps Arabic-Indic digits to Latin. Apply to both the stored search column and the query.
 */
export function normalizeArabic(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[ً-ٰٟۖ-ۭ]/g, '') // harakat & Quranic marks
    .replace(/ـ/g, '') // tatweel
    .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ → ا
    .replace(/ى/g, 'ي') // ى → ي
    .replace(/ة/g, 'ه') // ة → ه
    .replace(/ؤ/g, 'و') // ؤ → و
    .replace(/ئ/g, 'ي') // ئ → ي
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lists ICU argument names at the top level of a message, e.g. "{count, plural, …}" → ["count"]. */
export function icuArguments(message: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    const ch = message[i];
    if (ch === '{') {
      if (depth === 0) {
        const m = /^\{\s*([A-Za-z_][\w]*)\s*[,}]/.exec(message.slice(i));
        if (m?.[1]) names.add(m[1]);
      }
      depth++;
    } else if (ch === '}') depth--;
  }
  return [...names].sort();
}

/** Flattens nested messages to dotted keys. */
export function flattenMessages(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (v && typeof v === 'object') Object.assign(out, flattenMessages(v as Record<string, unknown>, key));
  }
  return out;
}
