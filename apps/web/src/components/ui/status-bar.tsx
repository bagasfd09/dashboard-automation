'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface StatusBarProps {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  height?: number;
  showLabels?: boolean;
  animated?: boolean;
  className?: string;
}

export function StatusBar({
  passed,
  failed,
  skipped,
  total,
  height = 6,
  showLabels = false,
  animated = true,
  className,
}: StatusBarProps) {
  const [mounted, setMounted] = useState(!animated);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!animated) return;
    timerRef.current = setTimeout(() => setMounted(true), 50);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [animated]);

  if (!total) return null;

  const passedPct = (passed / total) * 100;
  const failedPct = (failed / total) * 100;
  const skippedPct = (skipped / total) * 100;

  const radius = height / 2;

  return (
    <div className={cn('w-full', className)}>
      {showLabels && (
        <div className="flex gap-3 mb-1 text-[10px] font-semibold">
          {passed > 0 && <span className="text-green-500">{passed} passed</span>}
          {failed > 0 && <span className="text-red-500">{failed} failed</span>}
          {skipped > 0 && <span className="text-yellow-500">{skipped} skipped</span>}
        </div>
      )}
      <div
        className="flex overflow-hidden bg-border/60"
        style={{ height, borderRadius: radius }}
      >
        <div
          className="bg-green-500 transition-all duration-500 ease-out shrink-0"
          style={{ width: mounted ? `${passedPct}%` : '0%' }}
          title={`Passed: ${passed}`}
        />
        <div
          className="bg-red-500 transition-all duration-500 ease-out shrink-0"
          style={{ width: mounted ? `${failedPct}%` : '0%' }}
          title={`Failed: ${failed}`}
        />
        <div
          className="bg-yellow-500 transition-all duration-500 ease-out shrink-0"
          style={{ width: mounted ? `${skippedPct}%` : '0%' }}
          title={`Skipped: ${skipped}`}
        />
      </div>
    </div>
  );
}
