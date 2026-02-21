'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
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
import type { RetryRequestStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function StatusBadge({ status }: { status: RetryRequestStatus }) {
  const classes: Record<RetryRequestStatus, string> = {
    PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-700',
    RUNNING: 'bg-blue-500/10 text-blue-400 border-blue-700',
    COMPLETED: 'bg-green-500/10 text-green-400 border-green-800',
    EXPIRED: 'bg-zinc-700/40 text-zinc-500 border-zinc-700',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium',
        classes[status],
      )}
    >
      {status === 'RUNNING' && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping inline-block" />
      )}
      {status}
    </span>
  );
}

export default function RetriesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['retries'],
    queryFn: () => api.getRetries({ limit: 50 }),
    refetchInterval: 10_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Retries</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {data ? `${data.total} retry request${data.total !== 1 ? 's' : ''}` : 'Loading…'}
        </p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Retry Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Test Case</TableHead>
                <TableHead className="text-zinc-400">Team</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400">Requested</TableHead>
                <TableHead className="text-zinc-400">Completed</TableHead>
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
                : data?.items.map((r) => (
                    <TableRow key={r.id} className="border-zinc-800 hover:bg-zinc-800/40">
                      <TableCell className="text-zinc-100 text-sm max-w-xs">
                        <div className="truncate font-medium" title={r.testCase.title}>
                          {r.testCase.title}
                        </div>
                        <code className="text-xs text-zinc-500 truncate block">
                          {r.testCase.filePath}
                        </code>
                      </TableCell>
                      <TableCell className="text-zinc-300 text-sm">{r.team.name}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-zinc-400 text-xs whitespace-nowrap">
                        {formatDate(r.requestedAt)}
                      </TableCell>
                      <TableCell className="text-zinc-400 text-xs whitespace-nowrap">
                        {formatDate(r.completedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
              {!isLoading && data?.items.length === 0 && (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={5} className="text-center text-zinc-500 py-8">
                    No retry requests yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
