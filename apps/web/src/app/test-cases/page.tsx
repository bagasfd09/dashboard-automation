'use client';

import { Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import {
  useGroupedTestCases,
  useTestCases,
  useSuiteTestCases,
  type TestCaseFilters,
} from '@/hooks/use-test-cases';
import { useAppContext } from '@/providers/AppContextProvider';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { Pagination } from '@/components/Pagination';
import { InnerPagination } from '@/components/InnerPagination';
import { StatusBar } from '@/components/ui/status-bar';
import { FilterChip } from '@/components/ui/filter-chip';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { similarityScore } from '@/lib/fuzzy-match';
import { cn } from '@/lib/utils';
import type { TestCase, TestCaseGroup } from '@/lib/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const INNER_PAGE_SIZE = 5;
const GROUPED_PAGE_SIZE = 10;
const FLAT_PAGE_SIZE = 20;

// ── TestCaseRow ───────────────────────────────────────────────────────────────

function TestCaseRow({
  tc,
  isLast,
  libraryMatch,
  onNavigate,
}: {
  tc: TestCase;
  isLast: boolean;
  libraryMatch: { libraryId: string } | undefined;
  onNavigate: (id: string) => void;
}) {
  const queryClient = useQueryClient();

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 cursor-pointer transition-colors',
        !isLast && 'border-b border-border/20',
      )}
      onClick={() => onNavigate(tc.id)}
      onMouseEnter={() => {
        queryClient.prefetchQuery({
          queryKey: ['test-case', tc.id],
          queryFn: () => api.getTestCase(tc.id),
          staleTime: 10_000,
        });
      }}
    >
      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-foreground truncate">{tc.title}</p>
        {tc.suiteName && (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{tc.suiteName}</p>
        )}
      </div>

      <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block font-mono">
        {tc.id.slice(0, 8)}
      </span>

      {libraryMatch && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.location.href = `/library/test-cases/${libraryMatch.libraryId}`;
          }}
          title="Linked to Library"
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0"
        >
          📚
        </button>
      )}

      {tc.tags.length > 0 && (
        <div className="hidden lg:flex items-center gap-1 shrink-0">
          {tc.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
          {tc.tags.length > 2 && (
            <span className="text-[9px] text-muted-foreground">+{tc.tags.length - 2}</span>
          )}
        </div>
      )}

      <span className="text-[11px] text-muted-foreground shrink-0">→</span>
    </div>
  );
}

// ── SuiteCard ─────────────────────────────────────────────────────────────────

function SuiteCard({
  group,
  outerPage,
  filters,
  onNavigate,
  libraryMap,
}: {
  group: TestCaseGroup;
  outerPage: number;
  filters: TestCaseFilters;
  onNavigate: (id: string) => void;
  libraryMap: Map<string, { libraryId: string }>;
}) {
  const [innerPage, setInnerPage] = useState(1);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setInnerPage(1);
    setShowAll(false);
  }, [outerPage]);

  const effectivePageSize = showAll
    ? Math.min(group.pagination?.totalItems ?? 200, 200)
    : INNER_PAGE_SIZE;

  const { data: suiteData, isLoading: suiteLoading } = useSuiteTestCases(
    group.name,
    filters.teamId,
    showAll ? 1 : innerPage,
    effectivePageSize,
    filters,
    innerPage > 1 || showAll,
  );

  const testCases = (innerPage > 1 || showAll) && suiteData ? suiteData.data : group.testCases;
  const paginationMeta =
    (innerPage > 1 || showAll) && suiteData ? suiteData.pagination : group.pagination;
  const hasInnerPagination = (paginationMeta?.totalPages ?? 1) > 1;

  const { stats } = group;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50 bg-muted/20">
        <span className="text-sm">📁</span>
        <span className="text-[13px] font-semibold text-foreground flex-1 truncate">{group.name}</span>
        <span className="text-[11px] text-muted-foreground shrink-0">{stats.total} tests</span>
        <StatusBar
          passed={stats.passed}
          failed={stats.failed}
          skipped={stats.total - stats.passed - stats.failed}
          total={stats.total}
          height={4}
          animated={false}
          className="w-16 shrink-0"
        />
      </div>

      {suiteLoading ? (
        <div className="p-3 space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {testCases.map((tc, i) => (
            <TestCaseRow
              key={tc.id}
              tc={tc}
              isLast={i === testCases.length - 1}
              libraryMatch={libraryMap.get(tc.id)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}

      {hasInnerPagination && !showAll && (
        <InnerPagination
          currentPage={innerPage}
          totalPages={paginationMeta?.totalPages ?? 1}
          totalItems={paginationMeta?.totalItems ?? testCases.length}
          pageSize={paginationMeta?.pageSize ?? INNER_PAGE_SIZE}
          onPageChange={(p) => {
            setInnerPage(p);
          }}
          onShowAll={() => {
            setShowAll(true);
            setInnerPage(1);
          }}
        />
      )}
    </div>
  );
}

// ── SuiteView ─────────────────────────────────────────────────────────────────

function SuiteView({
  filters,
  page,
  pageSize,
  statusFilter,
  onPageChange,
  onPageSizeChange,
  onNavigate,
  libraryMap,
}: {
  filters: TestCaseFilters;
  page: number;
  pageSize: number;
  statusFilter: string;
  onPageChange: (p: number) => void;
  onPageSizeChange: (ps: number) => void;
  onNavigate: (id: string) => void;
  libraryMap: Map<string, { libraryId: string }>;
}) {
  const { data, isLoading } = useGroupedTestCases('suite', filters, page, pageSize, INNER_PAGE_SIZE);

  const visibleGroups = useMemo(() => {
    if (!data?.groups) return [];
    if (statusFilter === 'failed') return data.groups.filter((g) => g.stats.failed > 0);
    if (statusFilter === 'passed') return data.groups.filter((g) => g.stats.passRate === 100 && g.stats.total > 0);
    return data.groups;
  }, [data?.groups, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (!visibleGroups.length) {
    return (
      <div className="py-16 text-center text-muted-foreground text-[13px]">
        No test cases found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleGroups.map((group) => (
        <SuiteCard
          key={`${group.name}-${page}`}
          group={group}
          outerPage={page}
          filters={filters}
          onNavigate={onNavigate}
          libraryMap={libraryMap}
        />
      ))}

      {data?.pagination && (
        <div className="mt-4">
          <Pagination
            currentPage={data.pagination.page}
            totalPages={data.pagination.totalPages}
            totalItems={data.pagination.totalItems}
            pageSize={data.pagination.pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}
    </div>
  );
}

// ── FlatListView ──────────────────────────────────────────────────────────────

function FlatListView({
  filters,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onNavigate,
  libraryMap,
}: {
  filters: TestCaseFilters;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (ps: number) => void;
  onNavigate: (id: string) => void;
  libraryMap: Map<string, { libraryId: string }>;
}) {
  const { data, isLoading, prefetchNext } = useTestCases(filters, page, pageSize);
  const prefetchNextStable = useCallback(prefetchNext, [prefetchNext]);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-3 space-y-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
        ) : data?.data.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-[13px]">
            No test cases found
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {data?.data.map((tc: TestCase, i: number) => (
              <TestCaseRow
                key={tc.id}
                tc={tc}
                isLast={i === (data.data.length - 1)}
                libraryMatch={libraryMap.get(tc.id)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}

// ── TestCasesPageSkeleton ─────────────────────────────────────────────────────

function TestCasesPageSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-6 w-36 bg-muted" />
        <Skeleton className="h-4 w-52 bg-muted mt-1.5" />
      </div>
      <Skeleton className="h-16 w-full bg-muted rounded-xl" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-16 bg-muted rounded-lg" />
        <Skeleton className="h-8 w-20 bg-muted rounded-lg" />
        <Skeleton className="h-8 w-20 bg-muted rounded-lg" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-28 bg-muted rounded-lg" />
          <Skeleton className="h-8 w-48 bg-muted rounded-full" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full bg-muted rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ── TestCasesPageContent ──────────────────────────────────────────────────────

function TestCasesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedApp } = useAppContext();

  // URL-driven state
  const page = Number(searchParams.get('page') ?? '1');
  const groupMode = (searchParams.get('group') as 'suite' | 'flat' | null) ?? 'suite';
  const statusFilter = searchParams.get('status') ?? 'all';
  const searchParam = searchParams.get('search') ?? '';

  // Local state for search input (immediate UI) debounced to URL
  const [searchInput, setSearchInput] = useState(searchParam);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync search input if URL changes externally (e.g. browser back)
  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  // Debounce search → URL
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchInput) {
        params.set('search', searchInput);
      } else {
        params.delete('search');
      }
      params.set('page', '1');
      router.replace(`/test-cases?${params.toString()}`);
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Keyboard shortcut: "/" focuses search
  useKeyboardShortcut('/', () => {
    searchInputRef.current?.focus();
  });

  const pageSize = groupMode === 'flat' ? FLAT_PAGE_SIZE : GROUPED_PAGE_SIZE;

  const filters: TestCaseFilters = {
    search: searchParam || undefined,
  };

  // For flat view with status filter, extend filters
  const flatFilters: TestCaseFilters & { status?: string } = {
    ...filters,
    ...(statusFilter !== 'all' ? { status: statusFilter === 'failed' ? 'FAILED' : 'PASSED' } : {}),
  };

  // Grouped data (always fetched for summary strip)
  const { data: groupedData, isLoading: groupedLoading } = useGroupedTestCases(
    'suite',
    filters,
    page,
    pageSize,
    INNER_PAGE_SIZE,
  );

  // Library test cases for fuzzy matching
  const { data: libraryTestCasesData } = useQuery({
    queryKey: ['library-test-cases-for-matching'],
    queryFn: () => api.getLibraryTestCases({ pageSize: 200 }),
    staleTime: 5 * 60_000,
  });

  // Compute libraryMap: Map<testCaseId, { libraryId }>
  const libraryMap = useMemo(() => {
    const map = new Map<string, { libraryId: string }>();
    if (!libraryTestCasesData?.data || !groupedData?.groups) return map;

    for (const group of groupedData.groups) {
      for (const tc of group.testCases) {
        for (const ltc of libraryTestCasesData.data) {
          if (similarityScore(tc.title, ltc.title) >= 70) {
            map.set(tc.id, { libraryId: ltc.id });
            break;
          }
        }
      }
    }
    return map;
  }, [groupedData?.groups, libraryTestCasesData?.data]);

  // Summary strip stats (aggregated from all groups)
  const summaryStats = useMemo(() => {
    if (!groupedData?.groups) return { totalPassed: 0, totalFailed: 0, totalTests: 0 };
    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;
    for (const group of groupedData.groups) {
      totalPassed += group.stats.passed;
      totalFailed += group.stats.failed;
      totalTests += group.stats.total;
    }
    return { totalPassed, totalFailed, totalTests };
  }, [groupedData?.groups]);

  const totalCount = groupedData?.pagination.totalItems ?? 0;
  const suiteCount = groupedData?.groups.length ?? 0;
  const flakyCount = 0; // placeholder — requires result history

  function setGroupMode(mode: 'suite' | 'flat') {
    const params = new URLSearchParams(searchParams.toString());
    params.set('group', mode);
    params.set('page', '1');
    router.replace(`/test-cases?${params.toString()}`);
  }

  function setStatus(s: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('status', s);
    params.set('page', '1');
    router.replace(`/test-cases?${params.toString()}`);
  }

  function onPageChange(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.replace(`/test-cases?${params.toString()}`);
  }

  function onPageSizeChange(ps: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', String(ps));
    params.set('page', '1');
    router.replace(`/test-cases?${params.toString()}`);
  }

  function navigateToTestCase(id: string) {
    router.push(`/test-cases/${id}`);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[20px] font-bold text-foreground">
          Test Cases{selectedApp ? ` · ${selectedApp.name}` : ''}
        </h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {groupedLoading ? (
            <span className="opacity-50">Loading…</span>
          ) : (
            <>
              {totalCount} test cases across {suiteCount} suite{suiteCount !== 1 ? 's' : ''}
            </>
          )}
        </p>
      </div>

      {/* Summary strip */}
      <div className="bg-card border border-border rounded-xl p-3.5 px-5">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            {groupedLoading ? (
              <Skeleton className="h-[10px] w-full bg-muted rounded-full" />
            ) : (
              <StatusBar
                passed={summaryStats.totalPassed}
                failed={summaryStats.totalFailed}
                skipped={0}
                total={summaryStats.totalTests}
                height={10}
                showLabels={false}
              />
            )}
          </div>
          <div className="flex gap-5 shrink-0">
            <div className="text-center">
              <p className="text-[18px] font-bold text-green-500">
                {groupedLoading ? '—' : summaryStats.totalPassed}
              </p>
              <p className="text-[10px] text-muted-foreground">Passed</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-red-500">
                {groupedLoading ? '—' : summaryStats.totalFailed}
              </p>
              <p className="text-[10px] text-muted-foreground">Failed</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-purple-500">{flakyCount}</p>
              <p className="text-[10px] text-muted-foreground">Flaky</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Controls Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status filter chips */}
        <FilterChip
          label="All"
          active={statusFilter === 'all'}
          count={totalCount}
          onClick={() => setStatus('all')}
        />
        <FilterChip
          label="Failed"
          active={statusFilter === 'failed'}
          count={summaryStats.totalFailed}
          icon="✗"
          onClick={() => setStatus('failed')}
        />
        <FilterChip
          label="Passed"
          active={statusFilter === 'passed'}
          count={summaryStats.totalPassed}
          onClick={() => setStatus('passed')}
        />

        {/* Right side controls */}
        <div className="flex gap-2 ml-auto items-center">
          {/* Group toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
            {(['suite', 'flat'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setGroupMode(mode)}
                className={cn(
                  'px-3 py-1.5 text-[12px] font-medium transition-colors',
                  groupMode === mode
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                )}
              >
                {mode === 'suite' ? 'By Suite' : 'Flat List'}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search test cases..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-48 pl-8 pr-3 py-[6px] text-[12px] rounded-full border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {groupMode === 'suite' ? (
        <SuiteView
          filters={filters}
          page={page}
          pageSize={pageSize}
          statusFilter={statusFilter}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          onNavigate={navigateToTestCase}
          libraryMap={libraryMap}
        />
      ) : (
        <FlatListView
          filters={flatFilters}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          onNavigate={navigateToTestCase}
          libraryMap={libraryMap}
        />
      )}
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function TestCasesPage() {
  return (
    <Suspense fallback={<TestCasesPageSkeleton />}>
      <TestCasesPageContent />
    </Suspense>
  );
}
