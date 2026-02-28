'use client';

import { useState } from 'react';
import { Clock, Eye, RotateCcw, History, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVersions, useRollbackVersion } from '@/hooks/use-library';
import { formatTimeAgo } from '@/components/library-badges';
import { parseSteps } from '@/lib/steps-utils';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { LibraryTestCaseVersion } from '@/lib/types';

function ViewVersionModal({ version, open, onClose }: { version: LibraryTestCaseVersion | null; open: boolean; onClose: () => void }) {
  if (!version) return null;
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">v{version.version}</Badge>
            {version.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {version.changeNotes && (
            <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs italic text-muted-foreground">
              {version.changeNotes}
            </div>
          )}
          {version.description && (
            <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p><p className="leading-relaxed">{version.description}</p></div>
          )}
          {version.preconditions && (
            <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preconditions</p><p className="whitespace-pre-wrap">{version.preconditions}</p></div>
          )}
          {version.steps && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Steps</p>
              {parseSteps(version.steps).map(s => (
                <div key={s.id} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{s.num}</span>
                  <p className="pt-0.5">{s.text}</p>
                </div>
              ))}
            </div>
          )}
          {version.expectedOutcome && (
            <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expected Outcome</p><p className="whitespace-pre-wrap">{version.expectedOutcome}</p></div>
          )}
          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            Created by {version.createdBy?.name ?? 'Unknown'} · {formatTimeAgo(version.createdAt)}
          </p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function HistoryTab({ id, canManage }: { id: string; canManage: boolean; currentTitle?: string }) {
  const { data, isLoading } = useVersions(id);
  const rollback = useRollbackVersion(id);
  const [confirmVersion, setConfirmVersion] = useState<LibraryTestCaseVersion | null>(null);
  const [viewVersion, setViewVersion] = useState<LibraryTestCaseVersion | null>(null);
  const versions = data?.data ?? [];
  const nextVersion = (versions[0]?.version ?? 0) + 1;

  const doRollback = async (v: LibraryTestCaseVersion) => {
    try {
      await rollback.mutateAsync(v.version);
      toast.success(`Rolled back to v${v.version} — saved as v${nextVersion}`);
      setConfirmVersion(null);
    } catch { toast.error('Rollback failed'); }
  };

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>;
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <History className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">No version history yet</p>
        <p className="text-xs text-muted-foreground mt-1">Versions are automatically created when the test case is edited.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {versions.map((v, i) => (
        <div key={v.id} className="flex gap-4 pb-6 last:pb-0">
          {/* Timeline line */}
          <div className="flex flex-col items-center pt-1">
            <div className={cn('w-3 h-3 rounded-full border-2 shrink-0',
              i === 0 ? 'bg-primary border-primary' : 'bg-muted border-border')} />
            {i < versions.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={i === 0 ? 'default' : 'outline'} className="font-mono text-xs">
                    v{v.version}{i === 0 ? ' (latest)' : ''}
                  </Badge>
                  <span className="text-sm font-medium truncate">{v.title}</span>
                </div>
                {v.changeNotes && (
                  <p className="text-xs text-muted-foreground italic">&ldquo;{v.changeNotes}&rdquo;</p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {v.createdBy?.name ?? 'Unknown'} · {formatTimeAgo(v.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setViewVersion(v)}>
                  <Eye className="w-3.5 h-3.5 mr-1.5" />View
                </Button>
                {canManage && i > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setConfirmVersion(v)}
                    disabled={rollback.isPending}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Restore
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* View version modal */}
      <ViewVersionModal version={viewVersion} open={!!viewVersion} onClose={() => setViewVersion(null)} />

      {/* Rollback confirm */}
      <Dialog open={!!confirmVersion} onOpenChange={o => !o && setConfirmVersion(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Restore v{confirmVersion?.version}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will create <strong>v{nextVersion}</strong> with the content from v{confirmVersion?.version}.
            The current version is saved automatically.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmVersion(null)}>Cancel</Button>
            <Button onClick={() => confirmVersion && doRollback(confirmVersion)} disabled={rollback.isPending}>
              {rollback.isPending ? 'Restoring…' : 'Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
