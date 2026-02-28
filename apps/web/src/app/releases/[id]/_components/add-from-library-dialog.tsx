'use client';

import { useState } from 'react';
import { CheckCircle2, Search, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SmartButton } from '@/components/ui/smart-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddChecklistItem } from '@/hooks/use-releases';
import { useLibraryTestCases, useCollections } from '@/hooks/use-library';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { TestPriority } from '@/lib/types';

const priorityColors: Record<TestPriority, string> = {
  P0: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  P1: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  P2: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  P3: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export function AddFromLibraryDialog({
  releaseId,
  existingLibraryIds,
  open,
  onClose,
}: {
  releaseId: string;
  existingLibraryIds: string[];
  open: boolean;
  onClose: () => void;
}) {
  const addItem = useAddChecklistItem(releaseId);
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('__all__');
  const [collection, setCollection] = useState('__all__');
  const [selected, setSelected] = useState<string[]>([]);

  const { data: collections = [] } = useCollections();

  const { data: testCasesData } = useLibraryTestCases({
    search: search || undefined,
    priority: (priority !== '__all__' ? priority as TestPriority : undefined),
    collectionId: collection !== '__all__' ? collection : undefined,
    status: 'ACTIVE',
    pageSize: 50,
  });
  const testCases = testCasesData?.data ?? [];

  // Separate available from already-added
  const available = testCases.filter(tc => !existingLibraryIds.includes(tc.id));
  const alreadyAdded = testCases.filter(tc => existingLibraryIds.includes(tc.id));

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  // Quick add helpers
  function selectByPriority(...priorities: TestPriority[]) {
    const ids = available.filter(tc => priorities.includes(tc.priority)).map(tc => tc.id);
    setSelected(prev => Array.from(new Set([...prev, ...ids])));
  }

  async function handleAdd() {
    if (selected.length === 0) return;
    const tcs = testCases.filter(tc => selected.includes(tc.id));
    for (const tc of tcs) {
      await addItem.mutateAsync({ type: 'AUTOMATED_TEST', title: tc.title, libraryTestCaseId: tc.id });
    }
    toast.success(`${selected.length} item${selected.length > 1 ? 's' : ''} added`);
    setSelected([]);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[680px] max-h-[85vh] flex flex-col p-0 animate-slide-in-up">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>Add from Library</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Left: Filters */}
          <div className="w-48 border-r border-border p-4 space-y-4 shrink-0">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Collection</label>
              <Select value={collection} onValueChange={setCollection}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Collections</SelectItem>
                  {collections.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Priorities</SelectItem>
                  {(['P0', 'P1', 'P2', 'P3'] as const).map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Quick Add</label>
              <div className="space-y-1">
                <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7" onClick={() => selectByPriority('P0')}>
                  + All P0
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7" onClick={() => selectByPriority('P0', 'P1')}>
                  + All P0+P1
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Scrollable list */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Search */}
            <div className="px-4 py-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search test cases..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
              {available.length === 0 && alreadyAdded.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No active test cases found</p>
              )}
              {available.map(tc => {
                const isSelected = selected.includes(tc.id);
                return (
                  <div
                    key={tc.id}
                    onClick={() => toggle(tc.id)}
                    className={cn(
                      'flex items-start gap-3 p-2.5 border rounded-lg text-sm transition-colors cursor-pointer',
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                    )}
                  >
                    <div className={cn('w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center',
                      isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/50')}>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-xs">{tc.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        {tc.collection && <span>{tc.collection.name}</span>}
                        <Badge className={cn('text-[8px] rounded px-1 py-0', priorityColors[tc.priority])}>{tc.priority}</Badge>
                        {tc.tags?.slice(0, 2).map(t => <span key={t} className="text-muted-foreground/60">{t}</span>)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Already added section */}
              {alreadyAdded.length > 0 && (
                <div className="pt-3 mt-3 border-t border-border">
                  <p className="text-[10px] font-medium text-muted-foreground mb-2">Already in this release</p>
                  {alreadyAdded.map(tc => (
                    <div key={tc.id} className="flex items-center gap-3 p-2 rounded-lg opacity-50 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="truncate">{tc.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-background">
              <span className="text-xs text-muted-foreground">
                {selected.length} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <SmartButton
                  size="sm"
                  onClick={handleAdd}
                  disabled={selected.length === 0}
                  loadingText="Adding..."
                  successText="Added!"
                >
                  Add {selected.length > 0 ? `${selected.length} ` : ''}Selected
                </SmartButton>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
