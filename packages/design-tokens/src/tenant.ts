import { adjustForContrast, contrast, isHex } from './color.ts';

/** Keys a medical center may customise. Mirrors tokens/tenant.schema.json. */
export type TenantBrandingInput = {
  displayNameAr: string;
  displayNameEn: string;
  accentColor?: string;
  logoLightKey?: string;
  logoDarkKey?: string;
  subdomain?: string;
  emailSenderName?: string;
};

export const TENANT_ALLOWED_KEYS = [
  'displayNameAr', 'displayNameEn', 'accentColor', 'logoLightKey', 'logoDarkKey', 'subdomain', 'emailSenderName',
] as const;

export const RESERVED_SUBDOMAINS = new Set([
  'app', 'api', 'www', 'admin', 'platform', 'control', 'status', 'mail', 'auth', 'login', 'billing', 'support', 'docs', 'static', 'cdn',
]);

const SUBDOMAIN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
const MIN_TEXT_CONTRAST = 4.5;

/** White text sits on the tenant accent (buttons, active nav) — so the accent must pass 4.5:1 with white. */
const LIGHT_SURFACE = '#FFFFFF';
/** In dark mode the accent is used as text/icon on the dark surface. */
const DARK_SURFACE = '#0D1A2E';

export type TenantIssue = { field: string; code: string };

export type ResolvedTenantBranding = {
  input: TenantBrandingInput;
  accent: string | null;          // used in light theme (white text on it)
  accentOnDark: string | null;    // used in dark theme (as text/icon on dark surface)
  accentAdjusted: boolean;        // true if we had to change the colour the tenant picked
  issues: TenantIssue[];
};

export function validateTenantBranding(raw: Record<string, unknown>): TenantIssue[] {
  const issues: TenantIssue[] = [];
  for (const key of Object.keys(raw)) {
    if (!(TENANT_ALLOWED_KEYS as readonly string[]).includes(key)) issues.push({ field: key, code: 'not_allowed' });
  }
  for (const key of ['displayNameAr', 'displayNameEn'] as const) {
    const v = raw[key];
    if (typeof v !== 'string' || v.trim().length < 2 || v.length > 60) issues.push({ field: key, code: 'invalid_length' });
  }
  if (raw.accentColor !== undefined && (typeof raw.accentColor !== 'string' || !isHex(raw.accentColor))) {
    issues.push({ field: 'accentColor', code: 'invalid_hex' });
  }
  if (raw.subdomain !== undefined) {
    const s = raw.subdomain;
    if (typeof s !== 'string' || !SUBDOMAIN.test(s)) issues.push({ field: 'subdomain', code: 'invalid_format' });
    else if (RESERVED_SUBDOMAINS.has(s)) issues.push({ field: 'subdomain', code: 'reserved' });
  }
  for (const key of ['logoLightKey', 'logoDarkKey'] as const) {
    const v = raw[key];
    if (v !== undefined && (typeof v !== 'string' || v.includes('..') || v.startsWith('/'))) issues.push({ field: key, code: 'invalid_key' });
  }
  return issues;
}

/**
 * Validates tenant input and derives accessible accent colours.
 * If the chosen colour fails contrast, the nearest passing shade is used instead (and flagged),
 * so a tenant can never make the interface unreadable.
 */
export function resolveTenantBranding(raw: Record<string, unknown>): ResolvedTenantBranding {
  const issues = validateTenantBranding(raw);
  const input = raw as TenantBrandingInput;
  const chosen = typeof input.accentColor === 'string' && isHex(input.accentColor) ? input.accentColor.toUpperCase() : null;
  if (!chosen || issues.some((i) => i.field === 'accentColor')) {
    return { input, accent: null, accentOnDark: null, accentAdjusted: false, issues };
  }
  const accent = adjustForContrast(chosen, LIGHT_SURFACE, MIN_TEXT_CONTRAST, '#000000');
  const accentOnDark = adjustForContrast(chosen, DARK_SURFACE, MIN_TEXT_CONTRAST, '#FFFFFF');
  return {
    input,
    accent,
    accentOnDark,
    accentAdjusted: accent !== chosen || accentOnDark !== chosen,
    issues,
  };
}

/** CSS custom properties for a tenant workspace. Unset values fall back to the platform primary. */
export function tenantCssVariables(b: ResolvedTenantBranding): string {
  if (!b.accent || !b.accentOnDark) return '';
  return [
    `[data-tenant] { --sp-tenant-accent: ${b.accent}; --sp-on-tenant-accent: #FFFFFF; }`,
    `.dark [data-tenant], [data-tenant].dark { --sp-tenant-accent: ${b.accentOnDark}; --sp-on-tenant-accent: ${contrast(b.accentOnDark, '#060E1C') >= MIN_TEXT_CONTRAST ? '#060E1C' : '#FFFFFF'}; }`,
  ].join('\n');
}
