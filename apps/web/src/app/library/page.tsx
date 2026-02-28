'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen, Plus, Search, BarChart3, Bookmark, Wand2, Layers,
  Check, X, ChevronRight, ChevronDown, ChevronUp, AlertTriangle, TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CollectionGridSkeleton, CoverageSkeleton } from '@/components/skeletons';
import { CoverageBar, PriorityBadge, LibraryStatusBadge, SuggestionTypeBadge, formatTimeAgo } from '@/components/library-badges';
import {
  useCollections, useCreateCollection, useCoverageStats, useCoverageGaps,
  useBookmarks, useAllSuggestions, useReviewSuggestion,
} from '@/hooks/use-library';
import { useTeams } from '@/hooks/use-teams';
import { useAuth } from '@/providers/AuthProvider';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { SmartButton } from '@/components/ui/smart-button';
import { ValidatedInput } from '@/components/ui/validated-input';
import { ValidatedTextarea } from '@/components/ui/validated-textarea';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import type { SuggestionStatus } from '@/lib/types';

// ── New Collection Card (inline creation) ───────────────────────────────────

function NewCollectionCard() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📁');
  const [teamId, setTeamId] = useState('__global__');
  const { data: teams } = useTeams();
  const create = useCreateCollection();
  const nameRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName(''); setDescription(''); setIcon('📁'); setTeamId('__global__'); setOpen(false);
  };

  const submit = async () => {
    if (!name.trim()) return;
    await create.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      icon: icon || undefined,
      teamId: teamId === '__global__' ? undefined : teamId,
    });
    toast.success('Collection created', {
      action: { label: 'Undo', onClick: () => { /* TODO: implement undo */ } },
    });
    reset();
  };

  useEffect(() => {
    if (open) setTimeout(() => nameRef.current?.focus(), 50);
  }, [open]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border-2 border-dashed border-border hover:border-primary/50 rounded-lg p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all group min-h-[160px]"
      >
        <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
          <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </div>
        <span className="text-sm font-medium">New Collection</span>
      </button>
    );
  }

  return (
    <Card className="border-primary/40 bg-primary/5 animate-in slide-in-from-top-2 duration-200">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex gap-2 items-center">
          <EmojiPicker value={icon} onChange={setIcon} />
          <div className="flex-1">
            <ValidatedInput
              value={name}
              onChange={setName}
              placeholder="Collection name…"
              validate={v => {
                if (v.length > 0 && v.trim().length < 2) return { state: 'error', message: 'Min 2 characters' };
                if (v.trim().length >= 2) return { state: 'valid' };
                return { state: 'idle' };
              }}
              validateOn="change"
            />
          </div>
        </div>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') reset(); }}
          placeholder="Short description (optional)"
          rows={2}
          className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
        />
        <div className="flex items-center justify-between gap-2">
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="h-7 text-xs w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__global__">Global — all teams</SelectItem>
              {teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <button
              onClick={reset}
              className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded"
            >
              Cancel
            </button>
            <SmartButton
              onClick={submit}
              disabled={!name.trim()}
              loadingText="Creating…"
              successText="Created!"
              size="sm"
            >
              Create
            </SmartButton>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Collection Card ─────────────────────────────────────────────────────────

function CollectionCard({ col }: { col: ReturnType<typeof useCollections>['data'] extends (infer T)[] | undefined ? T : never }) {
  const count = col._count?.testCases ?? 0;
  return (
    <Link href={`/library/collections/${col.id}`}>
      <Card className="bg-card border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl leading-none shrink-0">{col.icon ?? '📁'}</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm group-hover:text-primary transition-colors leading-snug">
                  {col.name}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {col.team?.name ?? 'Global'}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0 tabular-nums text-xs font-semibold">
              {count}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3 pt-0">
          {col.description ? (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1">
              {col.description}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic flex-1">No description</p>
          )}

          {/* Coverage bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{count > 0 ? `${count} test ${count === 1 ? 'case' : 'cases'}` : 'Empty collection'}</span>
              <span className="flex items-center gap-1">
                {formatTimeAgo(col.updatedAt)}
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
            <CoverageBar value={count > 0 ? Math.min(100, count * 5) : 0} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Collections Tab ─────────────────────────────────────────────────────────

function CollectionsTab({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useState('');
  const { data: collections, isLoading } = useCollections();

  const filtered = (collections ?? []).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 bg-muted rounded-md animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const showEmpty = filtered.length === 0 && !canManage;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search collections…" className="pl-9" />
      </div>

      {showEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Layers className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-semibold text-sm">
            {search ? 'No collections match your search' : 'No collections yet'}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
            {search ? 'Try a different keyword.' : 'No collections have been created yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {canManage && !search && <NewCollectionCard />}
          {filtered.map(col => <CollectionCard key={col.id} col={col} />)}
          {filtered.length === 0 && search && (
            <div className="col-span-full text-center py-8 text-sm text-muted-foreground">
              No collections match &ldquo;{search}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Coverage Tab ────────────────────────────────────────────────────────────

function CoverageTab({ canManage }: { canManage: boolean }) {
  const { data: stats, isLoading: statsLoading } = useCoverageStats();
  const { data: gaps, isLoading: gapsLoading } = useCoverageGaps();
  const { data: collections } = useCollections();

  if (statsLoading) return <CoverageSkeleton />;

  const gapList = (Array.isArray(gaps) ? gaps : []) as {
    id: string; title: string; priority: string; createdAt: string;
    collection?: { id: string; name: string } | null;
  }[];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-5 space-y-1">
            <p className="text-xs text-muted-foreground">Total Library Tests</p>
            <p className="text-3xl font-bold">{stats?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card className={cn('bg-card border-border', (stats?.coverage ?? 0) < 50 && 'border-red-200 dark:border-red-800')}>
          <CardContent className="pt-5 pb-5 space-y-2">
            <p className="text-xs text-muted-foreground">Overall Coverage</p>
            <p className="text-3xl font-bold">{(stats?.coverage ?? 0).toFixed(0)}%</p>
            <CoverageBar value={stats?.coverage ?? 0} />
          </CardContent>
        </Card>
        <Card className={cn('bg-card border-border', gapList.length > 0 && 'border-orange-200 dark:border-orange-800')}>
          <CardContent className="pt-5 pb-5 space-y-1">
            <p className="text-xs text-muted-foreground">Coverage Gaps</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold">{gapList.length}</p>
              {gapList.length > 0 && (
                <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400">
                  <AlertTriangle className="w-3 h-3 mr-1" />needs attention
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By Status / Priority breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm">By Status</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {(stats?.byStatus ?? []).map(s => (
              <div key={s.status} className="flex items-center justify-between">
                <LibraryStatusBadge status={s.status} />
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary/50" style={{ width: `${stats?.total ? (s.count / stats.total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-semibold w-8 text-right">{s.count}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm">By Priority</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {(stats?.byPriority ?? []).map(p => (
              <div key={p.priority} className="flex items-center justify-between">
                <PriorityBadge priority={p.priority} />
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary/50" style={{ width: `${stats?.total ? (p.count / stats.total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-semibold w-8 text-right">{p.count}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Collections coverage table */}
      {(collections ?? []).length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm">By Collection</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {(collections ?? []).map(col => {
                const count = col._count?.testCases ?? 0;
                return (
                  <Link key={col.id} href={`/library/collections/${col.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                    <span className="text-lg shrink-0">{col.icon ?? '📁'}</span>
                    <span className="text-sm font-medium flex-1 min-w-0 truncate">{col.name}</span>
                    <span className="text-xs text-muted-foreground w-20 text-right">{count} tests</span>
                    <div className="w-20 hidden sm:block">
                      <CoverageBar value={count > 0 ? Math.min(100, count * 5) : 0} />
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gaps */}
      {gapList.length > 0 && (
        <Card className="bg-card border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="w-4 h-4" />
              Coverage Gaps — Active tests with no linked run ({gapList.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {gapList.slice(0, 15).map(g => (
                <Link key={g.id} href={`/library/test-cases/${g.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors">
                  <PriorityBadge priority={g.priority as never} className="shrink-0" />
                  <span className="text-sm flex-1 truncate">{g.title}</span>
                  {g.collection && <span className="text-xs text-muted-foreground shrink-0">{g.collection.name}</span>}
                  <span className="text-xs text-muted-foreground shrink-0">{formatTimeAgo(g.createdAt)}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {gapList.length === 0 && !gapsLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mb-3">
            <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">No coverage gaps!</p>
          <p className="text-xs text-muted-foreground mt-1">All active library tests are linked to automated runs.</p>
        </div>
      )}
    </div>
  );
}

// ── Bookmarks Tab ───────────────────────────────────────────────────────────

function BookmarksTab() {
  const { data: bookmarks, isLoading } = useBookmarks();
  const items = bookmarks?.data ?? [];

  // Group by collection
  const grouped = items.reduce<Record<string, typeof items>>((acc, b) => {
    const key = b.libraryTestCase?.collection?.name ?? 'No Collection';
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Bookmark className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="font-semibold text-sm">No bookmarks yet</p>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
          Star test cases you reference often for quick access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([colName, bms]) => (
        <div key={colName} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{colName}</h3>
          {bms.map(b => {
            const tc = b.libraryTestCase;
            if (!tc) return null;
            return (
              <Link key={b.id} href={`/library/test-cases/${tc.id}`}>
                <Card className="bg-card border-border hover:border-primary/40 transition-all cursor-pointer">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate hover:text-primary transition-colors">{tc.title}</p>
                        <p className="text-xs text-muted-foreground">Bookmarked {formatTimeAgo(b.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <PriorityBadge priority={tc.priority} />
                        <LibraryStatusBadge status={tc.status} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Suggestions Tab ─────────────────────────────────────────────────────────

function SuggestionsTab({ canManage }: { canManage: boolean }) {
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus | 'ALL'>('PENDING');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const { data, isLoading } = useAllSuggestions({
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    pageSize: 30,
  });
  const review = useReviewSuggestion();

  const items = data?.data ?? [];
  const pendingItems = items.filter(s => s.status === 'PENDING');

  const act = async (id: string, status: SuggestionStatus) => {
    try {
      await review.mutateAsync({ id, status, reviewNote: reviewNotes[id]?.trim() || undefined });
      toast.success(status === 'ACCEPTED' ? 'Suggestion approved & applied' : 'Suggestion rejected');
      setExpandedId(null);
      setReviewNotes(prev => { const next = { ...prev }; delete next[id]; return next; });
    } catch {
      toast.error('Action failed');
    }
  };

  const batchAction = async (status: SuggestionStatus) => {
    for (const s of pendingItems) {
      await review.mutateAsync({ id: s.id, status });
    }
    toast.success(`${pendingItems.length} suggestion${pendingItems.length > 1 ? 's' : ''} ${status === 'ACCEPTED' ? 'approved' : 'rejected'}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          {(['PENDING', 'ACCEPTED', 'REJECTED', 'ALL'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                statusFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {/* Batch actions */}
        {canManage && pendingItems.length > 1 && statusFilter === 'PENDING' && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => batchAction('REJECTED')} disabled={review.isPending}>
              Reject All
            </Button>
            <SmartButton size="sm" onClick={() => batchAction('ACCEPTED')} loadingText="Approving..." successText="Done!">
              Approve All
            </SmartButton>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Wand2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-semibold text-sm">No {statusFilter === 'ALL' ? '' : statusFilter.toLowerCase() + ' '}suggestions</p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
            Members can suggest updates to library test cases.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(s => {
            const isExpanded = expandedId === s.id;
            return (
              <Card
                key={s.id}
                className={cn(
                  'bg-card border-border cursor-pointer transition-all hover:shadow-sm',
                  isExpanded && 'border-primary/40 shadow-sm',
                )}
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {(s.createdBy?.name ?? 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold">{s.createdBy?.name ?? 'Unknown'}</span>
                        <SuggestionTypeBadge type={s.type} />
                        {s.status === 'ACCEPTED' && <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 text-xs">Accepted</Badge>}
                        {s.status === 'REJECTED' && <Badge variant="secondary" className="text-xs">Rejected</Badge>}
                        <span className="text-xs text-muted-foreground ml-auto">{formatTimeAgo(s.createdAt)}</span>
                      </div>
                      {s.libraryTestCase && (
                        <Link
                          href={`/library/test-cases/${s.libraryTestCase.id}`}
                          className="text-xs text-primary hover:underline truncate block"
                          onClick={e => e.stopPropagation()}
                        >
                          {s.libraryTestCase.title}
                          {s.libraryTestCase.collection && <span className="text-muted-foreground ml-1">· {s.libraryTestCase.collection.name}</span>}
                        </Link>
                      )}
                      <p className={cn('text-sm leading-relaxed', !isExpanded && 'line-clamp-2')}>{s.content}</p>
                    </div>
                    <div className="shrink-0 text-muted-foreground mt-0.5">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded: review note + actions */}
                  {isExpanded && canManage && s.status === 'PENDING' && (
                    <div className="mt-4 pt-4 border-t border-border space-y-3" onClick={e => e.stopPropagation()}>
                      <ValidatedTextarea
                        value={reviewNotes[s.id] ?? ''}
                        onChange={v => setReviewNotes(prev => ({ ...prev, [s.id]: v }))}
                        placeholder="Add a review note (optional)..."
                        minRows={2}
                        maxRows={4}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => act(s.id, 'REJECTED')}
                          disabled={review.isPending}
                        >
                          <X className="w-3.5 h-3.5 mr-1.5" />Reject
                        </Button>
                        <SmartButton
                          size="sm"
                          onClick={() => act(s.id, 'ACCEPTED')}
                          loadingText="Approving..."
                          successText="Applied!"
                        >
                          <Check className="w-3.5 h-3.5 mr-1.5" />Approve &amp; Apply
                        </SmartButton>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

function LibraryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const tab = searchParams.get('tab') ?? 'collections';
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'TEAM_LEAD';

  const { data: allSuggestions } = useAllSuggestions({ status: 'PENDING', pageSize: 1 });
  const pendingCount = allSuggestions?.pagination?.totalItems ?? 0;

  const setTab = (t: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', t);
    router.push(`?${p.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Test Case Library</h1>
          <p className="text-sm text-muted-foreground">Test case standards and references</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full max-w-lg grid grid-cols-4">
          <TabsTrigger value="collections" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Layers className="w-3.5 h-3.5" />Collections
          </TabsTrigger>
          <TabsTrigger value="coverage" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="w-3.5 h-3.5" />Coverage
          </TabsTrigger>
          <TabsTrigger value="bookmarks" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Bookmark className="w-3.5 h-3.5" />Bookmarks
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="flex items-center gap-1.5 text-xs sm:text-sm relative">
            <Wand2 className="w-3.5 h-3.5" />Suggestions
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] flex items-center justify-center font-bold">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="mt-6">
          <CollectionsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="coverage" className="mt-6">
          <CoverageTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="bookmarks" className="mt-6">
          <BookmarksTab />
        </TabsContent>
        <TabsContent value="suggestions" className="mt-6">
          <SuggestionsTab canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<CollectionGridSkeleton />}>
      <LibraryContent />
    </Suspense>
  );
}
