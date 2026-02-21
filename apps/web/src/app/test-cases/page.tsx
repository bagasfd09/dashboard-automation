'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { useTestCases, useGroupedTestCases, type TestCaseFilters } from '@/hooks/use-test-cases';
import { useTeams } from '@/hooks/use-teams';
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
import { Button } from '@/components/ui/button';
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
    <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-700 w-24">
      <div className="bg-green-500" style={{ width: `${passedPct}%` }} />
      <div className="bg-red-500" style={{ width: `${failedPct}%` }} />
      <div className="bg-zinc-600" style={{ width: `${noneRunPct}%` }} />
    </div>
  );
}

// ── Group accordion item ─────────────────────────────────────────────────────

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
    'flex items-center justify-between px-4 py-3 cursor-pointer select-none border-b border-zinc-800 transition-colors',
    stats.failed > 0
      ? 'hover:bg-red-950/30'
      : stats.passRate === 100 && stats.total > 0
        ? 'hover:bg-green-950/20'
        : 'hover:bg-zinc-800/50',
  );

  const accentClass = cn(
    'w-1 self-stretch rounded-full mr-3 shrink-0',
    stats.failed > 0
      ? 'bg-red-500'
      : stats.passRate === 100 && stats.total > 0
        ? 'bg-green-500'
        : 'bg-zinc-600',
  );

  // Collect failing test cases for "Retry All Failed"
  const failedTCs = group.testCases.filter((tc) => {
    // We don't have per-tc status in grouped view, but groups with failed>0 have failures.
    // We just show the button at the group level.
    return stats.failed > 0;
  });

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
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <div className={headerClass} onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={accentClass} />
          {open ? (
            <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
          )}
          <span className="font-medium text-sm text-zinc-100 truncate">{group.name}</span>
        </div>

        <div className="flex items-center gap-4 shrink-0 ml-4">
          <div className="hidden sm:flex items-center gap-2">
            <PassRateBar passed={stats.passed} failed={stats.failed} total={stats.total} />
            <span className="text-xs text-zinc-400 w-8 text-right">{stats.passRate}%</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="text-green-400">{stats.passed}✓</span>
            {stats.failed > 0 && <span className="text-red-400">{stats.failed}✗</span>}
            <span className="text-zinc-500">{stats.total} total</span>
          </div>
          {stats.failed > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); void retryAllFailed(); }}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded text-xs text-orange-400 border border-orange-800 hover:bg-orange-950/30 transition-colors"
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
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">Title</TableHead>
              <TableHead className="text-zinc-400">File Path</TableHead>
              <TableHead className="text-zinc-400">Tags</TableHead>
              <TableHead className="text-zinc-400">Team</TableHead>
              <TableHead className="text-zinc-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.testCases.map((tc) => (
              <TableRow
                key={tc.id}
                className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                onClick={() => onNavigate(tc.id)}
              >
                <TableCell className="text-zinc-100 text-sm font-medium max-w-xs truncate">
                  {tc.title}
                </TableCell>
                <TableCell className="max-w-xs">
                  <code className="text-xs text-zinc-400 font-mono truncate block">
                    {tc.filePath}
                  </code>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {tc.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs bg-zinc-800 text-zinc-300 border-zinc-700"
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
                    <span className="text-zinc-600 text-xs">—</span>
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
  onNavigate,
}: {
  groupBy: 'suite' | 'filePath' | 'tag' | 'team';
  filters: TestCaseFilters;
  onNavigate: (id: string) => void;
}) {
  const { data, isLoading } = useGroupedTestCases(groupBy, filters);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 bg-zinc-800 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data?.groups.length) {
    return (
      <div className="text-center text-zinc-500 py-12">No test cases found</div>
    );
  }

  return (
    <div className="space-y-3">
      {data.groups.map((group, i) => (
        <GroupAccordion
          key={group.name}
          group={group}
          defaultOpen={i === 0 || group.stats.failed > 0}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

// ── Flat view (existing table) ───────────────────────────────────────────────

function FlatView({
  filters,
  onNavigate,
}: {
  filters: TestCaseFilters;
  onNavigate: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useTestCases(filters, page);
  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <>
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">
            Test Cases
            {data && (
              <span className="ml-2 text-zinc-500 font-normal text-sm">({data.total} total)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Title</TableHead>
                <TableHead className="text-zinc-400">File Path</TableHead>
                <TableHead className="text-zinc-400">Tags</TableHead>
                <TableHead className="text-zinc-400">Team</TableHead>
                <TableHead className="text-zinc-400">Updated</TableHead>
                <TableHead className="text-zinc-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-zinc-800">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-24 bg-zinc-800" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : data?.items.map((tc: TestCase) => (
                    <TableRow
                      key={tc.id}
                      className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                      onClick={() => onNavigate(tc.id)}
                    >
                      <TableCell className="text-zinc-100 text-sm font-medium max-w-xs truncate">
                        {tc.title}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <code className="text-xs text-zinc-400 font-mono truncate block">
                          {tc.filePath}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {tc.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs bg-zinc-800 text-zinc-300 border-zinc-700"
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
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-400 text-xs">
                        {formatDate(tc.updatedAt)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <RetryButton testCaseId={tc.id} teamId={tc.teamId} />
                      </TableCell>
                    </TableRow>
                  ))}
              {!isLoading && data?.items.length === 0 && (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={6} className="text-center text-zinc-500 py-8">
                    No test cases found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Previous
          </Button>
          <span className="text-zinc-400 text-sm">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TestCasesPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<TestCaseFilters>({});
  const [searchInput, setSearchInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist groupBy to localStorage
  const [groupBy, setGroupBy] = useState<GroupByOption>(() => {
    if (typeof window === 'undefined') return 'suite';
    return (localStorage.getItem('tc-groupBy') as GroupByOption) ?? 'suite';
  });

  function handleGroupByChange(value: GroupByOption) {
    setGroupBy(value);
    if (typeof window !== 'undefined') localStorage.setItem('tc-groupBy', value);
  }

  const { data: teams } = useTeams();

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput || undefined }));
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchInput]);

  // Debounced tag filter
  useEffect(() => {
    if (tagTimer.current) clearTimeout(tagTimer.current);
    tagTimer.current = setTimeout(() => {
      setFilters((f) => ({ ...f, tag: tagInput || undefined }));
    }, 300);
    return () => { if (tagTimer.current) clearTimeout(tagTimer.current); };
  }, [tagInput]);

  function onTeamChange(value: string) {
    setFilters((f) => ({ ...f, teamId: value === 'all' ? undefined : value }));
  }

  function navigateToTestCase(id: string) {
    router.push(`/test-cases/${id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Test Cases</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Browse and group test cases by suite, file, tag, or team.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Search by title…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-52 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
        />
        <Input
          placeholder="Filter by tag…"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          className="w-40 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
        />
        <Select onValueChange={onTeamChange} defaultValue="all">
          <SelectTrigger className="w-44 bg-zinc-900 border-zinc-700 text-zinc-100">
            <SelectValue placeholder="All teams" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
            <SelectItem value="all" className="focus:bg-zinc-800">All teams</SelectItem>
            {teams?.map((team) => (
              <SelectItem key={team.id} value={team.id} className="focus:bg-zinc-800">
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-zinc-400">Group by:</span>
          <Select value={groupBy} onValueChange={handleGroupByChange}>
            <SelectTrigger className="w-36 bg-zinc-900 border-zinc-700 text-zinc-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
              {GROUP_BY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="focus:bg-zinc-800">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {groupBy === 'none' ? (
        <FlatView filters={filters} onNavigate={navigateToTestCase} />
      ) : (
        <GroupedView
          groupBy={groupBy}
          filters={filters}
          onNavigate={navigateToTestCase}
        />
      )}
    </div>
  );
}
