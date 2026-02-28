'use client';

/**
 * FormField — Consistent label + field + hint/error layout wrapper.
 *
 * Usage:
 *   <FormField label="Email" required hint="We'll send login credentials here">
 *     <ValidatedInput type="email" ... />
 *   </FormField>
 */

import { cn } from '@/lib/utils';

export interface FormFieldProps {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
  id?: string;
}

export function FormField({ label, required, hint, error, className, children, id }: FormFieldProps) {
  const message = error ?? hint;
  const isError = !!error;

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-foreground leading-none"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {message && (
        <p className={cn('text-xs', isError ? 'text-red-500' : 'text-muted-foreground')}>
          {message}
        </p>
      )}
    </div>
  );
}
