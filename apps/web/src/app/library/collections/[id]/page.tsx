'use client';

import { Suspense, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronRight,
  SlidersHorizontal,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { TestCaseListSkeleton } from '@/components/skeletons';
import {
  PriorityBadge,
  DifficultyBadge,
  LibraryStatusBadge,
  formatTimeAgo,
} from '@/components/library-badges';
import {
  useCollections,
  useLibraryTestCases,
  useCreateLibraryTestCase,
  useDeleteLibraryTestCase,
} from '@/hooks/use-library';
import { useAuth } from '@/providers/AuthProvider';
import { InnerPagination } from '@/components/InnerPagination';
import { toast } from 'sonner';
import type { TestPriority, TestDifficulty, LibraryTestCaseStatus } from '@/lib/types';

const PAGE_SIZE = 20;

// ── Create Test Case Dialog ─────────────────────────────────────────────────

function CreateTestCaseDialog({
  open,
  collectionId,
  onClose,
}: {
  open: boolean;
  collectionId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TestPriority>('P2');
  const [difficulty, setDifficulty] = useState<TestDifficulty>('MEDIUM');
  const [tagsRaw, setTagsRaw] = useState('');
  const create = useCreateLibraryTestCase();

  const submit = async () => {
    if (!title.trim()) return;
    try {
      await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        difficulty,
        collectionId,
        tags: tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      toast.success('Test case created');
      setTitle('');
      setDescription('');
      setTagsRaw('');
      setPriority('P2');
      setDifficulty('MEDIUM');
      onClose();
    } catch {
      toast.error('Failed to create test case');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Test Case</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. User can complete checkout with card"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of what this test case verifies."
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TestPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['P0', 'P1', 'P2', 'P3'] as TestPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p} {p === 'P0' ? '— Critical' : p === 'P1' ? '— High' : p === 'P2' ? '— Medium' : '— Low'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as TestDifficulty)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['EASY', 'MEDIUM', 'HARD', 'COMPLEX'] as TestDifficulty[]).map((d) => (
                    <SelectItem key={d} value={d}>
                      {d.charAt(0) + d.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <Input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="smoke, regression, checkout (comma-separated)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Confirm Dialog ───────────────────────────────────────────────────

function DeleteConfirmDialog({
  id,
  title,
  open,
  onClose,
}: {
  id: string;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  const del = useDeleteLibraryTestCase();

  const confirm = async () => {
    try {
      await del.mutateAsync(id);
      toast.success('Test case deleted');
      onClose();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Test Case?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{title}</span> will be permanently deleted.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={del.isPending}>
            {del.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page content ────────────────────────────────────────────────────────────

function CollectionDetailContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const canManage =
    user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'TEAM_LEAD';

  const page = Number(searchParams.get('page') ?? 1);
  const search = searchParams.get('q') ?? '';
  const priorityFilter = (searchParams.get('priority') ?? '') as TestPriority | '';
  const statusFilter = (searchParams.get('status') ?? '') as LibraryTestCaseStatus | '';
  const difficultyFilter = (searchParams.get('difficulty') ?? '') as TestDifficulty | '';

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  // Load collections to find this one by id
  const { data: collections } = useCollections();
  const collection = collections?.find((c) => c.id === id);

  const { data, isLoading } = useLibraryTestCases({
    collectionId: id,
    search: search || undefined,
    priority: priorityFilter || undefined,
    status: statusFilter || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`?${params.toString()}`);
  };

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`?${params.toString()}`);
  };

  const testCases = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/library" className="hover:text-foreground transition-colors">
          Library
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium">
          {collection ? `${collection.icon ?? '📁'} ${collection.name}` : 'Collection'}
        </span>
      </div>

      {/* Collection header */}
      {collection && (
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span>{collection.icon ?? '📁'}</span>
              {collection.name}
            </h1>
            {collection.description && (
              <p className="text-sm text-muted-foreground">{collection.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {collection.team?.name ?? 'Global'} ·{' '}
              {collection._count?.testCases ?? 0} test{' '}
              {(collection._count?.testCases ?? 0) === 1 ? 'case' : 'cases'}
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              New Test Case
            </Button>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setParam('q', e.target.value)}
            placeholder="Search test cases…"
            className="pl-9"
          />
        </div>

        <Select
          value={priorityFilter || '__all__'}
          onValueChange={(v) => setParam('priority', v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="w-32">
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All priorities</SelectItem>
            {(['P0', 'P1', 'P2', 'P3'] as TestPriority[]).map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter || '__all__'}
          onValueChange={(v) => setParam('status', v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {(['DRAFT', 'ACTIVE', 'DEPRECATED', 'ARCHIVED'] as LibraryTestCaseStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={difficultyFilter || '__all__'}
          onValueChange={(v) => setParam('difficulty', v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All difficulties</SelectItem>
            {(['EASY', 'MEDIUM', 'HARD', 'COMPLEX'] as TestDifficulty[]).map((d) => (
              <SelectItem key={d} value={d}>
                {d.charAt(0) + d.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Test case list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="bg-card border-border animate-pulse">
              <CardContent className="h-20" />
            </Card>
          ))}
        </div>
      ) : testCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No test cases found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search || priorityFilter || statusFilter
              ? 'Try adjusting your filters.'
              : canManage
              ? 'Add the first test case to this collection.'
              : 'No test cases in this collection yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {testCases.map((tc) => (
            <Card
              key={tc.id}
              className="bg-card border-border hover:border-primary/40 hover:shadow-sm transition-all group"
            >
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start gap-4">
                  <Link
                    href={`/library/test-cases/${tc.id}`}
                    className="flex-1 min-w-0 space-y-1"
                  >
                    <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                      {tc.title}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <PriorityBadge priority={tc.priority} />
                      <LibraryStatusBadge status={tc.status} />
                      <DifficultyBadge difficulty={tc.difficulty} />
                      {tc.tags.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {tc.tags.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{tc.tags.length - 3}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatTimeAgo(tc.updatedAt)}
                      {tc.updatedBy && ` by ${tc.updatedBy.name}`}
                    </p>
                  </Link>
                  <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/library/test-cases/${tc.id}`}>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="View">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                    {canManage && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Delete"
                        onClick={() => setDeleteTarget({ id: tc.id, title: tc.title })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
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
      <CreateTestCaseDialog
        open={createOpen}
        collectionId={id}
        onClose={() => setCreateOpen(false)}
      />
      {deleteTarget && (
        <DeleteConfirmDialog
          id={deleteTarget.id}
          title={deleteTarget.title}
          open
          onClose={() => setDeleteTarget(null)}
        />
      )}
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
