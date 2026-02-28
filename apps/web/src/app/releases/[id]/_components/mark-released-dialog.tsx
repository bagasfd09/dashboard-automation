'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, XCircle, Clock, Circle, AlertTriangle, SkipForward, Rocket,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SmartButton } from '@/components/ui/smart-button';
import { ValidatedTextarea } from '@/components/ui/validated-textarea';
import { Label } from '@/components/ui/label';
import { useMarkReleased, useUpdateRelease } from '@/hooks/use-releases';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { ReleaseDetail, ReleaseChecklistItem, ChecklistItemStatus } from '@/lib/types';

function itemStatusIcon(status: ChecklistItemStatus) {
  switch (status) {
    case 'PASSED':      return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
    case 'FAILED':      return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    case 'IN_PROGRESS': return <Clock className="w-4 h-4 text-blue-500 shrink-0" />;
    case 'BLOCKED':     return <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />;
    case 'SKIPPED':     return <SkipForward className="w-4 h-4 text-muted-foreground shrink-0" />;
    default:            return <Circle className="w-4 h-4 text-muted-foreground shrink-0" />;
  }
}

function computeProgress(items: ReleaseChecklistItem[]) {
  const total = items.length;
  const passed = items.filter(i => i.status === 'PASSED' || i.status === 'SKIPPED').length;
  const failed = items.filter(i => i.status === 'FAILED').length;
  const blocked = items.filter(i => i.status === 'BLOCKED').length;
  const pending = items.filter(i => i.status === 'PENDING').length;
  const inProgress = items.filter(i => i.status === 'IN_PROGRESS').length;
  return { total, passed, failed, blocked, pending, inProgress };
}

export function MarkReleasedDialog({
  release,
  open,
  onClose,
}: {
  release: ReleaseDetail;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const markReleased = useMarkReleased(release.id);
  const updateRelease = useUpdateRelease(release.id);
  const [releaseNote, setReleaseNote] = useState('');
  const [blockerItems, setBlockerItems] = useState<ReleaseChecklistItem[]>([]);
  const [stage, setStage] = useState<'confirm' | 'blockers'>('confirm');

  const { total, passed, failed, pending, inProgress, blocked } = computeProgress(release.checklistItems);
  const blockerCount = failed + pending + inProgress + blocked;
  const allReady = blockerCount === 0;

  async function handleMark() {
    try {
      // Save release note first if provided
      if (releaseNote.trim()) {
        await updateRelease.mutateAsync({ description: releaseNote.trim() });
      }
      await markReleased.mutateAsync();
      toast.success('Release marked as completed!');
      onClose();
      router.push('/releases?tab=history');
    } catch (err) {
      const e = err as Error & { status?: number; body?: { blockers?: ReleaseChecklistItem[] } };
      if (e.status === 422 && e.body?.blockers?.length) {
        setBlockerItems(e.body.blockers);
        setStage('blockers');
      } else {
        toast.error(e.message ?? 'Failed to mark as released');
        onClose();
      }
    }
  }

  async function handleForce() {
    try {
      if (releaseNote.trim()) {
        await updateRelease.mutateAsync({ description: releaseNote.trim() });
      }
      await updateRelease.mutateAsync({ status: 'RELEASED' });
      toast.success('Release force-marked as completed');
      onClose();
      router.push('/releases?tab=history');
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to update');
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { onClose(); setStage('confirm'); setReleaseNote(''); } }}>
      <DialogContent className={cn('max-w-md animate-slide-in-up', allReady ? 'border-green-200 dark:border-green-800' : '')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {stage === 'blockers' ? (
              <><AlertTriangle className="w-5 h-5 text-red-500" /> Release has blockers</>
            ) : allReady ? (
              <><Rocket className="w-5 h-5 text-green-500" /> Ready to Release</>
            ) : (
              <><AlertTriangle className="w-5 h-5 text-amber-500" /> Mark as Released</>
            )}
          </DialogTitle>
        </DialogHeader>

        {stage === 'confirm' && (
          <div className="space-y-4">
            {/* Summary */}
            <div className={cn(
              'rounded-lg p-3 text-sm',
              allReady ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300'
                       : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300',
            )}>
              {allReady ? (
                <p>All <strong>{total}</strong> checklist items are resolved ({passed} passed). You're good to go!</p>
              ) : (
                <div className="space-y-1">
                  <p><strong>{blockerCount}</strong> item{blockerCount > 1 ? 's are' : ' is'} still unresolved:</p>
                  <ul className="text-xs space-y-0.5 ml-3">
                    {failed > 0 && <li>{failed} failed</li>}
                    {blocked > 0 && <li>{blocked} blocked</li>}
                    {(pending + inProgress) > 0 && <li>{pending + inProgress} not run</li>}
                  </ul>
                </div>
              )}
            </div>

            {/* Release note */}
            <div className="space-y-1.5">
              <Label>
                Release Note {!allReady && <span className="text-destructive">*</span>}
                <span className="text-muted-foreground text-xs ml-1">{allReady ? '(optional)' : '(required)'}</span>
              </Label>
              <ValidatedTextarea
                value={releaseNote}
                onChange={setReleaseNote}
                minRows={2}
                maxRows={5}
                maxLength={500}
                placeholder={allReady ? 'Add a release note...' : "Explain why you're releasing with unresolved items..."}
                validate={v => {
                  if (!allReady && !v.trim()) return { state: 'error', message: 'Release note is required when there are blockers' };
                  return { state: 'idle' };
                }}
                validateOn="change"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              {allReady ? (
                <SmartButton
                  onClick={handleMark}
                  loadingText="Releasing..."
                  successText="Released!"
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  <Rocket className="w-3.5 h-3.5 mr-1.5" /> Mark as Released
                </SmartButton>
              ) : (
                <SmartButton
                  onClick={handleMark}
                  disabled={!releaseNote.trim()}
                  loadingText="Releasing..."
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Force Release — I Accept Risk
                </SmartButton>
              )}
            </DialogFooter>
          </div>
        )}

        {stage === 'blockers' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">The following items are still blocking this release:</p>
            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
              {blockerItems.map(b => (
                <li key={b.id} className="flex items-center gap-2 text-sm p-1.5 rounded bg-red-50 dark:bg-red-950/20">
                  {itemStatusIcon(b.status)}
                  <span className="truncate">{b.title}</span>
                </li>
              ))}
            </ul>

            {/* Release note for force */}
            <div className="space-y-1.5">
              <Label>Release Note <span className="text-destructive">*</span></Label>
              <ValidatedTextarea
                value={releaseNote}
                onChange={setReleaseNote}
                minRows={2}
                maxRows={4}
                placeholder="Explain why you are force-releasing..."
                validate={v => {
                  if (!v.trim()) return { state: 'error', message: 'Required' };
                  return { state: 'idle' };
                }}
                validateOn="change"
              />
            </div>

            <DialogFooter className="flex-col gap-2">
              <Button variant="outline" onClick={onClose} className="w-full">Cancel</Button>
              <SmartButton
                onClick={handleForce}
                disabled={!releaseNote.trim()}
                loadingText="Releasing..."
                className="w-full bg-red-500 hover:bg-red-600 text-white"
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Force Release — I Accept Risk
              </SmartButton>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
