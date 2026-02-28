'use client';

/**
 * SmartButton — Button with built-in loading / success / error state transitions.
 *
 * Usage:
 *   <SmartButton onClick={async () => { await save(); }} loadingText="Saving..." successText="Saved!">
 *     Save Changes
 *   </SmartButton>
 *
 *   <SmartButton disabled disabledReason="Fill in the name first">
 *     Create Release
 *   </SmartButton>
 */

import { useState, useCallback } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ButtonProps } from '@/components/ui/button';

export interface SmartButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** Async onClick — automatically manages loading state */
  onClick?: () => Promise<void>;
  /** Controlled loading state (overrides internal async detection) */
  loading?: boolean;
  loadingText?: string;
  /** Text shown for 1.5s after successful async onClick */
  successText?: string;
  /** Tooltip reason shown on hover when button is disabled */
  disabledReason?: string;
  /** Icon rendered before children in idle state */
  icon?: React.ReactNode;
}

type State = 'idle' | 'loading' | 'success';

export function SmartButton({
  onClick,
  loading: controlledLoading,
  loadingText,
  successText,
  disabledReason,
  icon,
  children,
  disabled,
  className,
  ...rest
}: SmartButtonProps) {
  const [state, setState] = useState<State>('idle');

  const isLoading = controlledLoading ?? state === 'loading';
  const isSuccess = state === 'success';
  const isDisabled = disabled || isLoading;

  const handleClick = useCallback(async () => {
    if (!onClick || isLoading) return;
    setState('loading');
    try {
      await onClick();
      if (successText) {
        setState('success');
        setTimeout(() => setState('idle'), 1500);
      } else {
        setState('idle');
      }
    } catch {
      setState('idle');
      // caller handles the error / toast
    }
  }, [onClick, isLoading, successText]);

  const label = isLoading
    ? (loadingText ?? 'Loading...')
    : isSuccess
    ? successText
    : children;

  const button = (
    <Button
      {...rest}
      disabled={isDisabled}
      className={cn(
        'transition-all duration-200',
        isSuccess && 'bg-green-500 hover:bg-green-600 text-white border-green-500',
        className,
      )}
      onClick={onClick ? handleClick : undefined}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : isSuccess ? (
        <CheckCircle2 className="w-4 h-4 mr-2" />
      ) : icon ? (
        <span className="mr-2">{icon}</span>
      ) : null}
      {label}
    </Button>
  );

  if (isDisabled && disabledReason) {
    return (
      <span title={disabledReason} className="inline-flex cursor-not-allowed">
        {button}
      </span>
    );
  }

  return button;
}
