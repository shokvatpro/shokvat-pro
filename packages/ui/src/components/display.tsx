import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn.ts';

/* ---------- Badge / StatusPill ---------- */

export const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold whitespace-nowrap', {
  variants: {
    tone: {
      success: 'bg-success-soft text-success-text',
      warning: 'bg-warning-soft text-warning-text',
      danger: 'bg-danger-soft text-danger-text',
      info: 'bg-info-soft text-info-text',
      neutral: 'bg-neutral-soft text-neutral-text',
      accent: 'bg-accent text-on-accent',
      /** Strong alert (e.g. SLA breached): solid, never colour-only — always paired with text. */
      critical: 'bg-danger text-white dark:text-bg',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { icon?: ReactNode };

export function Badge({ tone, icon, className, children, ...rest }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...rest}>
      {icon}
      {children}
    </span>
  );
}

/** Semantic tone for each conversation status (labels come from i18n `conversationStatus.*`). */
export const CONVERSATION_STATUS_TONE = {
  new: 'info',
  open: 'info',
  pending: 'warning',
  waiting_customer: 'neutral',
  resolved: 'success',
  closed: 'neutral',
} as const satisfies Record<string, NonNullable<BadgeProps['tone']>>;

export type ConversationStatus = keyof typeof CONVERSATION_STATUS_TONE;

export function ConversationStatusPill({ status, label }: { status: ConversationStatus; label: string }) {
  return <Badge tone={CONVERSATION_STATUS_TONE[status]} data-status={status}>{label}</Badge>;
}

/* ---------- Card ---------- */

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-border bg-surface', className)} {...rest} />;
}

/* ---------- Avatar ---------- */

export function initialsOf(name: string): string {
  // Arabic letters join, so two initials read as a word ("سم"); use a single letter for Arabic script.
  if (/^[؀-ۿ]/.test(name.trim())) return name.trim()[0] ?? '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + second).toUpperCase();
}

export function Avatar({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-text', className)}
    >
      {initialsOf(name)}
    </span>
  );
}

/* ---------- KPI tile ---------- */

export type KpiTileProps = {
  label: string;
  value: string;
  hint?: string;
  /** Marks values that are not verified (e.g. attributed revenue) — label from i18n `kpi.estimated`. */
  estimatedLabel?: string;
  tone?: 'default' | 'accent' | 'danger';
};

export function KpiTile({ label, value, hint, estimatedLabel, tone = 'default' }: KpiTileProps) {
  return (
    <Card className="flex flex-col gap-1.5 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-muted">{label}</span>
        {estimatedLabel ? <Badge tone="warning">{estimatedLabel}</Badge> : null}
      </div>
      <span
        className={cn(
          'font-display text-[1.75rem] leading-9 font-semibold tabular-nums',
          tone === 'accent' && 'text-accent',
          tone === 'danger' && 'text-danger-text',
          tone === 'default' && 'text-text',
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-caption text-muted">{hint}</span> : null}
    </Card>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon ? <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted">{icon}</span> : null}
      <p className="font-display text-h2 text-text">{title}</p>
      {description ? <p className="max-w-sm text-body text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

/* ---------- Demo data badge (required on every screen showing synthetic data) ---------- */

export function DemoDataBadge({ label, notice }: { label: string; notice?: string }) {
  return (
    <span className="inline-flex items-center gap-2" title={notice}>
      <Badge tone="warning">{label}</Badge>
      {notice ? <span className="sr-only">{notice}</span> : null}
    </span>
  );
}
