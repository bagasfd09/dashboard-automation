'use client';

/**
 * TagInput — Multi-value chip/tag input with suggestions.
 *
 * Usage:
 *   <TagInput
 *     value={tags}
 *     onChange={setTags}
 *     suggestions={[{ label: 'smoke', count: 23 }, { label: 'e2e', count: 12 }]}
 *     placeholder="Add tag..."
 *   />
 */

import { useState, useRef, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TagSuggestion {
  label: string;
  count?: number;
}

export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: TagSuggestion[];
  maxTags?: number;
  placeholder?: string;
  allowCustom?: boolean;
  validate?: (tag: string) => string | null;
  className?: string;
  disabled?: boolean;
}

export function TagInput({
  value,
  onChange,
  suggestions = [],
  maxTags,
  placeholder = 'Add tag…',
  allowCustom = true,
  validate,
  className,
  disabled,
}: TagInputProps) {
  const [inputVal, setInputVal] = useState('');
  const [focused, setFocused] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const atMax = maxTags !== undefined && value.length >= maxTags;

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (!tag || !allowCustom) return;

    if (validate) {
      const err = validate(tag);
      if (err) return; // caller handles validation UI
    }

    if (value.includes(tag)) {
      // Flash the existing tag
      setFlashId(tag);
      setTimeout(() => setFlashId(null), 600);
      setInputVal('');
      return;
    }

    if (atMax) return;
    onChange([...value, tag]);
    setInputVal('');
  }

  function removeTag(tag: string) {
    onChange(value.filter(t => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputVal);
    } else if (e.key === 'Backspace' && inputVal === '' && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  }

  function handleSuggestionClick(label: string) {
    if (value.includes(label)) {
      setFlashId(label);
      setTimeout(() => setFlashId(null), 600);
      return;
    }
    if (atMax) return;
    onChange([...value, label]);
    inputRef.current?.focus();
  }

  // Filter suggestions: not already added, matches input, sorted by count
  const filteredSuggestions = suggestions
    .filter(s => {
      if (value.includes(s.label)) return false;
      if (inputVal) return s.label.toLowerCase().includes(inputVal.toLowerCase());
      return true;
    })
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 8);

  const showSuggestions = focused && filteredSuggestions.length > 0;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Input area */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'flex flex-wrap items-center gap-1.5 p-2 min-h-[42px] rounded-md border border-input bg-background cursor-text transition-colors',
          focused && 'ring-2 ring-ring ring-offset-0 border-ring',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        {value.map(tag => (
          <span
            key={tag}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary transition-all',
              flashId === tag && 'bg-yellow-200 dark:bg-yellow-800 scale-105',
            )}
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); removeTag(tag); }}
                className="hover:text-red-500 transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}

        {!atMax && !disabled && (
          <input
            ref={inputRef}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => { setTimeout(() => setFocused(false), 150); addTag(inputVal); }}
            placeholder={value.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        )}

        {atMax && (
          <span className="text-xs text-muted-foreground ml-1">
            Maximum {maxTags} tags
          </span>
        )}
      </div>

      {/* Suggestions */}
      {showSuggestions && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground self-center">Suggested:</span>
          {filteredSuggestions.map(s => (
            <button
              key={s.label}
              type="button"
              onMouseDown={e => e.preventDefault()} // prevent blur
              onClick={() => handleSuggestionClick(s.label)}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border border-border hover:border-primary hover:bg-primary/5 transition-colors"
            >
              {s.label}
              {s.count !== undefined && (
                <span className="text-[9px] text-muted-foreground">{s.count}×</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
