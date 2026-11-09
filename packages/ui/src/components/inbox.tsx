import type { ReactNode } from 'react';
import { cn } from '../cn.ts';
import { Avatar, Badge, ConversationStatusPill, type ConversationStatus } from './display.tsx';
import { ClockIcon } from '../icons.tsx';

export type ConversationListItemProps = {
  href: string;
  contactName: string;
  channelLabel: string;
  timeLabel: string;
  preview: string;
  status: ConversationStatus;
  statusLabel: string;
  assigneeLabel?: string;
  /** Last message is from the customer and nobody has replied yet. */
  awaitingAgentLabel?: string;
  slaBreachedLabel?: string;
  selected?: boolean;
};

export function ConversationListItem(p: ConversationListItemProps) {
  return (
    <a
      href={p.href}
      aria-current={p.selected ? 'true' : undefined}
      className={cn(
        'flex gap-3 border-b border-border px-4 py-3 text-text no-underline',
        'hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        p.selected && 'bg-surface-2 shadow-[inset_3px_0_0_var(--sp-tenant-accent)] rtl:shadow-[inset_-3px_0_0_var(--sp-tenant-accent)]',
        p.slaBreachedLabel && !p.selected && 'bg-danger-soft/40',
      )}
    >
      <Avatar name={p.contactName} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-body font-semibold">{p.contactName}</span>
          <span className="shrink-0 text-caption text-muted">
            {p.channelLabel} · {p.timeLabel}
          </span>
        </span>
        <span className="truncate text-caption text-muted">{p.preview}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          {p.slaBreachedLabel ? (
            <Badge tone="critical" icon={<ClockIcon size={14} />}>{p.slaBreachedLabel}</Badge>
          ) : p.awaitingAgentLabel ? (
            <Badge tone="warning">{p.awaitingAgentLabel}</Badge>
          ) : (
            <ConversationStatusPill status={p.status} label={p.statusLabel} />
          )}
          {p.assigneeLabel ? <span className="text-caption text-muted">{p.assigneeLabel}</span> : null}
        </span>
      </span>
    </a>
  );
}

export type MessageBubbleProps = {
  direction: 'inbound' | 'outbound' | 'system';
  children: ReactNode;
  meta?: string;
  /** Message body language may differ from the UI language. */
  lang?: string;
};

export function MessageBubble({ direction, children, meta, lang }: MessageBubbleProps) {
  if (direction === 'system') {
    return <p className="self-center rounded-full bg-neutral-soft px-3 py-1 text-caption text-neutral-text">{children}</p>;
  }
  const outbound = direction === 'outbound';
  return (
    <div
      lang={lang}
      dir="auto"
      className={cn(
        'max-w-[min(70%,32rem)] px-3.5 py-2.5 text-body leading-6',
        outbound
          ? 'self-end rounded-lg rounded-ee-sm bg-tenant text-on-tenant'
          : 'self-start rounded-lg rounded-es-sm border border-border bg-surface text-text',
      )}
    >
      <div className="whitespace-pre-wrap">{children}</div>
      {meta ? <div className={cn('mt-1 text-[0.6875rem]', outbound ? 'opacity-85' : 'text-muted')}>{meta}</div> : null}
    </div>
  );
}

export function SlaBanner({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-2 bg-warning-soft px-5 py-2.5 text-caption font-semibold text-warning-text">
      <ClockIcon size={16} />
      {children}
    </div>
  );
}
