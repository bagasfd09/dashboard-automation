'use client';

/**
 * ConfirmDialog — Reusable confirmation dialog for destructive actions.
 *
 * Usage:
 *   <ConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Delete collection?"
 *     description="This cannot be undone."
 *     variant="danger"
 *     confirmText="Delete"
 *     onConfirm={async () => { await deleteCollection(id); }}
 *   />
 *
 *   // Type-to-confirm for critical actions:
 *   <ConfirmDialog
 *     ...
 *     confirmInput={{ label: "Team name", expectedValue: "QA Web Team" }}
 *   />
 */

import { useState } from 'react';
import { AlertTriangle, XCircle, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  variant?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => Promise<void> | void;
  /** If provided, user must type this value before confirming */
  confirmInput?: { label: string; expectedValue: string };
}

const variantConfig = {
  danger:  { icon: XCircle,       iconClass: 'text-red-500',    btn: 'bg-red-500 hover:bg-red-600 text-white border-red-500' },
  warning: { icon: AlertTriangle, iconClass: 'text-yellow-500', btn: 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500' },
  info:    { icon: Info,          iconClass: 'text-blue-500',   btn: '' },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = 'danger',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  confirmInput,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const { icon: Icon, iconClass, btn } = variantConfig[variant];

  const canConfirm = !confirmInput || inputValue.trim() === confirmInput.expectedValue;

  async function handleConfirm() {
    if (!canConfirm || loading) return;
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
      setInputValue('');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(o: boolean) {
    if (!loading) {
      onOpenChange(o);
      if (!o) setInputValue('');
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0',
              variant === 'danger'  && 'bg-red-100 dark:bg-red-950',
              variant === 'warning' && 'bg-yellow-100 dark:bg-yellow-950',
              variant === 'info'    && 'bg-blue-100 dark:bg-blue-950',
            )}>
              <Icon className={cn('w-5 h-5', iconClass)} />
            </div>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">{description}</div>

          {confirmInput && (
            <div className="space-y-2">
              <Label className="text-sm">
                Type <span className="font-mono font-semibold text-foreground">"{confirmInput.expectedValue}"</span> to confirm:
              </Label>
              <Input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canConfirm && handleConfirm()}
                placeholder={confirmInput.expectedValue}
                autoFocus
                className={cn(
                  inputValue && (canConfirm
                    ? 'border-green-500 focus-visible:ring-green-500/20'
                    : 'border-red-400 focus-visible:ring-red-400/20')
                )}
              />
              {inputValue && !canConfirm && (
                <p className="text-xs text-red-500">Doesn't match — keep typing</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className={cn('min-w-[90px]', btn)}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {confirmText}...
              </span>
            ) : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
