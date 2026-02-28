'use client';

import { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SmartButton } from '@/components/ui/smart-button';
import { useRunTestCaseCandidates, useCreateLibraryTestCase } from '@/hooks/use-library';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { RunTestCaseCandidate, TestStatus } from '@/lib/types';

function statusBadge(status: TestStatus) {
  switch (status) {
    case 'PASSED':  return <Badge className="text-[9px] bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">PASSED</Badge>;
    case 'FAILED':  return <Badge className="text-[9px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">FAILED</Badge>;
    case 'SKIPPED': return <Badge variant="secondary" className="text-[9px]">SKIPPED</Badge>;
    default:        return <Badge variant="secondary" className="text-[9px]">{status}</Badge>;
  }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function ImportFromRunsDialog({
  collectionId,
  existingTitles,
  open,
  onClose,
}: {
  collectionId: string;
  existingTitles: string[];
  open: boolean;
  onClose: () => void;
}) {
  const { data: candidates = [], isLoading } = useRunTestCaseCandidates();
  const createTestCase = useCreateLibraryTestCase();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Group by run
  const groupedByRun = useMemo(() => {
    const groups = new Map<string, { runId: string; runDate: string; teamName: string | null; items: RunTestCaseCandidate[] }>();
    for (const c of candidates) {
      if (!groups.has(c.runId)) {
        groups.set(c.runId, { runId: c.runId, runDate: c.runStartedAt, teamName: c.teamName, items: [] });
      }
      groups.get(c.runId)!.items.push(c);
    }
    return Array.from(groups.values()).sort((a, b) => new Date(b.runDate).getTime() - new Date(a.runDate).getTime());
  }, [candidates]);

  // Similar title detection
  function hasSimilarTitle(title: string): boolean {
    const lower = title.toLowerCase();
    return existingTitles.some(t => t.toLowerCase().includes(lower) || lower.includes(t.toLowerCase()));
  }

  function toggleItem(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    const items = candidates.filter(c => selected.has(c.id) && !c.alreadyInLibrary);
    if (items.length === 0) return;

    for (const item of items) {
      await createTestCase.mutateAsync({
        title: item.title,
        collectionId,
        priority: 'P2',
        difficulty: 'MEDIUM',
        tags: [],
      });
    }

    toast.success(`${items.length} test case${items.length > 1 ? 's' : ''} imported as DRAFT`);
    setSelected(new Set());
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col p-0 animate-slide-in-up">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" /> Import from Member Runs
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Download className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No test cases to import</p>
              <p className="text-xs text-muted-foreground mt-1">
                {/* TODO: This is a stub — backend API not yet implemented */}
                Run some tests first, then come back to import test cases into the library.
              </p>
            </div>
          ) : (
            groupedByRun.map(group => (
              <div key={group.runId} className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span className="font-medium">{fmtDate(group.runDate)}</span>
                  {group.teamName && <Badge variant="outline" className="text-[9px]">{group.teamName}</Badge>}
                </div>
                {group.items.map(item => {
                  const isSelected = selected.has(item.id);
                  const isSimilar = hasSimilarTitle(item.title);
                  return (
                    <div
                      key={item.id}
                      onClick={() => !item.alreadyInLibrary && toggleItem(item.id)}
                      className={cn(
                        'flex items-start gap-3 p-2.5 border rounded-lg text-sm transition-colors',
                        item.alreadyInLibrary ? 'opacity-40 cursor-not-allowed border-border bg-muted/20' :
                        isSelected ? 'border-primary bg-primary/5 cursor-pointer' : 'border-border hover:bg-muted/50 cursor-pointer',
                      )}
                    >
                      <div className={cn(
                        'w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center',
                        isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/50',
                        item.alreadyInLibrary && 'bg-muted',
                      )}>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-xs">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{item.filePath}</p>
                        {isSimilar && !item.alreadyInLibrary && (
                          <p className="text-[10px] text-amber-500 mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> Similar title already in library
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        {statusBadge(item.status)}
                        {item.alreadyInLibrary && (
                          <span className="text-[10px] text-muted-foreground">In library</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Sticky footer */}
        <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-background shrink-0">
          <span className="text-xs text-muted-foreground">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <SmartButton
              size="sm"
              onClick={handleImport}
              disabled={selected.size === 0}
              loadingText="Importing..."
              successText="Imported!"
            >
              Import {selected.size > 0 ? `${selected.size} ` : ''}→
            </SmartButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
