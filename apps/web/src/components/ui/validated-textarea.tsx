'use client';

/**
 * ValidatedTextarea — Auto-grow textarea with char count + optional markdown preview.
 *
 * Usage:
 *   <ValidatedTextarea
 *     value={content}
 *     onChange={setContent}
 *     maxLength={500}
 *     showMarkdownPreview
 *     validate={(v) => v.length < 10 ? { state: 'error', message: 'Too short' } : null}
 *   />
 */

import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValidationResult } from './validated-input';

export interface ValidatedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  validate?: (value: string) => ValidationResult | null;
  validateOn?: 'change' | 'blur' | 'both';
  maxLength?: number;
  showMarkdownPreview?: boolean;
  hint?: string;
  autoGrow?: boolean;
  minRows?: number;
  maxRows?: number;
}

const BORDER: Record<string, string> = {
  idle:    'border-input',
  valid:   'border-green-500 focus-visible:ring-green-500/20',
  warning: 'border-yellow-500 focus-visible:ring-yellow-500/20',
  error:   'border-red-500 focus-visible:ring-red-500/20',
};

const MSG_CLASS: Record<string, string> = {
  idle:    'text-muted-foreground',
  valid:   'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  error:   'text-red-500',
};

export function ValidatedTextarea({
  value,
  onChange,
  validate,
  validateOn = 'blur',
  maxLength,
  showMarkdownPreview = false,
  hint,
  autoGrow = true,
  minRows = 3,
  maxRows = 12,
  className,
  disabled,
  ...props
}: ValidatedTextareaProps) {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow
  useEffect(() => {
    if (!autoGrow || !textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = 'auto';
    const styles = getComputedStyle(el);
    const lineHeight = parseInt(styles.lineHeight, 10) || 20;
    const paddingY = parseInt(styles.paddingTop, 10) + parseInt(styles.paddingBottom, 10);
    const minH = minRows * lineHeight + paddingY;
    const maxH = maxRows * lineHeight + paddingY;
    el.style.height = Math.min(Math.max(el.scrollHeight, minH), maxH) + 'px';
  }, [value, autoGrow, minRows, maxRows]);

  function runValidation(v: string) {
    if (!validate) return;
    setValidation(validate(v));
  }

  const state = validation?.state ?? 'idle';
  const message = validation?.message ?? hint;
  const charCount = value.length;
  const nearLimit = maxLength ? charCount >= maxLength * 0.85 : false;
  const atLimit = maxLength ? charCount >= maxLength : false;

  // Minimal markdown-like preview (bold, italic, code, newlines)
  function renderMarkdown(text: string): string {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="font-mono bg-muted px-1 rounded text-xs">$1</code>')
      .replace(/\n/g, '<br>');
  }

  return (
    <div className="space-y-1.5">
      {showMarkdownPreview && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setPreviewMode(p => !p)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {previewMode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {previewMode ? 'Edit' : 'Preview'}
          </button>
        </div>
      )}

      {previewMode ? (
        <div
          className={cn(
            'min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
            !value && 'text-muted-foreground italic',
          )}
          dangerouslySetInnerHTML={{ __html: value ? renderMarkdown(value) : 'Nothing to preview…' }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => {
            onChange(e.target.value);
            if (validateOn === 'change' || validateOn === 'both') runValidation(e.target.value);
          }}
          onBlur={e => {
            if (validateOn === 'blur' || validateOn === 'both') runValidation(e.target.value);
          }}
          disabled={disabled}
          maxLength={maxLength}
          rows={minRows}
          className={cn(
            'w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50 transition-colors resize-none overflow-hidden',
            BORDER[state],
            className,
          )}
          {...props}
        />
      )}

      <div className="flex items-start justify-between gap-2">
        {message ? (
          <p className={cn('text-xs', MSG_CLASS[state])}>{message}</p>
        ) : <span />}

        {maxLength && (
          <p className={cn(
            'text-[10px] shrink-0 tabular-nums',
            atLimit   ? 'text-red-500 font-semibold' :
            nearLimit ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-muted-foreground',
          )}>
            {charCount}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
}
