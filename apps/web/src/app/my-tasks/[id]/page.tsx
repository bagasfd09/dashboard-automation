'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  GitBranch,
  Calendar,
  AlertCircle,
  Plus,
  GripVertical,
  SkipForward,
  PlayCircle,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clipboard,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { SmartButton } from '@/components/ui/smart-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
  TaskGroupDetail,
  TaskGroupItem,
  TaskItemPersonalStatus,
  LibraryPickerData,
  LibraryPickerCollection,
  LibraryPickerTestCase,
} from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86_400_000);
  return `${days}d ago`;
}

function calcProgressPct(group: TaskGroupDetail) {
  if (group.items.length === 0) return 0;
  const done = group.items.filter(
    (i) => i.localResultStatus === 'PASSED' || i.personalStatus === 'SKIPPED',
  ).length;
  return Math.round((done / group.items.length) * 100);
}

function priorityColor(p: string) {
  if (p === 'P0') return 'text-red-600 dark:text-red-400';
  if (p === 'P1') return 'text-orange-500';
  if (p === 'P2') return 'text-blue-500';
  return 'text-muted-foreground';
}

function ResultBadge({ status, label, matchedAt }: { status: string | null; label: string; matchedAt: string | null }) {
  if (!status) {
    return <span className="text-xs text-muted-foreground">⬜ not run yet</span>;
  }
  if (status === 'PASSED') {
    return (
      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
        ✅ PASSED
        {matchedAt && <span className="text-muted-foreground">· {relativeTime(matchedAt)}</span>}
      </span>
    );
  }
  return (
    <span className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
      ❌ FAILED
      {matchedAt && <span className="text-muted-foreground">· {relativeTime(matchedAt)}</span>}
    </span>
  );
}

// ── Skip Modal ────────────────────────────────────────────────────────────────

interface SkipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemTitle: string;
  onConfirm: (reason: string) => Promise<void>;
}

function SkipModal({ open, onOpenChange, itemTitle, onConfirm }: SkipModalProps) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Skip Test Case</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{itemTitle}</p>
        <div className="space-y-1.5">
          <Label>Reason for skipping *</Label>
          <Textarea
            autoFocus
            placeholder="e.g. Blocked by API not ready, will test next sprint"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <SmartButton
            disabled={!reason.trim()}
            onClick={async () => {
              await onConfirm(reason.trim());
              setReason('');
              onOpenChange(false);
            }}
          >
            Skip
          </SmartButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Priority Badge ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const cls =
    priority === 'P0'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      : priority === 'P1'
        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
        : priority === 'P2'
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          : 'bg-muted text-muted-foreground';
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', cls)}>
      {priority}
    </span>
  );
}

// ── Library Picker Modal ──────────────────────────────────────────────────────

interface LibraryPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  existingIds: Set<string>;
  onAdded: () => void;
}

function LibraryPickerModal({ open, onOpenChange, groupId, existingIds, onAdded }: LibraryPickerModalProps) {
  const queryClient = useQueryClient();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [suggestionChecks, setSuggestionChecks] = useState<Set<string>>(new Set());

  const { data: pickerData, isLoading } = useQuery({
    queryKey: ['task-group-library-picker', groupId],
    queryFn: () => api.getTaskGroupLibraryPicker(groupId),
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!pickerData) return;
    if (pickerData.collections.length > 0 && selectedCollectionId === null) {
      setSelectedCollectionId(pickerData.collections[0].id);
    }
    const allSuggestionIds = new Set(
      pickerData.suggestions.items
        .filter((s) => !s.alreadyInThisGroup)
        .map((s) => s.id),
    );
    setSuggestionChecks(allSuggestionIds);
  }, [pickerData]);

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setSuggestionChecks(new Set());
      setSearch('');
      setPriorityFilter('ALL');
      setSelectedCollectionId(null);
    }
  }, [open]);

  const filteredCollections = pickerData?.collections.filter((c) =>
    search ? c.name.toLowerCase().includes(search.toLowerCase()) : true,
  ) ?? [];

  useEffect(() => {
    if (search && filteredCollections.length > 0) {
      setSelectedCollectionId(filteredCollections[0].id);
    }
  }, [search]);

  const activeCollection = pickerData?.collections.find((c) => c.id === selectedCollectionId) ?? null;

  const visibleTestCases = (activeCollection?.testCases ?? []).filter((tc) =>
    priorityFilter === 'ALL' ? true : tc.priority === priorityFilter,
  );

  const selectableVisible = visibleTestCases.filter((tc) => !tc.alreadyInThisGroup);

  const allVisibleSelected =
    selectableVisible.length > 0 &&
    selectableVisible.every((tc) => selectedIds.has(tc.id));

  const toggleTestCase = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSuggestion = (id: string) => {
    setSuggestionChecks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        selectableVisible.forEach((tc) => next.delete(tc.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        selectableVisible.forEach((tc) => next.add(tc.id));
        return next;
      });
    }
  };

  const totalSelected = new Set([
    ...Array.from(selectedIds),
    ...Array.from(suggestionChecks),
  ]).size;

  const addMutation = useMutation({
    mutationFn: () => {
      const allSelected = [...selectedIds, ...Array.from(suggestionChecks)];
      const unique = [...new Set(allSelected)].filter((id) => !existingIds.has(id));
      return api.addTaskGroupItems(groupId, unique);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['task-group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['task-group-library-picker', groupId] });
      toast.success(`Added ${result.added} test case${result.added !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      setSuggestionChecks(new Set());
      onAdded();
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to add test cases'),
  });

  const suggestions = pickerData?.suggestions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] flex flex-col max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add Test Cases from Library</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3 px-6 pb-4">
          {suggestions && suggestions.count > 0 && (
            <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 shrink-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  ⚡ Smart Suggestions — {suggestions.count} critical (P0) test cases
                </span>
                <button
                  className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
                  onClick={() => {
                    const nonAdded = suggestions.items
                      .filter((s) => !s.alreadyInThisGroup)
                      .map((s) => s.id);
                    setSuggestionChecks(new Set(nonAdded));
                  }}
                >
                  Select All
                </button>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                Pre-selected based on your task group's application
              </p>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {suggestions.items.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center gap-2 py-1',
                      s.alreadyInThisGroup && 'opacity-50',
                    )}
                  >
                    <Checkbox
                      checked={suggestionChecks.has(s.id)}
                      disabled={s.alreadyInThisGroup}
                      onCheckedChange={() => !s.alreadyInThisGroup && toggleSuggestion(s.id)}
                    />
                    <span className="text-sm flex-1 truncate">{s.title}</span>
                    {s.collection && (
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                        {s.collection.name}
                      </span>
                    )}
                    <PriorityBadge priority={s.priority} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">Or browse by collection</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex flex-1 overflow-hidden gap-0 border rounded-lg min-h-0">
            <div className="w-48 flex-shrink-0 border-r flex flex-col overflow-hidden">
              <Input
                placeholder="Search collections..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-none border-0 border-b focus-visible:ring-0 text-xs"
              />
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="p-3 text-xs text-muted-foreground">Loading...</div>
                ) : filteredCollections.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">No collections found</div>
                ) : (
                  filteredCollections.map((col) => {
                    const isActive = col.id === selectedCollectionId;
                    const icon = col.icon ?? col.name.charAt(0).toUpperCase();
                    return (
                      <div
                        key={col.id}
                        onClick={() => setSelectedCollectionId(col.id)}
                        className={cn(
                          'px-3 py-2 cursor-pointer flex items-center gap-2',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted/50',
                          col.availableCount === 0 && 'opacity-50',
                        )}
                      >
                        <span className="text-base leading-none shrink-0">{icon}</span>
                        <span className="text-xs font-medium flex-1 truncate">{col.name}</span>
                        {col.availableCount === 0 ? (
                          <span className="text-[10px] bg-muted rounded-full px-1.5 py-0.5 shrink-0">
                            All added
                          </span>
                        ) : (
                          <span className="text-[10px] bg-muted rounded-full px-1.5 shrink-0">
                            {col.availableCount}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              {activeCollection ? (
                <>
                  <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2 shrink-0">
                    <span className="text-base leading-none">
                      {activeCollection.icon ?? activeCollection.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium">{activeCollection.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({activeCollection.totalCount} test cases)
                    </span>
                  </div>

                  <div className="px-4 py-2 border-b flex gap-1.5 shrink-0">
                    {(['ALL', 'P0', 'P1', 'P2', 'P3'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriorityFilter(p)}
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full border transition-colors',
                          priorityFilter === p
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:bg-muted/50',
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <div
                    className="px-4 py-2 border-b bg-muted/20 flex items-center gap-2 shrink-0 cursor-pointer"
                    onClick={toggleSelectAll}
                  >
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-xs text-muted-foreground">
                      Select all ({selectableVisible.length} available)
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y">
                    {visibleTestCases.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        No test cases match this filter
                      </div>
                    ) : (
                      visibleTestCases.map((tc) => {
                        const disabled = tc.alreadyInThisGroup;
                        const checked = selectedIds.has(tc.id);
                        return (
                          <div
                            key={tc.id}
                            onClick={() => !disabled && toggleTestCase(tc.id)}
                            className={cn(
                              'px-4 py-2.5 flex items-center gap-3',
                              disabled ? 'opacity-50' : 'hover:bg-muted/40 cursor-pointer',
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={() => !disabled && toggleTestCase(tc.id)}
                            />
                            <span className="flex-1 text-sm line-clamp-2">{tc.title}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <PriorityBadge priority={tc.priority} />
                              {tc.alreadyInThisGroup ? (
                                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                  ✓ Already added
                                </span>
                              ) : tc.otherGroups.length > 0 ? (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clipboard className="h-3 w-3" />
                                  {tc.otherGroups[0].name}
                                </span>
                              ) : null}
                              {tc.status === 'DRAFT' && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                                  Draft
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                  Select a collection
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-3 flex items-center justify-between shrink-0">
            <span className={cn('text-sm text-muted-foreground', totalSelected > 0 && 'font-medium')}>
              Selected: {totalSelected} test case{totalSelected !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <SmartButton
                disabled={totalSelected === 0}
                disabledReason={totalSelected === 0 ? 'Select at least one test case' : undefined}
                loading={addMutation.isPending}
                onClick={async () => { await addMutation.mutateAsync(); }}
              >
                Add {totalSelected > 0 ? `${totalSelected} ` : ''}to Task Group
              </SmartButton>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Task Item Row ─────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: TaskGroupItem;
  index: number;
  isDetailed: boolean;
  groupId: string;
  onRemove: () => void;
}

function TaskItemRow({ item, index, isDetailed, groupId, onRemove }: ItemRowProps) {
  const queryClient = useQueryClient();
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(item.note ?? '');
  const [skipOpen, setSkipOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const worksLocalFailsStaging =
    item.localResultStatus === 'PASSED' && item.envResultStatus === 'FAILED';

  const updateMutation = useMutation({
    mutationFn: (data: { personalStatus?: TaskItemPersonalStatus; skippedReason?: string | null; note?: string | null }) =>
      api.updateTaskGroupItem(groupId, item.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-group', groupId] });
    },
  });

  const toggleStatus = () => {
    const next: TaskItemPersonalStatus =
      item.personalStatus === 'NOT_STARTED' ? 'IN_PROGRESS' : 'NOT_STARTED';
    updateMutation.mutate({ personalStatus: next });
  };

  const latestResultLabel = () => {
    if (item.envResultStatus === 'PASSED') return { label: '✅ staging', cls: 'text-green-600 dark:text-green-400' };
    if (item.envResultStatus === 'FAILED') {
      return {
        label: worksLocalFailsStaging ? '❌ staging ⚠️' : '❌ staging',
        cls: 'text-red-500',
      };
    }
    if (item.localResultStatus === 'PASSED') return { label: '✅ local', cls: 'text-blue-500' };
    if (item.localResultStatus === 'FAILED') return { label: '❌ local', cls: 'text-red-500' };
    return null;
  };

  const personalStatusIcon = () => {
    if (item.personalStatus === 'SKIPPED') return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    if (item.personalStatus === 'IN_PROGRESS') return <PlayCircle className="h-4 w-4 text-blue-500" />;
    return <Circle className="h-4 w-4 text-muted-foreground/40" />;
  };

  const latest = latestResultLabel();

  if (isDetailed) {
    return (
      <div className={cn('border-b last:border-b-0 p-4', worksLocalFailsStaging && 'bg-amber-50/30 dark:bg-amber-950/10')}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-sm text-muted-foreground mt-0.5 w-5 shrink-0">{index + 1}.</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{item.libraryTestCase.title}</span>
                <span className={cn('text-xs font-medium', priorityColor(item.libraryTestCase.priority))}>
                  {item.libraryTestCase.priority}
                </span>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                {item.libraryTestCase.collection && (
                  <span>{item.libraryTestCase.collection.name}</span>
                )}
                <Link
                  href={`/library/test-cases/${item.libraryTestCaseId}`}
                  className="hover:text-primary flex items-center gap-0.5"
                >
                  View in Library <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              {/* Dual result columns */}
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">My Branch</p>
                  <ResultBadge
                    status={item.localResultStatus}
                    label="local"
                    matchedAt={item.localMatchedAt}
                  />
                  {item.localTestRunId && item.localResultStatus && (
                    <Link
                      href={`/runs/${item.localTestRunId}`}
                      className="text-xs text-muted-foreground hover:text-primary mt-0.5 flex items-center gap-1"
                    >
                      View Run <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Staging</p>
                  <ResultBadge
                    status={item.envResultStatus}
                    label="staging"
                    matchedAt={item.envMatchedAt}
                  />
                  {item.envTestRunId && item.envResultStatus && (
                    <Link
                      href={`/runs/${item.envTestRunId}`}
                      className="text-xs text-muted-foreground hover:text-primary mt-0.5 flex items-center gap-1"
                    >
                      View Run <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>

              {worksLocalFailsStaging && (
                <div className="flex items-center gap-2 mt-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Passes locally but FAILS on staging — possible merge conflict or env issue
                </div>
              )}

              {/* Note */}
              {item.note && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {item.note}
                </p>
              )}
              {item.personalStatus === 'SKIPPED' && item.skippedReason && (
                <p className="text-xs text-muted-foreground italic mt-1">
                  Skipped: {item.skippedReason}
                </p>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {item.personalStatus !== 'SKIPPED' && (
                <DropdownMenuItem onClick={toggleStatus}>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  {item.personalStatus === 'NOT_STARTED' ? 'Mark In Progress' : 'Mark Not Started'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setSkipOpen(true)}>
                <SkipForward className="h-4 w-4 mr-2" />
                Skip
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowNote(!showNote)}>
                <FileText className="h-4 w-4 mr-2" />
                {item.note ? 'Edit Note' : 'Add Note'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setRemoveOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {showNote && (
          <div className="mt-3 flex gap-2">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="text-sm"
            />
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                onClick={() => {
                  updateMutation.mutate({ note: noteText.trim() || null });
                  setShowNote(false);
                }}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNote(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <SkipModal
          open={skipOpen}
          onOpenChange={setSkipOpen}
          itemTitle={item.libraryTestCase.title}
          onConfirm={async (reason) => { await updateMutation.mutateAsync({ personalStatus: 'SKIPPED', skippedReason: reason }); }}
        />
        <ConfirmDialog
          open={removeOpen}
          onOpenChange={setRemoveOpen}
          title="Remove test case"
          description={`Remove "${item.libraryTestCase.title}" from this task group?`}
          confirmText="Remove"
          variant="danger"
          onConfirm={async () => { await onRemove(); }}
        />
      </div>
    );
  }

  // Simple view
  return (
    <tr className={cn('border-b last:border-b-0', worksLocalFailsStaging && 'bg-amber-50/30 dark:bg-amber-950/10')}>
      <td className="px-4 py-2.5 text-sm text-muted-foreground w-8">{index + 1}</td>
      <td className="px-2 py-2.5">
        <div className="text-sm font-medium">{item.libraryTestCase.title}</div>
        {item.personalStatus === 'SKIPPED' && (
          <div className="text-xs text-muted-foreground italic">{item.skippedReason}</div>
        )}
      </td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-1.5">
          {personalStatusIcon()}
          <span className="text-xs text-muted-foreground">
            {item.personalStatus === 'NOT_STARTED'
              ? 'Not Started'
              : item.personalStatus === 'IN_PROGRESS'
                ? 'In Progress'
                : 'Skipped'}
          </span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        {latest ? (
          <span className={cn('text-xs', latest.cls)}>
            {latest.label}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-2 py-2.5 w-8">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {item.personalStatus !== 'SKIPPED' && (
              <DropdownMenuItem onClick={toggleStatus}>
                {item.personalStatus === 'NOT_STARTED' ? 'Mark In Progress' : 'Mark Not Started'}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setSkipOpen(true)}>Skip</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setRemoveOpen(true)}
            >
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <SkipModal
          open={skipOpen}
          onOpenChange={setSkipOpen}
          itemTitle={item.libraryTestCase.title}
          onConfirm={async (reason) => { await updateMutation.mutateAsync({ personalStatus: 'SKIPPED', skippedReason: reason }); }}
        />
        <ConfirmDialog
          open={removeOpen}
          onOpenChange={setRemoveOpen}
          title="Remove test case"
          description={`Remove "${item.libraryTestCase.title}" from this task group?`}
          confirmText="Remove"
          variant="danger"
          onConfirm={async () => { await onRemove(); }}
        />
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TaskGroupDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isDetailed, setIsDetailed] = useState(false);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);

  const { data: group, isLoading } = useQuery({
    queryKey: ['task-group', id],
    queryFn: () => api.getTaskGroup(id),
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => api.removeTaskGroupItem(id, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-group', id] });
      toast.success('Item removed');
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="h-6 bg-muted rounded w-1/4 animate-pulse" />
        <div className="h-8 bg-muted rounded w-1/2 animate-pulse" />
        <div className="h-2 bg-muted rounded w-full animate-pulse" />
        <div className="space-y-2 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Task group not found</p>
        <Button variant="link" onClick={() => router.push('/my-tasks')}>← Back to My Tasks</Button>
      </div>
    );
  }

  const pct = calcProgressPct(group);
  const existingIds = new Set(group.items.map((i) => i.libraryTestCaseId));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link href="/my-tasks" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to My Tasks
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">{group.name}</h1>
        <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
          {group.branch && (
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {group.branch}
            </span>
          )}
          {group.application && (
            <span>{group.application.icon} {group.application.name}</span>
          )}
          {group.dueDate && (
            <span className={cn('flex items-center gap-1', group.isOverdue && 'text-red-500')}>
              {group.isOverdue && <AlertCircle className="h-3 w-3" />}
              <Calendar className="h-3 w-3" />
              Due {fmtDate(group.dueDate)}
              {group.isOverdue && ' (OVERDUE)'}
            </span>
          )}
          {group.createdById !== group.userId && (
            <span>Assigned by {group.createdBy.name}</span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Progress</span>
            <span className="font-medium">
              {group.items.filter((i) => i.localResultStatus === 'PASSED' || i.personalStatus === 'SKIPPED').length}/{group.items.length} ({pct}%)
            </span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setIsDetailed(false)}
          className={cn(
            'px-3 py-1 rounded text-sm transition-colors',
            !isDetailed ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Simple View
        </button>
        <button
          onClick={() => setIsDetailed(true)}
          className={cn(
            'px-3 py-1 rounded text-sm transition-colors',
            isDetailed ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Detailed View
        </button>
      </div>

      {/* Items */}
      {group.items.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed rounded-xl">
          <p className="text-muted-foreground text-sm mb-3">No test cases in this group yet.</p>
          <Button onClick={() => setBulkAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add test cases from Library
          </Button>
        </div>
      ) : isDetailed ? (
        <div className="border rounded-xl overflow-hidden">
          {group.items.map((item, idx) => (
            <TaskItemRow
              key={item.id}
              item={item}
              index={idx}
              isDetailed={true}
              groupId={id}
              onRemove={() => removeMutation.mutateAsync(item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-muted-foreground font-medium w-8">#</th>
                <th className="px-2 py-2 text-left text-xs text-muted-foreground font-medium">Title</th>
                <th className="px-2 py-2 text-left text-xs text-muted-foreground font-medium">Status</th>
                <th className="px-4 py-2 text-left text-xs text-muted-foreground font-medium">Latest Result</th>
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {group.items.map((item, idx) => (
                <TaskItemRow
                  key={item.id}
                  item={item}
                  index={idx}
                  isDetailed={false}
                  groupId={id}
                  onRemove={() => removeMutation.mutateAsync(item.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add button */}
      {group.items.length > 0 && (
        <Button variant="outline" onClick={() => setBulkAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add test cases from Library
        </Button>
      )}

      {/* Library picker modal */}
      <LibraryPickerModal
        open={bulkAddOpen}
        onOpenChange={setBulkAddOpen}
        groupId={id}
        existingIds={existingIds}
        onAdded={() => queryClient.invalidateQueries({ queryKey: ['task-group', id] })}
      />
    </div>
  );
}
