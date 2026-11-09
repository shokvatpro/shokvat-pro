import { cn } from '../cn.ts';

/**
 * Platform identity (Shokfat Pro). Locked — tenants cannot change it.
 * Logo files live in /assets/brand; apps pass the served URLs.
 */
export function ProductMark({
  logoLightSrc,
  logoDarkSrc,
  companyName,
  proLabel,
  height = 32,
  className,
}: {
  logoLightSrc: string;
  logoDarkSrc: string;
  companyName: string;
  proLabel: string;
  height?: number;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img src={logoLightSrc} alt={companyName} style={{ height }} className="w-auto dark:hidden" />
      <img src={logoDarkSrc} alt={companyName} style={{ height }} className="hidden w-auto dark:block" />
      <span className="rounded-sm bg-accent px-2 py-0.5 font-display text-caption font-semibold text-on-accent">{proLabel}</span>
    </span>
  );
}

/**
 * Medical center identity (tenant). Shows the uploaded logo, or an initial on the tenant accent.
 * The accent comes from CSS variables set by tenantCssVariables() — never from inline colour props.
 */
export function TenantIdentity({
  name,
  subtitle,
  logoSrc,
  size = 40,
}: {
  name: string;
  subtitle?: string;
  logoSrc?: string;
  size?: number;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      {logoSrc ? (
        <img src={logoSrc} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-md object-contain" />
      ) : (
        <span
          aria-hidden="true"
          style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-tenant font-display font-bold text-on-tenant"
        >
          {name.trim()[0]}
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-display text-body font-semibold text-text">{name}</span>
        {subtitle ? <span className="truncate text-caption text-muted">{subtitle}</span> : null}
      </span>
    </span>
  );
}

/** Fixed footer mark inside tenant workspaces — keeps platform ownership visible. */
export function PoweredBy({ label }: { label: string }) {
  return <p className="text-caption text-muted">{label}</p>;
}
