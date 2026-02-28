'use client';

/**
 * ValidatedInput — Enhanced input with valid/warning/error visual states + suggestions.
 *
 * Usage:
 *   <ValidatedInput
 *     value={email}
 *     onChange={setEmail}
 *     validate={(v) => !v.includes('@') ? { state: 'error', message: 'Invalid email' } : null}
 *     suggestions={['user@example.com']}
 *   />
 */

import { useState, useRef } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ValidationState = 'idle' | 'valid' | 'warning' | 'error';

export interface ValidationResult {
  state: ValidationState;
  message?: string;
}

export interface ValidatedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  validate?: (value: string) => ValidationResult | null;
  validateOn?: 'change' | 'blur' | 'both';
  suggestions?: string[];
  hint?: string;
}

const BORDER: Record<ValidationState, string> = {
  idle:    'border-input',
  valid:   'border-green-500 focus-visible:ring-green-500/20',
  warning: 'border-yellow-500 focus-visible:ring-yellow-500/20',
  error:   'border-red-500 focus-visible:ring-red-500/20',
};

const ICON_CLASS: Record<ValidationState, string> = {
  idle: '', valid: 'text-green-500', warning: 'text-yellow-500', error: 'text-red-500',
};

const MSG_CLASS: Record<ValidationState, string> = {
  idle:    'text-muted-foreground',
  valid:   'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  error:   'text-red-500',
};

const STATE_ICON: Record<ValidationState, React.ElementType | null> = {
  idle: null, valid: CheckCircle2, warning: AlertTriangle, error: AlertCircle,
};

export function ValidatedInput({
  value,
  onChange,
  validate,
  validateOn = 'blur',
  suggestions = [],
  hint,
  className,
  disabled,
  ...props
}: ValidatedInputProps) {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function runValidation(v: string) {
    if (!validate) return;
    setValidation(validate(v));
  }

  const state = validation?.state ?? 'idle';
  const message = validation?.message ?? hint;
  const Icon = STATE_ICON[state];

  const filteredSuggestions = suggestions
    .filter(s => value ? s.toLowerCase().includes(value.toLowerCase()) && s !== value : true)
    .slice(0, 6);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={e => {
            onChange(e.target.value);
            if (validateOn === 'change' || validateOn === 'both') runValidation(e.target.value);
          }}
          onBlur={e => {
            if (validateOn === 'blur' || validateOn === 'both') runValidation(e.target.value);
            setTimeout(() => setShowSuggestions(false), 150);
          }}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
            Icon ? 'pr-8' : '',
            BORDER[state],
            className,
          )}
          {...props}
        />

        {Icon && (
          <Icon className={cn('absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none', ICON_CLASS[state])} />
        )}

        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-md overflow-hidden">
            {filteredSuggestions.map(s => (
              <button
                key={s}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(s); setShowSuggestions(false); if (validate) runValidation(s); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {message && (
        <p className={cn('text-xs', MSG_CLASS[state])}>{message}</p>
      )}
    </div>
  );
}
