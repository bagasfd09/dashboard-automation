'use client';

/**
 * InlineEdit — Click-to-edit text field.
 *
 * Usage:
 *   <InlineEdit
 *     value={name}
 *     onSave={async (v) => { await update(id, { name: v }); }}
 *     validate={(v) => v.length < 2 ? "Too short" : null}
 *   />
 */

import { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface InlineEditProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  type?: 'text' | 'textarea';
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  validate?: (value: string) => string | null;
  renderDisplay?: (value: string) => React.ReactNode;
  className?: string;
}

type EditState = 'display' | 'editing' | 'saving' | 'saved' | 'error';

export function InlineEdit({
  value,
  onSave,
  type = 'text',
  placeholder = 'Click to edit…',
  disabled,
  maxLength,
  validate,
  renderDisplay,
  className,
}: InlineEditProps) {
  const [editState, setEditState] = useState<EditState>('display');
  const [draft, setDraft] = useState(value);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Keep draft in sync if value changes externally
  useEffect(() => {
    if (editState === 'display') setDraft(value);
  }, [value, editState]);

  // Auto-focus + select-all when entering edit mode
  useEffect(() => {
    if (editState === 'editing' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editState]);

  function startEdit() {
    if (disabled) return;
    setDraft(value);
    setValidationError(null);
    setEditState('editing');
  }

  function cancel() {
    setDraft(value);
    setValidationError(null);
    setEditState('display');
  }

  async function save() {
    const trimmed = draft.trim();
    if (trimmed === value) { cancel(); return; }

    if (validate) {
      const err = validate(trimmed);
      if (err) { setValidationError(err); return; }
    }

    setEditState('saving');
    try {
      await onSave(trimmed);
      setEditState('saved');
      setTimeout(() => setEditState('display'), 1200);
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to save');
      setEditState('error');
      setTimeout(() => setEditState('display'), 800);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    if (type === 'text' && e.key === 'Enter') { e.preventDefault(); save(); }
    if (type === 'textarea' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
  }

  const isSaving = editState === 'saving';
  const isSaved  = editState === 'saved';
  const isError  = editState === 'error';

  if (editState === 'display' || isSaved || isError) {
    return (
      <span
        onClick={startEdit}
        className={cn(
          'group inline-flex items-center gap-1.5 cursor-pointer rounded px-1 -ml-1 transition-all duration-200',
          !disabled && 'hover:bg-muted/60',
          isSaved && 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300',
          isError && 'bg-red-100 dark:bg-red-950',
          disabled && 'cursor-default',
          className,
        )}
      >
        {renderDisplay ? renderDisplay(value) : (
          <span className={cn(!value && 'text-muted-foreground italic')}>
            {value || placeholder}
          </span>
        )}
        {!disabled && (
          <Pencil className="w-3 h-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </span>
    );
  }

  const inputClass = cn(
    'w-full text-sm bg-background border border-input rounded-md px-2.5 py-1.5 outline-none transition-colors',
    'focus:ring-2 focus:ring-ring focus:border-ring',
    validationError && 'border-red-400 focus:ring-red-400/20',
    isSaving && 'opacity-60 cursor-not-allowed',
  );

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-start gap-2">
        {type === 'textarea' ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={e => { setDraft(e.target.value); setValidationError(null); }}
            onKeyDown={handleKeyDown}
            onBlur={() => !isSaving && save()}
            disabled={isSaving}
            maxLength={maxLength}
            rows={3}
            className={cn(inputClass, 'resize-y min-h-[72px]')}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={draft}
            onChange={e => { setDraft(e.target.value); setValidationError(null); }}
            onKeyDown={handleKeyDown}
            onBlur={() => !isSaving && save()}
            disabled={isSaving}
            maxLength={maxLength}
            className={inputClass}
          />
        )}

        <div className="flex gap-1 shrink-0 mt-0.5">
          <button
            type="button"
            onClick={save}
            disabled={isSaving}
            className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950 transition-colors disabled:opacity-50"
            aria-label="Save"
          >
            {isSaving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Check className="w-4 h-4" />
            }
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={isSaving}
            className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {validationError && (
        <p className="text-xs text-red-500">{validationError}</p>
      )}
      {type === 'textarea' && (
        <p className="text-[10px] text-muted-foreground">⌘↵ to save, Esc to cancel</p>
      )}
    </div>
  );
}
