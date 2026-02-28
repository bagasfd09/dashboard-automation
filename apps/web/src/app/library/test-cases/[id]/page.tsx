'use client';

import { Suspense, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight, Bookmark, BookmarkCheck, Pencil, Lightbulb,
  FileText, ListChecks, CheckSquare, Link2, MessageSquare, History,
  MoreHorizontal, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TestCaseDetailSkeleton } from '@/components/skeletons';
import { PriorityBadge, DifficultyBadge, LibraryStatusBadge, SuggestionTypeBadge, formatTimeAgo } from '@/components/library-badges';
import {
  useLibraryTestCase, useToggleBookmark, useSuggestions, useDeleteLibraryTestCase,
} from '@/hooks/use-library';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from '@/hooks/use-toast';
import { DescriptionTab } from './_components/description-tab';
import { StepsTab } from './_components/steps-tab';
import { CriteriaTab } from './_components/criteria-tab';
import { CoverageTab } from './_components/coverage-tab';
import { HistoryTab } from './_components/history-tab';
import { DiscussionTab } from './_components/discussion-tab';
import { EditDialog } from './_components/edit-dialog';
import { SuggestDialog } from './_components/suggest-dialog';
import { CodeTemplateDialog } from './_components/code-template-dialog';
import { AddToMyTasksButton } from './_components/add-to-my-tasks-button';

// ── Suggestions in detail ─────────────────────────────────────────────────────

function SuggestionsTabContent({ id }: { id: string }) {
  const { data, isLoading } = useSuggestions(id);
  const items = data?.data ?? [];

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}</div>;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Lightbulb className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">No suggestions yet</p>
        <p className="text-xs text-muted-foreground mt-1">Use the &ldquo;Suggest Update&rdquo; button to propose improvements.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map(s => (
        <div key={s.id} className="bg-card border border-border rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <SuggestionTypeBadge type={s.type} />
            {s.status === 'PENDING' && <Badge className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">Pending</Badge>}
            {s.status === 'ACCEPTED' && <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">Accepted</Badge>}
            {s.status === 'REJECTED' && <Badge variant="secondary" className="text-xs">Rejected</Badge>}
            <span className="text-xs text-muted-foreground ml-auto">{formatTimeAgo(s.createdAt)}</span>
          </div>
          <p className="text-sm">{s.content}</p>
          <p className="text-xs text-muted-foreground">by {s.createdBy?.name ?? 'Unknown'}{s.reviewedBy ? ` · reviewed by ${s.reviewedBy.name}` : ''}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function TestCaseDetailContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const { data: tc, isLoading } = useLibraryTestCase(id);
  const toggleBookmark = useToggleBookmark(id);
  const deleteTc = useDeleteLibraryTestCase();

  const [editOpen, setEditOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'TEAM_LEAD';

  const tab = searchParams.get('tab') ?? 'description';
  const setTab = (t: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', t);
    router.push(`?${p.toString()}`);
  };

  if (isLoading) return <TestCaseDetailSkeleton />;
  if (!tc) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileText className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="font-semibold">Test case not found</p>
        <Link href="/library" className="text-sm text-primary mt-2 hover:underline">Back to Library</Link>
      </div>
    );
  }

  const isBookmarked = (tc._count?.bookmarks ?? 0) > 0;
  const discussionCount = tc._count?.discussions ?? 0;
  const linkedCount = (tc._count as { linkedTestCases?: number })?.linkedTestCases ?? 0;

  const handleDeleteConfirm = async () => {
    try {
      await deleteTc.mutateAsync(tc.id);
      toast.success('Test case deleted');
      router.push(tc.collection ? `/library/collections/${tc.collection.id}` : '/library');
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
        <Link href="/library" className="hover:text-foreground transition-colors">Library</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        {tc.collection && (
          <>
            <Link href={`/library/collections/${tc.collection.id}`} className="hover:text-foreground transition-colors">
              {tc.collection.name}
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
          </>
        )}
        <span className="text-foreground font-medium max-w-[200px] truncate">{tc.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <h1 className="text-2xl font-bold leading-snug">{tc.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priority={tc.priority} />
            <LibraryStatusBadge status={tc.status} />
            <DifficultyBadge difficulty={tc.difficulty} />
            {tc.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
          </div>
          <p className="text-xs text-muted-foreground">
            Created by {tc.createdBy?.name ?? 'Unknown'} · {formatTimeAgo(tc.createdAt)}
            {tc.updatedBy && ` · Updated by ${tc.updatedBy.name} ${formatTimeAgo(tc.updatedAt)}`}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {(user?.role === 'MEMBER' || user?.role === 'TEAM_LEAD') && (
            <AddToMyTasksButton libraryTestCaseId={tc.id} libraryTestCaseTitle={tc.title} />
          )}
          <Button size="sm" variant="outline" onClick={() => setCodeOpen(true)}>
            <FileText className="w-3.5 h-3.5 mr-1.5" />Template
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSuggestOpen(true)}>
            <Lightbulb className="w-3.5 h-3.5 mr-1.5" />Suggest
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit
            </Button>
          )}
          <Button size="icon" variant="outline" className="h-9 w-9"
            onClick={async () => { try { await toggleBookmark.mutateAsync(); } catch { toast.error('Bookmark failed'); } }}
            disabled={toggleBookmark.isPending} title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}>
            {isBookmarked ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4" />}
          </Button>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" className="h-9 w-9"><MoreHorizontal className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* 6-tab layout */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0 border-b border-border w-full justify-start rounded-none">
          {[
            { value: 'description', label: 'Description', icon: FileText },
            { value: 'steps', label: 'Steps', icon: ListChecks },
            { value: 'criteria', label: 'Criteria', icon: CheckSquare },
            { value: 'coverage', label: `Coverage${linkedCount > 0 ? ` (${linkedCount})` : ''}`, icon: Link2 },
            { value: 'history', label: 'History', icon: History },
            { value: 'discussion', label: `Discussion${discussionCount > 0 ? ` (${discussionCount})` : ''}`, icon: MessageSquare },
          ].map(t => (
            <TabsTrigger key={t.value} value={t.value}
              className="flex items-center gap-1.5 text-xs border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none pb-2.5 px-3">
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="description" className="mt-5"><DescriptionTab tc={tc} /></TabsContent>
        <TabsContent value="steps" className="mt-5"><StepsTab tc={tc} /></TabsContent>
        <TabsContent value="criteria" className="mt-5"><CriteriaTab tc={tc} /></TabsContent>
        <TabsContent value="coverage" className="mt-5"><CoverageTab tc={tc} /></TabsContent>
        <TabsContent value="history" className="mt-5">
          <HistoryTab id={id} canManage={canManage} currentTitle={tc.title} />
        </TabsContent>
        <TabsContent value="discussion" className="mt-5"><DiscussionTab id={id} /></TabsContent>
      </Tabs>

      {/* Dialogs */}
      {editOpen && (
        <EditDialog id={id} open initial={{
          title: tc.title, description: tc.description ?? '', priority: tc.priority,
          difficulty: tc.difficulty, status: tc.status, tags: tc.tags,
          steps: tc.steps ?? '', preconditions: tc.preconditions ?? '', expectedOutcome: tc.expectedOutcome ?? '',
        }} onClose={() => setEditOpen(false)} />
      )}
      <SuggestDialog id={id} open={suggestOpen} onClose={() => setSuggestOpen(false)} />
      <CodeTemplateDialog tc={tc} open={codeOpen} onClose={() => setCodeOpen(false)} />

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={o => !o && setDeleteOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Test Case?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">&ldquo;{tc.title}&rdquo;</span> will be permanently deleted along with all its versions and discussions.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteTc.isPending}>
              {deleteTc.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TestCaseDetailPage() {
  return (
    <Suspense fallback={<TestCaseDetailSkeleton />}>
      <TestCaseDetailContent />
    </Suspense>
  );
}
