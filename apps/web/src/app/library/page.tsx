'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Search,
  BarChart3,
  Bookmark,
  MessageSquare,
  Layers,
  Check,
  X,
  ChevronRight,
  Wand2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CollectionGridSkeleton, CoverageSkeleton } from '@/components/skeletons';
import { CoverageBar, PriorityBadge, LibraryStatusBadge, SuggestionTypeBadge, formatTimeAgo } from '@/components/library-badges';
import {
  useCollections,
  useCreateCollection,
  useCoverageStats,
  useCoverageGaps,
  useBookmarks,
  useAllSuggestions,
  useReviewSuggestion,
} from '@/hooks/use-library';
import { useAuth } from '@/providers/AuthProvider';
import { useTeams } from '@/hooks/use-teams';
import { toast } from 'sonner';
import type { SuggestionStatus } from '@/lib/types';

// ── Create Collection Dialog ────────────────────────────────────────────────

function CreateCollectionDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📁');
  const [teamId, setTeamId] = useState<string>('__global__');
  const { data: teams } = useTeams();
  const create = useCreateCollection();

  const submit = async () => {
    if (!name.trim()) return;
    try {
      await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        icon: icon || undefined,
        teamId: teamId === '__global__' ? undefined : teamId,
      });
      toast.success('Collection created');
      setName('');
      setDescription('');
      setIcon('📁');
      setTeamId('__global__');
      onClose();
    } catch {
      toast.error('Failed to create collection');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Collection</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="space-y-1.5 w-20">
              <Label>Icon</Label>
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={2}
                className="text-center text-lg"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Checkout Flows"
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What tests belong in this collection?"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Team (optional)</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Global (no team)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__global__">Global — visible to all</SelectItem>
                {teams?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Collections Tab ─────────────────────────────────────────────────────────

function CollectionsTab({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const { data: collections, isLoading } = useCollections();

  const filtered = (collections ?? []).filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search collections…"
            className="pl-9"
          />
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            New Collection
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card border-border animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Layers className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No collections yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            {canManage
              ? 'Create a collection to organise your test cases.'
              : 'No collections have been created.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((col) => {
            const count = col._count?.testCases ?? 0;
            return (
              <Link key={col.id} href={`/library/collections/${col.id}`}>
                <Card className="bg-card border-border hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl leading-none">{col.icon ?? '📁'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                          {col.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {col.team?.name ?? 'Global'} · {formatTimeAgo(col.updatedAt)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {count} {count === 1 ? 'test' : 'tests'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5 pt-0">
                    {col.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {col.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <CoverageBar value={count > 0 ? Math.min(100, (count / 20) * 100) : 0} className="flex-1" />
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <CreateCollectionDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

// ── Coverage Tab ────────────────────────────────────────────────────────────

function CoverageTab() {
  const { data: stats, isLoading } = useCoverageStats();
  const { data: gaps } = useCoverageGaps();

  if (isLoading) return <CoverageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Library Tests', value: stats?.total ?? 0 },
          { label: 'Linked to Runs', value: stats?.linked ?? 0, color: 'text-green-600 dark:text-green-400' },
          { label: 'Not Linked', value: stats?.unlinked ?? 0, color: 'text-orange-600 dark:text-orange-400' },
          { label: 'Coverage', value: `${(stats?.coverage ?? 0).toFixed(0)}%` },
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="pt-4 pb-4 space-y-1">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color ?? ''}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coverage bar */}
      {stats && (
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Overall coverage</span>
              <span>{stats.coverage.toFixed(1)}%</span>
            </div>
            <CoverageBar value={stats.coverage} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Status */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm">By Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(stats?.byStatus ?? []).map((s) => (
              <div key={s.status} className="flex items-center justify-between">
                <LibraryStatusBadge status={s.status} />
                <span className="text-sm font-medium">{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* By Priority */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm">By Priority</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(stats?.byPriority ?? []).map((p) => (
              <div key={p.priority} className="flex items-center justify-between">
                <PriorityBadge priority={p.priority} />
                <span className="text-sm font-medium">{p.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Coverage gaps */}
      {Array.isArray(gaps) && gaps.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm text-orange-600 dark:text-orange-400">
              Coverage Gaps — Active tests with no linked run
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(gaps as { id: string; title: string; priority: string; createdAt: string }[])
              .slice(0, 10)
              .map((g) => (
                <Link
                  key={g.id}
                  href={`/library/test-cases/${g.id}`}
                  className="flex items-center justify-between py-1.5 hover:text-primary transition-colors text-sm"
                >
                  <span className="truncate flex-1">{g.title}</span>
                  <span className="text-xs text-muted-foreground ml-4 shrink-0">
                    {formatTimeAgo(g.createdAt)}
                  </span>
                </Link>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Bookmarks Tab ───────────────────────────────────────────────────────────

function BookmarksTab() {
  const { data: bookmarks, isLoading } = useBookmarks();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-card border-border animate-pulse">
            <CardContent className="h-16" />
          </Card>
        ))}
      </div>
    );
  }

  const items = bookmarks?.data ?? [];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Bookmark className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">No bookmarks yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Bookmark library test cases to find them quickly here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((b) => {
        const tc = b.libraryTestCase;
        if (!tc) return null;
        return (
          <Link key={b.id} href={`/library/test-cases/${tc.id}`}>
            <Card className="bg-card border-border hover:border-primary/40 transition-all cursor-pointer">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {tc.collection?.name ?? 'No collection'} · bookmarked {formatTimeAgo(b.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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
  );
}

// ── Suggestions Tab ─────────────────────────────────────────────────────────

function SuggestionsTab({ canManage }: { canManage: boolean }) {
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus | 'ALL'>('PENDING');
  const { data, isLoading } = useAllSuggestions({
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    pageSize: 25,
  });
  const review = useReviewSuggestion();

  const act = async (id: string, status: SuggestionStatus) => {
    try {
      await review.mutateAsync({ id, status });
      toast.success(status === 'ACCEPTED' ? 'Suggestion accepted' : 'Suggestion rejected');
    } catch {
      toast.error('Action failed');
    }
  };

  const items = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SuggestionStatus | 'ALL')}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="ACCEPTED">Accepted</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="ALL">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card border-border animate-pulse">
              <CardContent className="h-20" />
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No suggestions</p>
          <p className="text-xs text-muted-foreground mt-1">
            Suggestions submitted by team members will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <Card key={s.id} className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SuggestionTypeBadge type={s.type} />
                      {s.status === 'ACCEPTED' && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 text-xs">
                          Accepted
                        </Badge>
                      )}
                      {s.status === 'REJECTED' && (
                        <Badge className="bg-muted text-muted-foreground text-xs">Rejected</Badge>
                      )}
                    </div>
                    {s.libraryTestCase && (
                      <Link
                        href={`/library/test-cases/${s.libraryTestCase.id}`}
                        className="text-xs text-primary hover:underline truncate block"
                      >
                        {s.libraryTestCase.title}
                      </Link>
                    )}
                    <p className="text-sm text-foreground">{s.content}</p>
                    <p className="text-xs text-muted-foreground">
                      by {s.createdBy?.name ?? 'Unknown'} · {formatTimeAgo(s.createdAt)}
                    </p>
                  </div>
                  {canManage && s.status === 'PENDING' && (
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:border-green-400"
                        onClick={() => act(s.id, 'ACCEPTED')}
                        disabled={review.isPending}
                        title="Accept"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:border-destructive"
                        onClick={() => act(s.id, 'REJECTED')}
                        disabled={review.isPending}
                        title="Reject"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

function LibraryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const tab = searchParams.get('tab') ?? 'collections';

  const canManage =
    user?.role === 'ADMIN' ||
    user?.role === 'MANAGER' ||
    user?.role === 'TEAM_LEAD';

  const setTab = (t: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', t);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Test Case Library</h1>
          <p className="text-sm text-muted-foreground">
            Curated test cases organised into collections
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="collections" className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Collections
          </TabsTrigger>
          <TabsTrigger value="coverage" className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            Coverage
          </TabsTrigger>
          <TabsTrigger value="bookmarks" className="flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5" />
            Bookmarks
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5" />
            Suggestions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="mt-6">
          <CollectionsTab canManage={canManage} />
        </TabsContent>

        <TabsContent value="coverage" className="mt-6">
          <CoverageTab />
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
