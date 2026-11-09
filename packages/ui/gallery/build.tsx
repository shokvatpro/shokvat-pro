/**
 * Builds a static component gallery: every component in Arabic RTL + English LTR, light + dark,
 * plus a tenant-branded sample. Output: gallery/out/index.html (self-contained CSS).
 * Run: pnpm gallery
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compile } from 'tailwindcss';
import {
  Avatar, Badge, Button, Card, Checkbox, ConversationListItem, ConversationStatusPill, DemoDataBadge, EmptyState, IconButton, InboxIcon,
  KpiTile, MessageBubble, MoonIcon, PoweredBy, ProductMark, SearchIcon, SendIcon, SlaBanner, TenantIdentity, TextField, CalendarIcon,
  type ConversationStatus,
} from '../src/index.ts';
import { dir, messages, type Locale } from '../../i18n/src/index.ts';
import { resolveTenantBranding, tenantCssVariables } from '../../design-tokens/src/tenant.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
const repo = resolve(here, '../../..');
mkdirSync(out, { recursive: true });

/* ---------- tiny message formatter for the gallery (apps use next-intl / full ICU) ---------- */
function t(locale: Locale, key: string, vars: Record<string, string | number> = {}): string {
  const raw = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], messages[locale]);
  if (typeof raw !== 'string') throw new Error(`Missing message ${locale}:${key}`);
  const plural = /^(.*?)\{(\w+), plural,(.*)\}(.*)$/s.exec(raw);
  if (plural) {
    const [, before, arg, body, after] = plural as unknown as [string, string, string, string, string];
    const n = Number(vars[arg]);
    const cat = n === 0 && /zero\s*\{/.test(body) ? 'zero' : new Intl.PluralRules(locale).select(n);
    const branch = new RegExp(`${cat}\\s*\\{([^}]*)\\}`).exec(body)?.[1] ?? new RegExp('other\\s*\\{([^}]*)\\}').exec(body)?.[1] ?? '';
    return (before + branch.replace(/#/g, String(n)) + after).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  }
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

const DEMO = {
  ar: { contacts: ['سارة م.', 'عبدالله ر.', 'ليان خ.'], previews: ['أرغب بحجز موعد يوم الخميس مساءً', 'كم تكلفة الاستشارة الأولى؟', 'تمام، أراكم الساعة ٥'], tenant: 'مجمع الواحة — تجريبي', branch: 'فرع الخبر', agent: 'نورة' },
  en: { contacts: ['Sara M.', 'Abdullah R.', 'Layan K.'], previews: ['I would like to book Thursday evening', 'How much is the first consultation?', 'Great, see you at 5'], tenant: 'Oasis Medical (demo)', branch: 'Al Khobar branch', agent: 'Noura' },
} as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-caption font-semibold tracking-wide text-muted">{title}</h3>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

function Panel({ locale, theme }: { locale: Locale; theme: 'light' | 'dark' }) {
  const d = DEMO[locale];
  const ago = (min: number) => new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en', { style: 'narrow' }).format(-min, 'minute');
  const statuses: ConversationStatus[] = ['new', 'open', 'pending', 'waiting_customer', 'resolved', 'closed'];
  return (
    <div lang={locale} dir={dir(locale)} data-theme={theme} className={theme === 'dark' ? 'dark' : undefined}>
      <div className="flex flex-col gap-7 bg-bg p-6 text-text" data-tenant="">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <ProductMark logoLightSrc="mark-navy.png" logoDarkSrc="mark-white.png" companyName={t(locale, 'brand.company')} proLabel={t(locale, 'brand.pro')} height={28} />
          <span className="flex items-center gap-2">
            <DemoDataBadge label={t(locale, 'demo.badge')} notice={t(locale, 'demo.notice')} />
            <span className="text-caption text-muted">{locale.toUpperCase()} · {theme}</span>
          </span>
        </header>

        <Section title="Button">
          <Button>{t(locale, 'auth.signIn')}</Button>
          <Button variant="secondary">{t(locale, 'common.cancel')}</Button>
          <Button variant="ghost">{t(locale, 'common.viewAll')}</Button>
          <Button variant="tenant" icon={<CalendarIcon size={18} />}>{t(locale, 'inbox.createBooking')}</Button>
          <Button variant="danger">{t(locale, 'common.close')}</Button>
          <Button loading loadingLabel={t(locale, 'common.loading')}>{t(locale, 'common.save')}</Button>
          <Button disabled>{t(locale, 'common.save')}</Button>
          <IconButton label={t(locale, 'common.themeToggle')} icon={<MoonIcon />} />
          <IconButton label={t(locale, 'common.search')} icon={<SearchIcon />} variant="ghost" />
        </Section>

        <Section title="Field">
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField label={t(locale, 'auth.email')} type="email" placeholder="name@clinic.example" forceLtr />
            <TextField label={t(locale, 'auth.password')} type="password" defaultValue="placeholder" error={t(locale, 'errors.generic')} />
            <TextField label={t(locale, 'inbox.title')} placeholder={t(locale, 'inbox.searchPlaceholder')} hint={t(locale, 'common.optional')} />
          </div>
          <Checkbox label={t(locale, 'auth.rememberDevice')} />
        </Section>

        <Section title="Badge · conversation status">
          {statuses.map((s) => <ConversationStatusPill key={s} status={s} label={t(locale, `conversationStatus.${s}`)} />)}
          <Badge tone="critical">{t(locale, 'inbox.filterSlaBreached')}</Badge>
          <Badge tone="accent">{t(locale, 'brand.pro')}</Badge>
        </Section>

        <Section title="KPI">
          <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label={t(locale, 'kpi.inquiries')} value="48" />
            <KpiTile label={t(locale, 'kpi.firstResponse')} value="3:12" hint={t(locale, 'inbox.slaTarget', { minutes: 5 })} />
            <KpiTile label={t(locale, 'kpi.bookings')} value="17" tone="accent" />
            <KpiTile label={t(locale, 'kpi.missedCalls')} value="3" tone="danger" estimatedLabel={t(locale, 'kpi.estimated')} />
          </div>
        </Section>

        <Section title="Inbox">
          <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <Card className="overflow-hidden">
              <ConversationListItem href="#" selected contactName={d.contacts[0]} channelLabel={t(locale, 'channel.whatsapp')} timeLabel={ago(2)} preview={d.previews[0]} status="open" statusLabel={t(locale, 'conversationStatus.open')} slaBreachedLabel={t(locale, 'inbox.filterSlaBreached')} assigneeLabel={t(locale, 'common.unassigned')} />
              <ConversationListItem href="#" contactName={d.contacts[1]} channelLabel={t(locale, 'channel.instagram')} timeLabel={ago(6)} preview={d.previews[1]} status="open" statusLabel={t(locale, 'conversationStatus.open')} awaitingAgentLabel={t(locale, 'inbox.awaitingAgent')} assigneeLabel={d.agent} />
              <ConversationListItem href="#" contactName={d.contacts[2]} channelLabel={t(locale, 'channel.whatsapp')} timeLabel={ago(20)} preview={d.previews[2]} status="resolved" statusLabel={t(locale, 'conversationStatus.resolved')} assigneeLabel={d.agent} />
            </Card>
            <Card className="flex flex-col overflow-hidden">
              <SlaBanner>{t(locale, 'inbox.awaitingFor', { minutes: 6 })} — {t(locale, 'inbox.slaTarget', { minutes: 5 })}</SlaBanner>
              <div className="flex flex-col gap-3 p-4">
                <MessageBubble direction="inbound" lang="ar" meta="18:02">السلام عليكم، أرغب بحجز موعد يوم الخميس مساءً إن أمكن</MessageBubble>
                <MessageBubble direction="outbound" lang={locale} meta={`18:08 · ${d.agent}`}>{locale === 'ar' ? 'أهلًا بك! يتوفر الخميس الساعة ٥:٠٠ أو ٦:٣٠ مساءً.' : 'Welcome! Thursday has 5:00 PM and 6:30 PM available.'}</MessageBubble>
                <MessageBubble direction="system">{t(locale, 'demo.notice')}</MessageBubble>
              </div>
              <div className="flex items-center gap-2 border-t border-border p-3">
                <input aria-label={t(locale, 'inbox.replyPlaceholder')} placeholder={t(locale, 'inbox.replyPlaceholder')} className="h-touch min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-3.5 text-body text-text placeholder:text-muted" />
                <Button variant="tenant" icon={<SendIcon size={18} />}>{t(locale, 'inbox.send')}</Button>
              </div>
            </Card>
          </div>
        </Section>

        <Section title="Identity · empty state">
          <Card className="flex flex-col gap-4 p-4">
            <TenantIdentity name={d.tenant} subtitle={d.branch} />
            <span className="flex items-center gap-2"><Avatar name={d.contacts[0]} /><Avatar name={d.contacts[1]} size={32} /></span>
            <PoweredBy label={t(locale, 'brand.poweredBy')} />
          </Card>
          <Card className="min-w-72 flex-1"><EmptyState icon={<InboxIcon />} title={t(locale, 'inbox.empty')} description={t(locale, 'inbox.count', { count: 0 })} /></Card>
        </Section>
      </div>
    </div>
  );
}

const tenant = resolveTenantBranding({ displayNameAr: DEMO.ar.tenant, displayNameEn: DEMO.en.tenant, accentColor: '#7A2E8E' });

function Page() {
  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-8 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h1 text-brand">Shokfat Pro — UI gallery v0.1</h1>
        <p className="text-body text-muted">@shokfat/ui · tokens from @shokfat/design-tokens · strings from @shokfat/i18n · tenant accent #7A2E8E (demo)</p>
      </div>
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-border" id="ar-light"><Panel locale="ar" theme="light" /></div>
        <div className="overflow-hidden rounded-lg border border-border" id="ar-dark"><Panel locale="ar" theme="dark" /></div>
        <div className="overflow-hidden rounded-lg border border-border" id="en-light"><Panel locale="en" theme="light" /></div>
        <div className="overflow-hidden rounded-lg border border-border" id="en-dark"><Panel locale="en" theme="dark" /></div>
      </div>
    </main>
  );
}

/* ---------- Tailwind compile ---------- */
const require = createRequire(import.meta.url);
const twDir = dirname(require.resolve('tailwindcss/package.json'));
const tokensDist = resolve(here, '../../design-tokens/dist');
const inputCss = `
@import "tailwindcss";
@import "${join(tokensDist, 'tailwind-theme.css')}";
@import "${join(tokensDist, 'tokens.css')}";
@layer base {
  html { font-family: var(--sp-font-body); }
  body { background: var(--color-bg); color: var(--color-text); margin: 0; }
}
`;

async function buildCss(html: string): Promise<string> {
  const compiler = await compile(inputCss, {
    base: here,
    loadStylesheet: async (id: string, base: string) => {
      const path = id === 'tailwindcss' ? join(twDir, 'index.css') : resolve(base, id);
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    },
  });
  const candidates = new Set<string>();
  for (const m of html.matchAll(/class="([^"]*)"/g)) for (const c of (m[1] ?? '').split(/\s+/)) if (c) candidates.add(c.replace(/&amp;/g, '&'));
  return compiler.build([...candidates]);
}

const body = renderToStaticMarkup(<Page />);
const css = (await buildCss(body)) + '\n' + tenantCssVariables(tenant);
const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shokfat Pro — UI gallery</title>
<style>${css}</style>
</head>
<body>${body}</body>
</html>
`;
writeFileSync(join(out, 'index.html'), html);
for (const f of ['mark-navy.png', 'mark-white.png']) copyFileSync(join(repo, 'assets/brand', f), join(out, f));
console.log(`gallery: ${(html.length / 1024).toFixed(0)} KB → ${join(out, 'index.html')}`);
