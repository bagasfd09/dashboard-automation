'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTestCases, type TestCaseFilters } from '@/hooks/use-test-cases';
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
import { teamColorClass } from '@/lib/team-colors';
import { cn } from '@/lib/utils';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export default function TestCasesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TestCaseFilters>({});
  const [searchInput, setSearchInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useTestCases(filters, page);
  const { data: teams } = useTeams();
  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput || undefined }));
      setPage(1);
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchInput]);

  // Debounced tag filter
  useEffect(() => {
    if (tagTimer.current) clearTimeout(tagTimer.current);
    tagTimer.current = setTimeout(() => {
      setFilters((f) => ({ ...f, tag: tagInput || undefined }));
      setPage(1);
    }, 300);
    return () => {
      if (tagTimer.current) clearTimeout(tagTimer.current);
    };
  }, [tagInput]);

  function onTeamChange(value: string) {
    setFilters((f) => ({ ...f, teamId: value === 'all' ? undefined : value }));
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Test Cases</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {data ? `${data.total} total test cases` : 'Loading…'}
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
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
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Test Cases</CardTitle>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-zinc-800">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-24 bg-zinc-800" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : data?.items.map((tc) => (
                    <TableRow
                      key={tc.id}
                      className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                      onClick={() => router.push(`/test-cases/${tc.id}`)}
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
                              teamColorClass(tc.team.id)
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
                    </TableRow>
                  ))}
              {!isLoading && data?.items.length === 0 && (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={5} className="text-center text-zinc-500 py-8">
                    No test cases found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
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
    </div>
  );
}
