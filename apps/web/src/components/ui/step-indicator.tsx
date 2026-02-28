'use client';

/**
 * StepIndicator — Multi-step progress indicator (dots / numbers / progress bar variants).
 *
 * Usage:
 *   <StepIndicator steps={['Basic Info', 'Team', 'Review']} currentStep={1} variant="numbers" />
 *   <StepIndicator steps={['A','B','C']} currentStep={0} variant="dots" onStepClick={setStep} />
 *   <StepIndicator steps={['Step 1','Step 2','Step 3']} currentStep={2} variant="progress" />
 */

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepIndicatorProps {
  steps: string[];
  /** 0-based current step index */
  currentStep: number;
  variant?: 'dots' | 'numbers' | 'progress';
  className?: string;
  /** If provided, clicking a step fires this callback */
  onStepClick?: (index: number) => void;
}

export function StepIndicator({
  steps,
  currentStep,
  variant = 'numbers',
  className,
  onStepClick,
}: StepIndicatorProps) {
  if (variant === 'progress') {
    const pct = steps.length <= 1 ? 100 : (currentStep / (steps.length - 1)) * 100;
    return (
      <div className={cn('space-y-1.5', className)}>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{steps[currentStep]}</span>
          <span>{currentStep + 1} of {steps.length}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div className={cn('flex items-center justify-center gap-2', className)}>
        {steps.map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onStepClick?.(i)}
            disabled={!onStepClick}
            aria-label={label}
            className={cn(
              'rounded-full transition-all duration-200',
              i === currentStep
                ? 'w-6 h-2 bg-primary'
                : i < currentStep
                ? 'w-2 h-2 bg-primary/50'
                : 'w-2 h-2 bg-muted-foreground/30',
              onStepClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
            )}
          />
        ))}
      </div>
    );
  }

  // numbers (default)
  return (
    <div className={cn('flex items-center', className)}>
      {steps.map((label, i) => {
        const isDone    = i < currentStep;
        const isCurrent = i === currentStep;
        const isLast    = i === steps.length - 1;

        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => onStepClick?.(i)}
                disabled={!onStepClick}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all duration-200',
                  isDone    && 'bg-primary border-primary text-primary-foreground',
                  isCurrent && 'bg-background border-primary text-primary',
                  !isDone && !isCurrent && 'bg-background border-muted-foreground/30 text-muted-foreground',
                  onStepClick && (isDone || isCurrent) && 'cursor-pointer hover:opacity-80',
                  !onStepClick && 'cursor-default',
                )}
              >
                {isDone ? <Check className="w-4 h-4" /> : i + 1}
              </button>
              <span className={cn(
                'text-[10px] font-medium whitespace-nowrap',
                isCurrent ? 'text-primary' : 'text-muted-foreground',
              )}>
                {label}
              </span>
            </div>

            {!isLast && (
              <div className={cn(
                'flex-1 h-0.5 mx-2 mb-4 transition-colors duration-300',
                i < currentStep ? 'bg-primary' : 'bg-muted-foreground/20',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
