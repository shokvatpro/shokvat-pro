import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn.ts';
import { LoaderIcon } from '../icons.tsx';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap select-none',
    'transition-colors duration-150 motion-reduce:transition-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'disabled:cursor-not-allowed disabled:opacity-55',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-hover',
        /** Uses the medical center's accent; falls back to platform primary when none is set. */
        tenant: 'bg-tenant text-on-tenant hover:brightness-110',
        secondary: 'border border-border-strong bg-surface text-text hover:bg-surface-2',
        ghost: 'bg-transparent text-primary hover:bg-surface-2',
        danger: 'bg-danger text-white hover:brightness-110 dark:text-bg',
      },
      size: {
        sm: 'h-9 px-3 text-caption',
        md: 'h-touch px-5 text-body',
        lg: 'h-12 px-6 text-body',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    /** Accessible text announced while loading, e.g. t('common.loading'). */
    loadingLabel?: string;
    icon?: ReactNode;
  };

export function Button({ className, variant, size, block, loading, loadingLabel, icon, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderIcon size={18} /> : icon}
      <span>{children}</span>
      {loading && loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
    </button>
  );
}

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> & {
  /** Required: icon-only buttons must have an accessible name. */
  label: string;
  icon: ReactNode;
  variant?: 'secondary' | 'ghost';
};

export function IconButton({ label, icon, variant = 'secondary', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-touch shrink-0 items-center justify-center rounded-md text-text',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        variant === 'secondary' ? 'border border-border bg-surface hover:bg-surface-2' : 'hover:bg-surface-2',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}
