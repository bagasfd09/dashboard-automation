'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Pagination } from '@/components/Pagination';
import { Skeleton } from '@/components/ui/skeleton';
import type { ActivityLogEntry } from '@/lib/types';

function formatDate(d: string) {
  return new Date(d).toLocaleString();
}

function actionLabel(action: string) {
  return action.replace(/\./g, ' › ').replace(/_/g, ' ');
}

export default function ActivityPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedAction, setDebouncedAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['activity', page, debouncedAction],
    queryFn: () =>
      api.getActivityLog({
        action: debouncedAction || undefined,
        page,
        pageSize: 25,
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Activity Log</h1>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Filter by action…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setDebouncedAction(e.target.value);
            setPage(1);
          }}
          className="border border-border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary w-64"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {[28, 20, 24, 32].map((w, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className={`h-4 w-${w} bg-muted`} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data?.data.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No activity found
                </td>
              </tr>
            ) : (
              data?.data.map((entry: ActivityLogEntry) => (
                <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {entry.user ? (
                      <div>
                        <p className="font-medium">{entry.user.name}</p>
                        <p className="text-xs text-muted-foreground">{entry.user.email}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                      {actionLabel(entry.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                    {entry.details ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <Pagination
          currentPage={data.pagination.page}
          totalPages={data.pagination.totalPages}
          totalItems={data.pagination.totalItems}
          pageSize={data.pagination.pageSize}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
