'use client';

import { Suspense, useState, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight, ChevronDown, ChevronUp, Plus, Search, SlidersHorizontal, FileText,
  Bookmark, BookmarkCheck, Pencil, Trash2, History, MoreHorizontal, Archive, Upload,
  X as XIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { TestCaseListSkeleton } from '@/components/skeletons';
import { PriorityBadge, DifficultyBadge, LibraryStatusBadge, formatTimeAgo } from '@/components/library-badges';
import {
  useCollections, useLibraryTestCases, useCreateLibraryTestCase,
  useDeleteLibraryTestCase, useToggleBookmark, useVersions, useUpdateCollection,
} from '@/hooks/use-library';
import { useAuth } from '@/providers/AuthProvider';
import { InnerPagination } from '@/components/InnerPagination';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { SmartButton } from '@/components/ui/smart-button';
import { TagInput } from '@/components/ui/tag-input';
import { InlineEdit } from '@/components/ui/inline-edit';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TestCaseFormDialog } from '@/components/library/test-case-form-dialog';
import { ImportFromRunsDialog } from './_components/import-from-runs-dialog';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import type { TestPriority, TestDifficulty, LibraryTestCaseStatus, LibraryTestCase } from '@/lib/types';

const PAGE_SIZE = 20;
type SortKey = 'priority' | 'title' | 'newest' | 'oldest';

// ── Helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<TestPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

function sortTestCases(items: LibraryTestCase[], sort: SortKey): LibraryTestCase[] {
  return [...items].sort((a, b) => {
    if (sort === 'priority') return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (sort === 'newest') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (sort === 'oldest') return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    return 0;
  });
}

// ── Changelog Modal ──────────────────────────────────────────────────────────

function ChangelogModal({ collectionId, open, onClose }: { collectionId: string; open: boolean; onClose: () => void }) {
  const { data: tcData } = useLibraryTestCases({ collectionId, pageSize: 100 });
  const items = useMemo(() => {
    return (tcData?.data ?? [])
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [tcData]);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="w-4 h-4" />Collection Changelog</DialogTitle></DialogHeader>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No activity yet.</p>
        ) : (
          <div className="space-y-0">
            {items.map((tc, i) => (
              <div key={tc.id} className="flex gap-3 pb-4">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  {i < items.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                </div>
                <div className="flex-1 min-w-0 pb-2">
                  <Link href={`/library/test-cases/${tc.id}`} className="text-sm font-medium hover:text-primary transition-colors line-clamp-1">
                    {tc.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    <LibraryStatusBadge status={tc.status} />
                    <span className="text-xs text-muted-foreground">
                      {tc.updatedBy ? `by ${tc.updatedBy.name} · ` : ''}{formatTimeAgo(tc.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Test Case Card ───────────────────────────────────────────────────────────

function TestCaseCard({
  tc, canManage, onDelete,
}: {
  tc: LibraryTestCase;
  canManage: boolean;
  onDelete: (id: string, title: string) => void;
}) {
  const toggleBookmark = useToggleBookmark(tc.id);

  const borderClass = {
    ACTIVE: 'border-l-[3px] border-l-green-500',
    DRAFT: 'border-l-[3px] border-l-gray-300 dark:border-l-gray-600',
    DEPRECATED: 'border-l-[3px] border-l-yellow-500',
    ARCHIVED: 'border-l-[3px] border-l-gray-200 dark:border-l-gray-700',
  }[tc.status];

  const cardOpacity = tc.status === 'DEPRECATED' || tc.status === 'ARCHIVED' ? 'opacity-60' : '';

  return (
    <Card className={cn('bg-card border-border hover:shadow-sm transition-all group', borderClass, cardOpacity)}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <Link href={`/library/test-cases/${tc.id}`} className="block">
              <p className={cn('text-sm font-medium group-hover:text-primary transition-colors leading-snug',
                tc.status === 'DEPRECATED' && 'line-through text-muted-foreground')}>
                {tc.title}
              </p>
            </Link>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <PriorityBadge priority={tc.priority} />
              <LibraryStatusBadge status={tc.status} />
              <DifficultyBadge difficulty={tc.difficulty} />
              {tc.tags.slice(0, 3).map(tag => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
              ))}
              {tc.tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{tc.tags.length - 3}</span>
              )}
            </div>
            {(tc._count?.linkedTestCases ?? 0) > 0 ? (
              <p className="text-xs text-muted-foreground mt-1.5">
                {tc._count?.linkedTestCases} linked &nbsp;·&nbsp; Updated {formatTimeAgo(tc.updatedAt)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/60 mt-1.5">
                No linked runs &nbsp;·&nbsp; Updated {formatTimeAgo(tc.updatedAt)}
              </p>
            )}
          </div>

          {/* Actions — visible on hover */}
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" className="h-7 w-7"
              title="Toggle bookmark"
              onClick={async e => { e.preventDefault(); try { await toggleBookmark.mutateAsync(); } catch { toast.error('Bookmark failed'); } }}>
              {(tc._count?.bookmarks ?? 0) > 0
                ? <BookmarkCheck className="w-3.5 h-3.5 text-primary" />
                : <Bookmark className="w-3.5 h-3.5" />}
            </Button>
            <Link href={`/library/test-cases/${tc.id}`}>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="View / Edit">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </Link>
            {canManage && (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/60 hover:text-destructive"
                title="Delete" onClick={() => onDelete(tc.id, tc.title)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ value, label, active, onClick }: { value: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn(
      'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
    )}>
      {label}
    </button>
  );
}

// ── Main content ─────────────────────────────────────────────────────────────

function CollectionDetailContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'TEAM_LEAD';

  const page = Number(searchParams.get('page') ?? 1);
  const search = searchParams.get('q') ?? '';
  const priorityFilter = (searchParams.get('priority') ?? '') as TestPriority | '';
  const statusFilter = (searchParams.get('status') ?? '') as LibraryTestCaseStatus | '';
  const sort = (searchParams.get('sort') ?? 'priority') as SortKey;

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [importRunsOpen, setImportRunsOpen] = useState(false);
  const deleteTC = useDeleteLibraryTestCase();
  const updateCollection = useUpdateCollection();
  const createTestCase = useCreateLibraryTestCase();

  const { data: collections } = useCollections();
  const collection = collections?.find(c => c.id === id);

  const { data, isLoading } = useLibraryTestCases({
    collectionId: id,
    search: search || undefined,
    priority: priorityFilter || undefined,
    status: statusFilter || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const testCases = useMemo(() =>
    sortTestCases(data?.data ?? [], sort), [data?.data, sort]);
  const pagination = data?.pagination;

  // Collect existing titles for duplicate detection in the form dialog
  const existingTitles = useMemo(() =>
    (data?.data ?? []).map(tc => tc.title), [data?.data]);

  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams.toString());
    value ? p.set(key, value) : p.delete(key);
    p.delete('page');
    router.push(`?${p.toString()}`);
  };
  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`?${params.toString()}`);
  };

  // Stat counts from all pages (use current page data for approximate totals)
  const totalCount = collection?._count?.testCases ?? pagination?.totalItems ?? 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/library" className="hover:text-foreground transition-colors">Library</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium">
          {collection ? `${collection.icon ?? '\uD83D\uDCC1'} ${collection.name}` : 'Collection'}
        </span>
      </div>

      {/* Collection header */}
      {collection && (
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span>{collection.icon ?? '\uD83D\uDCC1'}</span>
                <InlineEdit
                  value={collection.name}
                  onSave={async (newName) => {
                    await updateCollection.mutateAsync({ id, data: { name: newName } });
                    toast.success('Collection renamed');
                  }}
                  validate={(v) => v.trim().length < 2 ? 'Name must be at least 2 characters' : null}
                  disabled={!canManage}
                  className="text-2xl font-bold"
                />
              </h1>
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      onClick={() => setArchiveConfirmOpen(true)}
                      className="text-yellow-600 dark:text-yellow-400"
                    >
                      <Archive className="w-4 h-4 mr-2" />
                      Archive Collection
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {collection.description && (
              <p className="text-sm text-muted-foreground max-w-xl">{collection.description}</p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground">{collection.team?.name ?? 'Global'}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground">{totalCount} test {totalCount === 1 ? 'case' : 'cases'}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground">Updated {formatTimeAgo(collection.updatedAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setChangelogOpen(true)}>
              <History className="w-3.5 h-3.5 mr-1.5" />Changelog
            </Button>
            {canManage && (
              <>
                <Button size="sm" variant="outline" onClick={() => setImportRunsOpen(true)}>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />Import from Runs
                </Button>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />New Test Case
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="space-y-3">
        {/* Search + sort */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setParam('q', e.target.value)} placeholder="Search test cases…" className="pl-9" />
          </div>
          <Select value={priorityFilter || '__all__'} onValueChange={v => setParam('priority', v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-32">
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All priorities</SelectItem>
              {(['P0', 'P1', 'P2', 'P3'] as TestPriority[]).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={v => setParam('sort', v)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="title">Title A–Z</SelectItem>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {([
            ['', 'All'],
            ['ACTIVE', 'Active'],
            ['DRAFT', 'Draft'],
            ['DEPRECATED', 'Deprecated'],
            ['ARCHIVED', 'Archived'],
          ] as [string, string][]).map(([val, label]) => (
            <StatusPill
              key={val} value={val} label={label}
              active={statusFilter === val}
              onClick={() => setParam('status', val)}
            />
          ))}
          {(search || priorityFilter || statusFilter) && (
            <button onClick={() => { setParam('q', ''); setParam('priority', ''); setParam('status', ''); }}
              className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <XIcon className="w-3 h-3" />Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Test case list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : testCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-semibold text-sm">
            {search || priorityFilter || statusFilter ? 'No test cases match your filters' : 'No test cases yet'}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
            {search || priorityFilter || statusFilter
              ? 'Try clearing some filters.'
              : canManage
              ? 'Add test cases manually to start defining standards for this collection.'
              : 'No test cases in this collection yet.'}
          </p>
          {!search && !priorityFilter && !statusFilter && canManage && (
            <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />Add Test Case
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2 stagger-children">
          {testCases.map(tc => (
            <TestCaseCard
              key={tc.id} tc={tc} canManage={canManage}
              onDelete={(id, title) => setDeleteTarget({ id, title })}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <InnerPagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={setPage}
        />
      )}

      {/* Dialogs */}
      <TestCaseFormDialog
        mode="create"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        existingTitles={existingTitles}
        onSubmit={async (formData) => {
          await createTestCase.mutateAsync({
            title: formData.title,
            description: formData.description || undefined,
            priority: formData.priority,
            difficulty: formData.difficulty,
            collectionId: id,
            tags: formData.tags,
            steps: formData.steps || undefined,
            preconditions: formData.preconditions || undefined,
            expectedOutcome: formData.expectedOutcome || undefined,
          });
          toast.success('Test case created');
          setCreateOpen(false);
        }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={o => !o && setDeleteTarget(null)}
        title="Delete Test Case?"
        description={deleteTarget ? <>
          <span className="font-medium text-foreground">&ldquo;{deleteTarget.title}&rdquo;</span> will be permanently removed from this collection.
        </> : ''}
        variant="danger"
        confirmText="Delete"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteTC.mutateAsync(deleteTarget.id);
          toast.success('Test case deleted');
        }}
      />
      <ConfirmDialog
        open={archiveConfirmOpen}
        onOpenChange={setArchiveConfirmOpen}
        title="Archive Collection?"
        description={collection ? <>
          <span className="font-medium text-foreground">&ldquo;{collection.name}&rdquo;</span> and all its test cases will be archived. You can restore it later from the archived collections view.
        </> : ''}
        variant="warning"
        confirmText="Archive"
        onConfirm={async () => {
          // TODO: implement archive collection API call
          toast.success('Collection archived');
          router.push('/library');
        }}
      />
      <ChangelogModal collectionId={id} open={changelogOpen} onClose={() => setChangelogOpen(false)} />
      <ImportFromRunsDialog
        collectionId={id}
        existingTitles={existingTitles}
        open={importRunsOpen}
        onClose={() => setImportRunsOpen(false)}
      />
    </div>
  );
}

export default function CollectionDetailPage() {
  return (
    <Suspense fallback={<TestCaseListSkeleton />}>
      <CollectionDetailContent />
    </Suspense>
  );
}
