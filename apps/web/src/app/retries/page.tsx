'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRetries } from '@/hooks/use-retries';
import { Pagination } from '@/components/Pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { RetriesSkeleton } from '@/components/skeletons';
import type { RetryRequestStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function RetryStatusBadge({ status }: { status: RetryRequestStatus }) {
  const classes: Record<RetryRequestStatus, string> = {
    PENDING:   'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-700',
    RUNNING:   'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-700',
    COMPLETED: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-800',
    EXPIRED:   'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-700/40 dark:text-zinc-500 dark:border-zinc-700',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium',
        classes[status],
      )}
    >
      {status === 'RUNNING' && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping inline-block" />
      )}
      {status}
    </span>
  );
}

function RetriesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '20');

  function onPageChange(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/retries?${params.toString()}`);
  }

  function onPageSizeChange(ps: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', String(ps));
    params.set('page', '1');
    router.push(`/retries?${params.toString()}`);
  }

  const { data, isLoading, prefetchNext } = useRetries(page, pageSize);
  const prefetchNextStable = useCallback(prefetchNext, [prefetchNext]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Retries</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data
            ? `${data.pagination.totalItems} retry request${data.pagination.totalItems !== 1 ? 's' : ''}`
            : 'Loading…'}
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base">Retry Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Test Case</TableHead>
                <TableHead className="text-muted-foreground">Team</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Requested</TableHead>
                <TableHead className="text-muted-foreground">Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-24 bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : data?.data.map((r) => (
                    <TableRow key={r.id} className="border-border hover:bg-muted/40">
                      <TableCell className="text-foreground text-sm max-w-xs">
                        <div className="truncate font-medium" title={r.testCase.title}>
                          {r.testCase.title}
                        </div>
                        <code className="text-xs text-muted-foreground truncate block">
                          {r.testCase.filePath}
                        </code>
                      </TableCell>
                      <TableCell className="text-foreground/80 text-sm">{r.team.name}</TableCell>
                      <TableCell>
                        <RetryStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {formatDate(r.requestedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {formatDate(r.completedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
              {!isLoading && data?.data.length === 0 && (
                <TableRow className="border-border">
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No retry requests yet
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
    </div>
  );
}

export default function RetriesPage() {
  return (
    <Suspense fallback={<RetriesSkeleton />}>
      <RetriesPageContent />
    </Suspense>
  );
}
