'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import {
  useTestCases,
  useGroupedTestCases,
  useSuiteTestCases,
  type TestCaseFilters,
} from '@/hooks/use-test-cases';
import { useTeams } from '@/hooks/use-teams';
import { Pagination } from '@/components/Pagination';
import { InnerPagination } from '@/components/InnerPagination';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RetryButton } from '@/components/RetryButton';
import { teamColorClass } from '@/lib/team-colors';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { TestCase, TestCaseGroup } from '@/lib/types';

type GroupByOption = 'none' | 'suite' | 'filePath' | 'tag' | 'team';

const GROUP_BY_OPTIONS: { value: GroupByOption; label: string }[] = [
  { value: 'suite', label: 'Suite' },
  { value: 'filePath', label: 'File Path' },
  { value: 'tag', label: 'Tag' },
  { value: 'team', label: 'Team' },
  { value: 'none', label: 'None (flat)' },
];

const INNER_PAGE_SIZE = 5;
const OUTER_GROUP_PAGE_SIZE = 10;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

// ── Pass-rate bar ────────────────────────────────────────────────────────────

function PassRateBar({ passed, failed, total }: { passed: number; failed: number; total: number }) {
  if (!total) return null;
  const passedPct = (passed / total) * 100;
  const failedPct = (failed / total) * 100;
  const noneRunPct = 100 - passedPct - failedPct;

  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-muted w-24">
      <div className="bg-green-500" style={{ width: `${passedPct}%` }} />
      <div className="bg-red-500" style={{ width: `${failedPct}%` }} />
      <div className="bg-muted-foreground/30" style={{ width: `${noneRunPct}%` }} />
    </div>
  );
}

// ── Suite accordion with inner pagination ────────────────────────────────────

function SuiteAccordion({
  group,
  outerPage,
  defaultOpen,
  onNavigate,
  filters,
}: {
  group: TestCaseGroup;
  outerPage: number;
  defaultOpen: boolean;
  onNavigate: (id: string) => void;
  filters: TestCaseFilters;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [innerPage, setInnerPage] = useState(1);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setInnerPage(1);
    setShowAll(false);
  }, [outerPage]);

  const { stats, pagination: groupPagination } = group;
  const hasInnerPagination = (groupPagination?.totalPages ?? 1) > 1;

  const effectivePageSize = showAll
    ? Math.min(groupPagination?.totalItems ?? 999, 500)
    : (groupPagination?.pageSize ?? INNER_PAGE_SIZE);

  const { data: suiteData, isLoading: suiteLoading } = useSuiteTestCases(
    group.name,
    filters.teamId,
    showAll ? 1 : innerPage,
    effectivePageSize,
    filters,
    open && (innerPage > 1 || showAll),
  );

  const testCases = (innerPage > 1 || showAll) && suiteData
    ? suiteData.data
    : group.testCases;

  const paginationMeta = (innerPage > 1 || showAll) && suiteData
    ? suiteData.pagination
    : groupPagination;

  const accentClass = cn(
    'w-1 self-stretch rounded-full mr-3 shrink-0',
    stats.failed > 0 ? 'bg-red-500'
      : stats.passRate === 100 && stats.total > 0 ? 'bg-green-500'
      : 'bg-muted-foreground/40',
  );

  const headerClass = cn(
    'flex items-center justify-between px-4 py-3 cursor-pointer select-none border-b border-border transition-colors',
    stats.failed > 0
      ? 'hover:bg-red-50 dark:hover:bg-red-950/30'
      : stats.passRate === 100 && stats.total > 0
      ? 'hover:bg-green-50/80 dark:hover:bg-green-950/20'
      : 'hover:bg-muted/50',
  );

  async function retryAllFailed() {
    for (const tc of group.testCases) {
      try {
        await api.requestRetry(tc.id, tc.teamId);
      } catch {
        // individual failures silently skipped
      }
    }
    toast.info(`Retry queued for failed test(s) in "${group.name}"`);
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className={headerClass} onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={accentClass} />
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="font-medium text-sm text-foreground truncate">{group.name}</span>
        </div>

        <div className="flex items-center gap-4 shrink-0 ml-4">
          <div className="hidden sm:flex items-center gap-2">
            <PassRateBar passed={stats.passed} failed={stats.failed} total={stats.total} />
            <span className="text-xs text-muted-foreground w-8 text-right">{stats.passRate}%</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-green-600 dark:text-green-400">{stats.passed}✓</span>
            {stats.failed > 0 && <span className="text-red-600 dark:text-red-400">{stats.failed}✗</span>}
            <span className="text-muted-foreground">{stats.total} total</span>
          </div>
          {stats.failed > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); void retryAllFailed(); }}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded text-xs text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Retry all failed
            </button>
          )}
        </div>
      </div>

      {open && (
        <>
          {suiteLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 bg-muted rounded" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Title</TableHead>
                  <TableHead className="text-muted-foreground">File Path</TableHead>
                  <TableHead className="text-muted-foreground">Tags</TableHead>
                  <TableHead className="text-muted-foreground">Team</TableHead>
                  <TableHead className="text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testCases.map((tc) => (
                  <TableRow
                    key={tc.id}
                    className="border-border hover:bg-muted/50 cursor-pointer"
                    onClick={() => onNavigate(tc.id)}
                  >
                    <TableCell className="text-foreground text-sm font-medium max-w-xs truncate">
                      {tc.title}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <code className="text-xs text-muted-foreground font-mono truncate block">
                        {tc.filePath}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {tc.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs bg-muted text-muted-foreground border-border"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {tc.team ? (
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium',
                            teamColorClass(tc.team.id),
                          )}
                        >
                          {tc.team.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <RetryButton testCaseId={tc.id} teamId={tc.teamId} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {hasInnerPagination && !showAll && (
            <InnerPagination
              currentPage={innerPage}
              totalPages={paginationMeta?.totalPages ?? 1}
              totalItems={paginationMeta?.totalItems ?? testCases.length}
              pageSize={paginationMeta?.pageSize ?? INNER_PAGE_SIZE}
              onPageChange={setInnerPage}
              onShowAll={() => {
                setShowAll(true);
                setInnerPage(1);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Generic group accordion (for filePath / tag / team groupBy) ───────────────

function GroupAccordion({
  group,
  defaultOpen,
  onNavigate,
}: {
  group: TestCaseGroup;
  defaultOpen: boolean;
  onNavigate: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { stats } = group;

  const headerClass = cn(
    'flex items-center justify-between px-4 py-3 cursor-pointer select-none border-b border-border transition-colors',
    stats.failed > 0
      ? 'hover:bg-red-50 dark:hover:bg-red-950/30'
      : stats.passRate === 100 && stats.total > 0
        ? 'hover:bg-green-50/80 dark:hover:bg-green-950/20'
        : 'hover:bg-muted/50',
  );

  const accentClass = cn(
    'w-1 self-stretch rounded-full mr-3 shrink-0',
    stats.failed > 0
      ? 'bg-red-500'
      : stats.passRate === 100 && stats.total > 0
        ? 'bg-green-500'
        : 'bg-muted-foreground/40',
  );

  async function retryAllFailed() {
    for (const tc of group.testCases) {
      try {
        await api.requestRetry(tc.id, tc.teamId);
      } catch {
        // individual failures silently skipped
      }
    }
    toast.info(`Retry queued for ${group.testCases.length} test(s) in "${group.name}"`);
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className={headerClass} onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={accentClass} />
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="font-medium text-sm text-foreground truncate">{group.name}</span>
        </div>

        <div className="flex items-center gap-4 shrink-0 ml-4">
          <div className="hidden sm:flex items-center gap-2">
            <PassRateBar passed={stats.passed} failed={stats.failed} total={stats.total} />
            <span className="text-xs text-muted-foreground w-8 text-right">{stats.passRate}%</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-green-600 dark:text-green-400">{stats.passed}✓</span>
            {stats.failed > 0 && <span className="text-red-600 dark:text-red-400">{stats.failed}✗</span>}
            <span className="text-muted-foreground">{stats.total} total</span>
          </div>
          {stats.failed > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); void retryAllFailed(); }}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded text-xs text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Retry all failed
            </button>
          )}
        </div>
      </div>

      {open && (
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Title</TableHead>
              <TableHead className="text-muted-foreground">File Path</TableHead>
              <TableHead className="text-muted-foreground">Tags</TableHead>
              <TableHead className="text-muted-foreground">Team</TableHead>
              <TableHead className="text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.testCases.map((tc) => (
              <TableRow
                key={tc.id}
                className="border-border hover:bg-muted/50 cursor-pointer"
                onClick={() => onNavigate(tc.id)}
              >
                <TableCell className="text-foreground text-sm font-medium max-w-xs truncate">
                  {tc.title}
                </TableCell>
                <TableCell className="max-w-xs">
                  <code className="text-xs text-muted-foreground font-mono truncate block">
                    {tc.filePath}
                  </code>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {tc.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs bg-muted text-muted-foreground border-border"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {tc.team ? (
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium',
                        teamColorClass(tc.team.id),
                      )}
                    >
                      {tc.team.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60 text-xs">—</span>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <RetryButton testCaseId={tc.id} teamId={tc.teamId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Grouped view ─────────────────────────────────────────────────────────────

function GroupedView({
  groupBy,
  filters,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onNavigate,
}: {
  groupBy: 'suite' | 'filePath' | 'tag' | 'team';
  filters: TestCaseFilters;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (ps: number) => void;
  onNavigate: (id: string) => void;
}) {
  const { data, isLoading } = useGroupedTestCases(
    groupBy,
    filters,
    page,
    pageSize,
    INNER_PAGE_SIZE,
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data?.groups.length) {
    return (
      <div className="text-center text-muted-foreground py-12">No test cases found</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {data.groups.map((group, i) =>
          groupBy === 'suite' ? (
            <SuiteAccordion
              key={`${group.name}-${page}`}
              group={group}
              outerPage={page}
              defaultOpen={i === 0 || group.stats.failed > 0}
              onNavigate={onNavigate}
              filters={filters}
            />
          ) : (
            <GroupAccordion
              key={group.name}
              group={group}
              defaultOpen={i === 0 || group.stats.failed > 0}
              onNavigate={onNavigate}
            />
          )
        )}
      </div>

      {data.pagination && (
        <Pagination
          currentPage={data.pagination.page}
          totalPages={data.pagination.totalPages}
          totalItems={data.pagination.totalItems}
          pageSize={data.pagination.pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}

// ── Flat view ─────────────────────────────────────────────────────────────────

function FlatView({
  filters,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onNavigate,
}: {
  filters: TestCaseFilters;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (ps: number) => void;
  onNavigate: (id: string) => void;
}) {
  const { data, isLoading, prefetchNext } = useTestCases(filters, page, pageSize);
  const prefetchNextStable = useCallback(prefetchNext, [prefetchNext]);

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base">
            Test Cases
            {data && (
              <span className="ml-2 text-muted-foreground font-normal text-sm">
                ({data.pagination.totalItems} total)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Title</TableHead>
                <TableHead className="text-muted-foreground">File Path</TableHead>
                <TableHead className="text-muted-foreground">Tags</TableHead>
                <TableHead className="text-muted-foreground">Team</TableHead>
                <TableHead className="text-muted-foreground">Updated</TableHead>
                <TableHead className="text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-24 bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : data?.data.map((tc: TestCase) => (
                    <TableRow
                      key={tc.id}
                      className="border-border hover:bg-muted/50 cursor-pointer"
                      onClick={() => onNavigate(tc.id)}
                    >
                      <TableCell className="text-foreground text-sm font-medium max-w-xs truncate">
                        {tc.title}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <code className="text-xs text-muted-foreground font-mono truncate block">
                          {tc.filePath}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {tc.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs bg-muted text-muted-foreground border-border"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {tc.team ? (
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium',
                              teamColorClass(tc.team.id),
                            )}
                          >
                            {tc.team.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(tc.updatedAt)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <RetryButton testCaseId={tc.id} teamId={tc.teamId} />
                      </TableCell>
                    </TableRow>
                  ))}
              {!isLoading && data?.data.length === 0 && (
                <TableRow className="border-border">
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No test cases found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data && (
        <Pagination
          currentPage={data.pagination.page}
          totalPages={data.pagination.totalPages}
          totalItems={data.pagination.totalItems}
          pageSize={data.pagination.pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          onPrefetchNext={prefetchNextStable}
        />
      )}
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function TestCasesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? String(OUTER_GROUP_PAGE_SIZE));
  const groupByParam = (searchParams.get('groupBy') as GroupByOption | null) ?? null;

  const [groupBy, setGroupBy] = useState<GroupByOption>(() => {
    if (groupByParam) return groupByParam;
    if (typeof window === 'undefined') return 'suite';
    return (localStorage.getItem('tc-groupBy') as GroupByOption) ?? 'suite';
  });

  useEffect(() => {
    if (groupByParam && groupByParam !== groupBy) {
      setGroupBy(groupByParam);
    }
  }, [groupByParam]);

  const [filters, setFilters] = useState<TestCaseFilters>({});
  const [searchInput, setSearchInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: teams } = useTeams();

  function resetToPage1() {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', '1');
    router.replace(`/test-cases?${params.toString()}`);
  }

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput || undefined }));
      resetToPage1();
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchInput]);

  useEffect(() => {
    if (tagTimer.current) clearTimeout(tagTimer.current);
    tagTimer.current = setTimeout(() => {
      setFilters((f) => ({ ...f, tag: tagInput || undefined }));
      resetToPage1();
    }, 300);
    return () => { if (tagTimer.current) clearTimeout(tagTimer.current); };
  }, [tagInput]);

  function onTeamChange(value: string) {
    setFilters((f) => ({ ...f, teamId: value === 'all' ? undefined : value }));
    resetToPage1();
  }

  function handleGroupByChange(value: GroupByOption) {
    setGroupBy(value);
    if (typeof window !== 'undefined') localStorage.setItem('tc-groupBy', value);
    const params = new URLSearchParams(searchParams.toString());
    params.set('groupBy', value);
    params.set('page', '1');
    router.push(`/test-cases?${params.toString()}`);
  }

  function onPageChange(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/test-cases?${params.toString()}`);
  }

  function onPageSizeChange(ps: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', String(ps));
    params.set('page', '1');
    router.push(`/test-cases?${params.toString()}`);
  }

  function navigateToTestCase(id: string) {
    router.push(`/test-cases/${id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Test Cases</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse and group test cases by suite, file, tag, or team.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Search by title…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-52 bg-card border-border text-foreground placeholder:text-muted-foreground"
        />
        <Input
          placeholder="Filter by tag…"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          className="w-40 bg-card border-border text-foreground placeholder:text-muted-foreground"
        />
        <Select onValueChange={onTeamChange} defaultValue="all">
          <SelectTrigger className="w-44 bg-card border-border text-foreground">
            <SelectValue placeholder="All teams" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            <SelectItem value="all" className="focus:bg-muted">All teams</SelectItem>
            {teams?.map((team) => (
              <SelectItem key={team.id} value={team.id} className="focus:bg-muted">
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">Group by:</span>
          <Select value={groupBy} onValueChange={handleGroupByChange}>
            <SelectTrigger className="w-36 bg-card border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              {GROUP_BY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="focus:bg-muted">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {groupBy === 'none' ? (
        <FlatView
          filters={filters}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          onNavigate={navigateToTestCase}
        />
      ) : (
        <GroupedView
          groupBy={groupBy}
          filters={filters}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          onNavigate={navigateToTestCase}
        />
      )}
    </div>
  );
}

function TestCasesPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40 bg-muted" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-52 bg-muted" />
        <Skeleton className="h-10 w-40 bg-muted" />
        <Skeleton className="h-10 w-44 bg-muted" />
      </div>
      <Skeleton className="h-64 bg-muted rounded-lg" />
    </div>
  );
}

export default function TestCasesPage() {
  return (
    <Suspense fallback={<TestCasesPageSkeleton />}>
      <TestCasesPageContent />
    </Suspense>
  );
}
