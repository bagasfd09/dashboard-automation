'use client';

import { Suspense, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Bookmark,
  BookmarkCheck,
  Pencil,
  Lightbulb,
  RotateCcw,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Clock,
  MessageSquare,
  History,
  FileText,
  ListChecks,
  CheckSquare,
  LinkIcon,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { TestCaseDetailSkeleton } from '@/components/skeletons';
import {
  PriorityBadge,
  DifficultyBadge,
  LibraryStatusBadge,
  SuggestionTypeBadge,
  CoverageBar,
  formatTimeAgo,
} from '@/components/library-badges';
import {
  useLibraryTestCase,
  useUpdateLibraryTestCase,
  useVersions,
  useRollbackVersion,
  useToggleBookmark,
  useCreateSuggestion,
  useSuggestions,
  useDiscussions,
  usePostDiscussion,
  useDeleteDiscussion,
} from '@/hooks/use-library';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from 'sonner';
import type { TestPriority, TestDifficulty, LibraryTestCaseStatus, SuggestionType } from '@/lib/types';

// ── Edit Dialog ─────────────────────────────────────────────────────────────

function EditDialog({
  id,
  initial,
  open,
  onClose,
}: {
  id: string;
  initial: {
    title: string;
    description: string;
    priority: TestPriority;
    difficulty: TestDifficulty;
    status: LibraryTestCaseStatus;
    tags: string[];
    steps: string;
    preconditions: string;
    expectedOutcome: string;
  };
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...initial, tagsRaw: initial.tags.join(', '), changeNotes: '' });
  const update = useUpdateLibraryTestCase(id);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    try {
      await update.mutateAsync({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        difficulty: form.difficulty,
        status: form.status,
        tags: form.tagsRaw.split(',').map((t) => t.trim()).filter(Boolean),
        steps: form.steps.trim() || undefined,
        preconditions: form.preconditions.trim() || undefined,
        expectedOutcome: form.expectedOutcome.trim() || undefined,
        changeNotes: form.changeNotes.trim() || undefined,
      });
      toast.success('Test case updated');
      onClose();
    } catch {
      toast.error('Update failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Test Case</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set('priority', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['P0', 'P1', 'P2', 'P3'] as TestPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={form.difficulty} onValueChange={(v) => set('difficulty', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['EASY', 'MEDIUM', 'HARD', 'COMPLEX'] as TestDifficulty[]).map((d) => (
                    <SelectItem key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['DRAFT', 'ACTIVE', 'DEPRECATED', 'ARCHIVED'] as LibraryTestCaseStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <Input value={form.tagsRaw} onChange={(e) => set('tagsRaw', e.target.value)} placeholder="smoke, regression (comma-separated)" />
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label>Preconditions</Label>
            <Textarea value={form.preconditions} onChange={(e) => set('preconditions', e.target.value)} rows={2} placeholder="Requirements before test can run…" />
          </div>
          <div className="space-y-1.5">
            <Label>Test Steps</Label>
            <Textarea value={form.steps} onChange={(e) => set('steps', e.target.value)} rows={5} placeholder="1. Navigate to…&#10;2. Click…&#10;3. Verify…" />
          </div>
          <div className="space-y-1.5">
            <Label>Expected Outcome</Label>
            <Textarea value={form.expectedOutcome} onChange={(e) => set('expectedOutcome', e.target.value)} rows={2} placeholder="What should happen when the test passes…" />
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label>Change Notes (optional)</Label>
            <Input value={form.changeNotes} onChange={(e) => set('changeNotes', e.target.value)} placeholder="Briefly describe what changed…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!form.title.trim() || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Suggest Update Dialog ───────────────────────────────────────────────────

function SuggestDialog({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const [type, setType] = useState<SuggestionType>('IMPROVEMENT');
  const [content, setContent] = useState('');
  const create = useCreateSuggestion(id);

  const submit = async () => {
    if (!content.trim()) return;
    try {
      await create.mutateAsync({ type, content: content.trim() });
      toast.success('Suggestion submitted');
      setContent('');
      onClose();
    } catch {
      toast.error('Failed to submit');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Suggest an Update</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as SuggestionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="IMPROVEMENT">Improvement</SelectItem>
                <SelectItem value="BUG_REPORT">Bug Report</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="OBSOLETE">Mark Obsolete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Details *</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Describe your suggestion clearly…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!content.trim() || create.isPending}>
            {create.isPending ? 'Submitting…' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Code Template Dialog ─────────────────────────────────────────────────────

function CodeTemplateDialog({ title, steps, open, onClose }: { title: string; steps: string | null; open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const stepsLines = (steps ?? '')
    .split('\n')
    .filter(Boolean)
    .map((s) => `  // ${s}`)
    .join('\n');

  const code = `import { test, expect } from '@playwright/test';

test('${title}', async ({ page }) => {
${stepsLines || '  // TODO: implement steps'}
});`;

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Playwright Template</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono leading-relaxed">
            {code}
          </pre>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={copy}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Version History ──────────────────────────────────────────────────────────

function HistoryTab({ id, canManage }: { id: string; canManage: boolean }) {
  const { data, isLoading } = useVersions(id);
  const rollback = useRollbackVersion(id);
  const [confirmVersion, setConfirmVersion] = useState<number | null>(null);

  const versions = data?.data ?? [];

  const doRollback = async (version: number) => {
    try {
      await rollback.mutateAsync(version);
      toast.success(`Rolled back to v${version}`);
      setConfirmVersion(null);
    } catch {
      toast.error('Rollback failed');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="bg-card border-border animate-pulse">
            <CardContent className="h-16" />
          </Card>
        ))}
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <History className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">No version history yet</p>
        <p className="text-xs text-muted-foreground mt-1">Versions are created automatically when content changes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <Card key={v.id} className="bg-card border-border">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">v{v.version}</Badge>
                  <span className="text-sm font-medium truncate">{v.title}</span>
                </div>
                {v.changeNotes && (
                  <p className="text-xs text-muted-foreground italic">{v.changeNotes}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {formatTimeAgo(v.createdAt)} by {v.createdBy?.name ?? 'Unknown'}
                </p>
              </div>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmVersion(v.version)}
                  disabled={rollback.isPending}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Restore
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Rollback confirm */}
      <Dialog open={confirmVersion !== null} onOpenChange={(o) => !o && setConfirmVersion(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Restore Version {confirmVersion}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The current content will be saved as a new version before restoring.
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

// ── Discussion Tab ───────────────────────────────────────────────────────────

function DiscussionTab({ id }: { id: string }) {
  const { user } = useAuth();
  const { data, isLoading } = useDiscussions(id);
  const post = usePostDiscussion(id);
  const del = useDeleteDiscussion(id);
  const [message, setMessage] = useState('');

  const send = async () => {
    if (!message.trim()) return;
    try {
      await post.mutateAsync(message.trim());
      setMessage('');
    } catch {
      toast.error('Failed to post');
    }
  };

  const discussions = data?.data ?? [];

  return (
    <div className="space-y-4 flex flex-col">
      {/* Messages */}
      <div className="space-y-3 min-h-[200px]">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 bg-muted rounded" />
                <div className="h-10 bg-muted rounded" />
              </div>
            </div>
          ))
        ) : discussions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No discussions yet</p>
            <p className="text-xs text-muted-foreground mt-1">Start the conversation below.</p>
          </div>
        ) : (
          discussions.map((d) => (
            <div key={d.id} className="flex gap-3 group">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary">
                  {(d.createdBy?.name ?? 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium">{d.createdBy?.name ?? 'Unknown'}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTimeAgo(d.createdAt)}</span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words bg-muted/50 rounded-lg px-3 py-2">
                  {d.content}
                </p>
              </div>
              {(user?.id === d.createdById || user?.role === 'ADMIN') && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive mt-1"
                  onClick={() => del.mutate(d.id)}
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Post box */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-primary">
            {(user?.name ?? 'U').charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write a comment…"
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          />
          <Button size="icon" onClick={send} disabled={!message.trim() || post.isPending}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Coverage / Linked Runs Tab ───────────────────────────────────────────────

function CoverageTabContent({ tc }: { tc: NonNullable<ReturnType<typeof useLibraryTestCase>['data']> }) {
  const linked = tc.linkedTestCases ?? [];
  const deps = tc.dependencies ?? [];
  const dependents = tc.dependents ?? [];

  return (
    <div className="space-y-6">
      {/* Linked test cases */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <LinkIcon className="w-4 h-4" />
          Linked Automated Tests ({linked.length})
        </h3>
        {linked.length === 0 ? (
          <p className="text-sm text-muted-foreground">No automated test cases linked yet.</p>
        ) : (
          <div className="space-y-2">
            {linked.map((l) => (
              <Card key={l.id} className="bg-card border-border">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{l.testCase.title}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{l.testCase.filePath}</p>
                    </div>
                    {l.autoMatched && (
                      <Badge variant="secondary" className="text-xs shrink-0">Auto-matched</Badge>
                    )}
                    {l.testCase.team && (
                      <Link href={`/teams/${l.testCase.team.id}`}>
                        <Badge variant="outline" className="text-xs shrink-0 cursor-pointer hover:border-primary/40">
                          {l.testCase.team.name}
                          <ExternalLink className="w-2.5 h-2.5 ml-1" />
                        </Badge>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dependencies */}
      {(deps.length > 0 || dependents.length > 0) && (
        <>
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Depends On</h3>
              {deps.length === 0 ? (
                <p className="text-xs text-muted-foreground">No dependencies.</p>
              ) : (
                deps.map((d) => (
                  <Link key={d.dependsOn.id} href={`/library/test-cases/${d.dependsOn.id}`}>
                    <Card className="bg-card border-border hover:border-primary/40 transition-all cursor-pointer">
                      <CardContent className="pt-2 pb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs truncate">{d.dependsOn.title}</span>
                          <LibraryStatusBadge status={d.dependsOn.status} className="ml-auto shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Required By</h3>
              {dependents.length === 0 ? (
                <p className="text-xs text-muted-foreground">No dependents.</p>
              ) : (
                dependents.map((d) => (
                  <Link key={d.libraryTestCase.id} href={`/library/test-cases/${d.libraryTestCase.id}`}>
                    <Card className="bg-card border-border hover:border-primary/40 transition-all cursor-pointer">
                      <CardContent className="pt-2 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs truncate">{d.libraryTestCase.title}</span>
                          <LibraryStatusBadge status={d.libraryTestCase.status} className="ml-auto shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Suggestions Tab ──────────────────────────────────────────────────────────

function SuggestionsTabContent({ id, canManage }: { id: string; canManage: boolean }) {
  const { data, isLoading } = useSuggestions(id);
  const items = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Lightbulb className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">No suggestions yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Use the &quot;Suggest Update&quot; button to propose improvements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((s) => (
        <Card key={s.id} className="bg-card border-border">
          <CardContent className="pt-3 pb-3 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <SuggestionTypeBadge type={s.type} />
              {s.status === 'PENDING' && <Badge className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">Pending</Badge>}
              {s.status === 'ACCEPTED' && <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">Accepted</Badge>}
              {s.status === 'REJECTED' && <Badge variant="secondary" className="text-xs">Rejected</Badge>}
            </div>
            <p className="text-sm">{s.content}</p>
            <p className="text-xs text-muted-foreground">
              by {s.createdBy?.name ?? 'Unknown'} · {formatTimeAgo(s.createdAt)}
              {s.reviewedBy && ` · reviewed by ${s.reviewedBy.name}`}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main content ─────────────────────────────────────────────────────────────

function TestCaseDetailContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const { data: tc, isLoading } = useLibraryTestCase(id);
  const toggleBookmark = useToggleBookmark(id);

  const [editOpen, setEditOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

  const canManage =
    user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'TEAM_LEAD';
  const canSuggest = !!user;

  const tab = searchParams.get('tab') ?? 'description';
  const setTab = (t: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', t);
    router.push(`?${params.toString()}`);
  };

  const onBookmark = async () => {
    try {
      await toggleBookmark.mutateAsync();
    } catch {
      toast.error('Bookmark action failed');
    }
  };

  if (isLoading) return <TestCaseDetailSkeleton />;
  if (!tc) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileText className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="font-medium">Test case not found</p>
        <Link href="/library" className="text-sm text-primary mt-2 hover:underline">
          Back to Library
        </Link>
      </div>
    );
  }

  const bookmarkCount = tc._count?.bookmarks ?? 0;
  const discussionCount = tc._count?.discussions ?? 0;
  const suggestionCount = tc._count?.suggestions ?? 0;

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
        <span className="text-foreground font-medium truncate max-w-[200px]">{tc.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <h1 className="text-2xl font-bold leading-snug">{tc.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priority={tc.priority} />
            <LibraryStatusBadge status={tc.status} />
            <DifficultyBadge difficulty={tc.difficulty} />
            {tc.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Created by {tc.createdBy?.name ?? 'Unknown'} · {formatTimeAgo(tc.createdAt)}
            {tc.updatedBy && ` · Updated by ${tc.updatedBy.name} ${formatTimeAgo(tc.updatedAt)}`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <Button size="sm" variant="outline" onClick={() => setCodeOpen(true)}>
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Template
          </Button>
          {canSuggest && !canManage && (
            <Button size="sm" variant="outline" onClick={() => setSuggestOpen(true)}>
              <Lightbulb className="w-3.5 h-3.5 mr-1.5" />
              Suggest
            </Button>
          )}
          {canManage && (
            <>
              <Button size="sm" variant="outline" onClick={() => setSuggestOpen(true)}>
                <Lightbulb className="w-3.5 h-3.5 mr-1.5" />
                Suggest
              </Button>
              <Button size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit
              </Button>
            </>
          )}
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9"
            onClick={onBookmark}
            disabled={toggleBookmark.isPending}
            title={bookmarkCount > 0 ? 'Bookmarked' : 'Bookmark'}
          >
            {bookmarkCount > 0 ? (
              <BookmarkCheck className="w-4 h-4 text-primary" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* 6-tab content */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="description" className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Description
          </TabsTrigger>
          <TabsTrigger value="steps" className="flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5" />
            Steps
          </TabsTrigger>
          <TabsTrigger value="criteria" className="flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" />
            Criteria
          </TabsTrigger>
          <TabsTrigger value="coverage" className="flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5" />
            Coverage
            {(tc._count as { linkedTestCases?: number })?.linkedTestCases !== undefined &&
              (tc._count as { linkedTestCases?: number }).linkedTestCases! > 0 && (
                <Badge className="ml-1 text-[10px] px-1 py-0 h-4">
                  {(tc._count as { linkedTestCases?: number }).linkedTestCases}
                </Badge>
              )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />
            History
          </TabsTrigger>
          <TabsTrigger value="discussion" className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Discussion
            {discussionCount > 0 && (
              <Badge className="ml-1 text-[10px] px-1 py-0 h-4">{discussionCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Description */}
        <TabsContent value="description" className="mt-6 space-y-4">
          {tc.description ? (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{tc.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No description provided.</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3">
                <p className="text-muted-foreground mb-1">Collection</p>
                <p className="font-medium">{tc.collection?.name ?? 'None'}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3">
                <p className="text-muted-foreground mb-1">Bookmarks</p>
                <p className="font-medium">{bookmarkCount}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3">
                <p className="text-muted-foreground mb-1">Suggestions</p>
                <p className="font-medium">{suggestionCount}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Steps */}
        <TabsContent value="steps" className="mt-6 space-y-4">
          {tc.preconditions && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Preconditions
              </h3>
              <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <CardContent className="pt-3 pb-3">
                  <p className="text-sm whitespace-pre-wrap">{tc.preconditions}</p>
                </CardContent>
              </Card>
            </div>
          )}
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Test Steps
            </h3>
            {tc.steps ? (
              <div className="space-y-2">
                {tc.steps.split('\n').filter(Boolean).map((step, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="pt-0.5">{step.replace(/^\d+[\.\)]\s*/, '')}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No steps defined.</p>
            )}
          </div>
        </TabsContent>

        {/* Criteria */}
        <TabsContent value="criteria" className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Expected Outcome
            </h3>
            {tc.expectedOutcome ? (
              <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                <CardContent className="pt-3 pb-3">
                  <p className="text-sm whitespace-pre-wrap">{tc.expectedOutcome}</p>
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground italic">No expected outcome defined.</p>
            )}
          </div>
        </TabsContent>

        {/* Coverage */}
        <TabsContent value="coverage" className="mt-6">
          <CoverageTabContent tc={tc} />
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="mt-6">
          <HistoryTab id={id} canManage={canManage} />
        </TabsContent>

        {/* Discussion */}
        <TabsContent value="discussion" className="mt-6">
          <DiscussionTab id={id} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {editOpen && (
        <EditDialog
          id={id}
          initial={{
            title: tc.title,
            description: tc.description ?? '',
            priority: tc.priority,
            difficulty: tc.difficulty,
            status: tc.status,
            tags: tc.tags,
            steps: tc.steps ?? '',
            preconditions: tc.preconditions ?? '',
            expectedOutcome: tc.expectedOutcome ?? '',
          }}
          open
          onClose={() => setEditOpen(false)}
        />
      )}
      <SuggestDialog id={id} open={suggestOpen} onClose={() => setSuggestOpen(false)} />
      <CodeTemplateDialog
        title={tc.title}
        steps={tc.steps}
        open={codeOpen}
        onClose={() => setCodeOpen(false)}
      />
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
