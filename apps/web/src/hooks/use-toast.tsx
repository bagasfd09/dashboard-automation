'use client';

/**
 * Enhanced toast hook that wraps sonner with undo countdowns, retry buttons,
 * and typed variants. Drop-in replacement for `import { toast } from 'sonner'`.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success("Saved!", { undo: () => restore(id), undoTimeout: 5000 });
 *   toast.error("Failed", { retry: () => save(data) });
 *   toast.success("Done", { action: { label: "View", onClick: () => router.push("/") } });
 */

import { useState, useEffect } from 'react';
import { toast as sonner } from 'sonner';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertTriangle, Info, X, RotateCcw } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  description?: string;
  duration?: number;
  /** Show an Undo button with a countdown timer */
  undo?: () => void;
  /** Countdown duration in ms (default 5000) */
  undoTimeout?: number;
  /** Show a Retry button (persistent toast) */
  retry?: () => void;
  /** Single custom action button */
  action?: ToastAction;
}

// ── Undo countdown component ──────────────────────────────────────────────────

function UndoToastContent({
  id,
  message,
  description,
  undoFn,
  timeoutMs,
}: {
  id: string | number;
  message: string;
  description?: string;
  undoFn: () => void;
  timeoutMs: number;
}) {
  const [remaining, setRemaining] = useState(Math.ceil(timeoutMs / 1000));

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  return (
    <div className="flex items-start gap-3 w-full">
      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{message}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => { undoFn(); sonner.dismiss(id); }}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
        >
          Undo ({remaining}s)
        </button>
        <button
          onClick={() => sonner.dismiss(id)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Styled custom toast ───────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

const variantStyles: Record<ToastVariant, { border: string; icon: React.ElementType; iconClass: string }> = {
  success: { border: 'border-l-green-500',  icon: CheckCircle2,    iconClass: 'text-green-500' },
  error:   { border: 'border-l-red-500',    icon: XCircle,         iconClass: 'text-red-500' },
  warning: { border: 'border-l-yellow-500', icon: AlertTriangle,   iconClass: 'text-yellow-500' },
  info:    { border: 'border-l-blue-500',   icon: Info,            iconClass: 'text-blue-500' },
};

function StyledToastContent({
  id,
  variant,
  message,
  description,
  retry,
  action,
}: {
  id: string | number;
  variant: ToastVariant;
  message: string;
  description?: string;
  retry?: () => void;
  action?: ToastAction;
}) {
  const { icon: Icon, iconClass } = variantStyles[variant];

  return (
    <div className="flex items-start gap-3 w-full">
      <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', iconClass)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{message}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        {(retry || action) && (
          <div className="flex gap-2 mt-2">
            {retry && (
              <button
                onClick={() => { sonner.dismiss(id); retry(); }}
                className="flex items-center gap-1 text-xs font-medium text-foreground border border-border rounded px-2 py-0.5 hover:bg-muted transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Retry
              </button>
            )}
            {action && (
              <button
                onClick={() => { sonner.dismiss(id); action.onClick(); }}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {action.label}
              </button>
            )}
          </div>
        )}
      </div>
      <button
        onClick={() => sonner.dismiss(id)}
        className="text-muted-foreground hover:text-foreground shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Toast API ─────────────────────────────────────────────────────────────────

const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  success: 5_000,
  info:    5_000,
  warning: 8_000,
  error:   Infinity,
};

function makeVariantFn(variant: ToastVariant) {
  return (message: string, options: ToastOptions = {}) => {
    const { description, undo, undoTimeout = 5_000, retry, action, duration } = options;

    // Undo toast: custom component with countdown
    if (undo) {
      return sonner.custom(
        (id) => (
          <UndoToastContent
            id={id}
            message={message}
            description={description}
            undoFn={undo}
            timeoutMs={undoTimeout}
          />
        ),
        {
          duration: undoTimeout,
          classNames: {
            toast: cn(
              'border-l-4 border-l-green-500 bg-background border border-border shadow-lg rounded-lg px-4 py-3',
            ),
          },
        },
      );
    }

    // Custom styled toast for error/retry or action
    if (retry || action) {
      return sonner.custom(
        (id) => (
          <StyledToastContent
            id={id}
            variant={variant}
            message={message}
            description={description}
            retry={retry}
            action={action}
          />
        ),
        {
          duration: retry ? Infinity : (duration ?? DEFAULT_DURATIONS[variant]),
          classNames: {
            toast: cn(
              'border-l-4 bg-background border border-border shadow-lg rounded-lg px-4 py-3',
              variantStyles[variant].border,
            ),
          },
        },
      );
    }

    // Standard sonner toast with variant styling
    const dur = duration ?? DEFAULT_DURATIONS[variant];
    const opts = { description, duration: dur, action: undefined as { label: string; onClick: () => void } | undefined };
    if (action) opts.action = action;

    switch (variant) {
      case 'success': return sonner.success(message, opts);
      case 'error':   return sonner.error(message, opts);
      case 'warning': return sonner.warning(message, opts);
      case 'info':    return sonner.info(message, opts);
    }
  };
}

const toastAPI = {
  success: makeVariantFn('success'),
  error:   makeVariantFn('error'),
  warning: makeVariantFn('warning'),
  info:    makeVariantFn('info'),
  dismiss: (id?: string | number) => sonner.dismiss(id),
};

/**
 * Enhanced toast hook. Wraps sonner with undo countdowns, retry buttons, and
 * rich action buttons. Existing `toast.success/error` calls from sonner still
 * work — migrate to this hook for the extra features.
 */
export function useToast() {
  return { toast: toastAPI };
}

/** Named export so it can be used outside React components too */
export { toastAPI as toast };
