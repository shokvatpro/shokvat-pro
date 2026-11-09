import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '../cn.ts';

const control = [
  'w-full rounded-md border border-border-strong bg-surface px-3.5 text-body text-text',
  'placeholder:text-muted',
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted',
  'aria-invalid:border-danger',
].join(' ');

type FieldShellProps = {
  label: string;
  hint?: string;
  error?: string;
  /** Short marker shown next to the label, e.g. t('common.optional'). */
  labelAside?: ReactNode;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

/** Label + control + hint/error, wired with ids so screen readers announce everything. */
export function Field({ label, hint, error, labelAside, className, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-caption font-medium text-text">{label}</label>
        {labelAside ? <span className="text-caption text-muted">{labelAside}</span> : null}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? <p id={errorId} className="text-caption text-danger-text">{error}</p> : null}
      {hint && !error ? <p id={hintId} className="text-caption text-muted">{hint}</p> : null}
    </div>
  );
}

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  hint?: string;
  error?: string;
  labelAside?: ReactNode;
  /** Phone numbers, emails and codes stay left-to-right even inside Arabic layouts. */
  forceLtr?: boolean;
};

export function TextField({ label, hint, error, labelAside, forceLtr, className, ...rest }: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} labelAside={labelAside} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          dir={forceLtr ? 'ltr' : undefined}
          className={cn(control, 'h-touch', forceLtr && 'text-start [unicode-bidi:plaintext]')}
          {...rest}
        />
      )}
    </Field>
  );
}

export type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & { label: string; hint?: string; error?: string };

export function TextAreaField({ label, hint, error, className, rows = 4, ...rest }: TextAreaFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} rows={rows} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={cn(control, 'py-2.5 leading-6')} {...rest} />
      )}
    </Field>
  );
}

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> & { label: string };

export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  const id = useId();
  return (
    <div className={cn('flex min-h-touch items-center gap-2.5', className)}>
      <input id={id} type="checkbox" className="size-[18px] accent-primary" {...rest} />
      <label htmlFor={id} className="text-body text-muted">{label}</label>
    </div>
  );
}
