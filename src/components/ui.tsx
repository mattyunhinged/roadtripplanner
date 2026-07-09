import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
}) {
  const variants = {
    primary: 'bg-[var(--fg)] text-[var(--bg)] hover:opacity-90',
    secondary:
      'bg-[var(--bg-muted)] text-[var(--fg)] border border-[var(--border)] hover:border-[var(--border-strong)]',
    ghost: 'bg-transparent text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-muted)]',
    danger: 'bg-[var(--color-danger)] text-white hover:opacity-90',
    accent: 'bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90',
  };
  const sizes = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-11 px-4 text-sm',
    lg: 'h-12 px-5 text-base',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)]',
        className,
      )}
    />
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full min-h-[96px] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)] resize-y',
        className,
      )}
    />
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <label className={cn('block text-sm font-medium text-[var(--fg-muted)] mb-1.5', className)}>
      {children}
    </label>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-sm text-[var(--color-danger)]">{children}</p>;
}

export function Badge({
  children,
  className,
  color,
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        className,
      )}
      style={color ? { background: `${color}22`, color } : undefined}
    >
      {children}
    </span>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-9 w-9', className)} fill="none" aria-hidden>
      <rect width="64" height="64" rx="14" fill="currentColor" className="text-[var(--bg-muted)]" />
      <path d="M8 38h48" stroke="#C4A574" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 42h48" stroke="#C4A574" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
      <path
        d="M12 36c8-10 16-14 20-14s12 4 20 14"
        stroke="#8FA88A"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="32" cy="28" r="3" fill="#E8A54B" />
      <path d="M22 46h20" stroke="#E8A54B" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLockup({ large = false }: { large?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark className={large ? 'h-12 w-12' : 'h-9 w-9'} />
      <div>
        <div
          className={cn(
            'font-display font-semibold tracking-tight',
            large ? 'text-3xl' : 'text-lg',
          )}
        >
          On The Road
        </div>
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--fg-subtle)]">by Ryzord</div>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm transition',
            value === opt.value
              ? 'bg-[var(--bg-elevated)] text-[var(--fg)] shadow-sm'
              : 'text-[var(--fg-muted)] hover:text-[var(--fg)]',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-5 w-5 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--accent)]',
        className,
      )}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <LogoMark className="h-14 w-14 opacity-80" />
      <h3 className="font-display text-2xl">{title}</h3>
      <p className="max-w-sm text-[var(--fg-muted)]">{description}</p>
      {action}
    </div>
  );
}

function useUIStoreToast() {
  const toast = useUIStore((s) => s.toast);
  const clearToast = useUIStore((s) => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(clearToast, 3200);
    return () => window.clearTimeout(t);
  }, [toast, clearToast]);
  return toast;
}

export function ToastHost() {
  const toast = useUIStoreToast();
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 no-print">
      <div
        className={cn(
          'pointer-events-auto rounded-2xl px-4 py-3 text-sm shadow-lg',
          toast.type === 'error' && 'bg-[var(--color-danger)] text-white',
          toast.type === 'success' && 'bg-[var(--color-success)] text-white',
          toast.type === 'info' && 'glass-panel text-[var(--fg)]',
        )}
      >
        {toast.message}
      </div>
    </div>
  );
}
