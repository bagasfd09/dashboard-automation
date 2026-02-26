'use client';

import { useState } from 'react';
import { RotateCcw, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface RetryButtonProps {
  testCaseId: string;
  teamId: string;
  size?: 'sm' | 'default';
}

export function RetryButton({ testCaseId, teamId, size = 'sm' }: RetryButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'pending'>('idle');

  async function handleClick() {
    if (state !== 'idle') return;
    setState('loading');
    try {
      await api.requestRetry(testCaseId, teamId);
      setState('pending');
      toast.info('Retry queued — watcher will pick it up shortly');
    } catch {
      toast.error('Failed to request retry');
      setState('idle');
    }
  }

  if (state === 'pending') {
    return (
      <Button variant="outline" size={size} disabled className="border-yellow-500/50 text-yellow-600 dark:text-yellow-400 gap-1">
        <Clock className="h-3 w-3" />
        Pending…
      </Button>
    );
  }

  if (state === 'loading') {
    return (
      <Button variant="outline" size={size} disabled className="border-border text-muted-foreground gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Requesting…
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleClick}
      className="border-border text-foreground/80 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 gap-1"
    >
      <RotateCcw className="h-3 w-3" />
      Retry
    </Button>
  );
}
