/**
 * Skeleton loader components — one export per page.
 * All skeletons use animate-pulse and match the exact layout
 * of their real counterparts to prevent layout shift.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ── Primitives ─────────────────────────────────────────────────────────────

function SkRow({ cols }: { cols: number }) {
  return (
    <TableRow className="border-border">
      {Array.from({ length: cols }).map((_, j) => (
        <TableCell key={j}>
          <Skeleton className="h-4 w-16 bg-muted" />
        </TableCell>
      ))}
    </TableRow>
  );
}

function FilterBarSkeleton({ inputs = 2 }: { inputs?: number }) {
  return (
    <div className="flex gap-3">
      {Array.from({ length: inputs }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-44 bg-muted rounded-md" />
      ))}
    </div>
  );
}

function PaginationSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-32 bg-muted" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-8 bg-muted rounded" />
        <Skeleton className="h-8 w-8 bg-muted rounded" />
        <Skeleton className="h-8 w-8 bg-muted rounded" />
      </div>
    </div>
  );
}

function TableCardSkeleton({
  title,
  cols,
  rows,
  headers,
}: {
  title?: string;
  cols: number;
  rows: number;
  headers?: string[];
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        {title ? (
          <Skeleton className="h-5 w-32 bg-muted" />
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              {(headers ?? Array.from({ length: cols })).map((h, i) => (
                <TableHead key={i} className="text-muted-foreground">
                  {h ? String(h) : <Skeleton className="h-3 w-16 bg-muted" />}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, i) => (
              <SkRow key={i} cols={cols} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-24 bg-muted" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-16 bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status strip */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="pt-4 pb-4 flex items-center justify-between">
              <Skeleton className="h-3 w-14 bg-muted" />
              <Skeleton className="h-6 w-8 bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Teams table */}
      <TableCardSkeleton
        title="Teams"
        cols={5}
        rows={4}
        headers={['Team', 'Test Cases', 'Pass Rate', 'Last Run', 'Status']}
      />

      {/* Recent activity table */}
      <TableCardSkeleton
        title="Recent Activity"
        cols={4}
        rows={5}
        headers={['Test Case', 'Team', 'Status', 'Time']}
      />
    </div>
  );
}

// ── Runs list ──────────────────────────────────────────────────────────────

export function RunsSkeleton() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <Skeleton className="h-7 w-32 bg-muted" />
        <Skeleton className="h-4 w-52 bg-muted" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3.5">
            <Skeleton className="h-3 w-28 bg-muted mb-2" />
            <Skeleton className="h-8 w-16 bg-muted mb-1" />
            <Skeleton className="h-3 w-20 bg-muted" />
          </div>
        ))}
      </div>

      {/* Filter chips + search */}
      <div className="flex items-center gap-2 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 bg-muted rounded-lg" />
        ))}
        <div className="flex-1" />
        <Skeleton className="h-8 w-52 bg-muted rounded-full" />
      </div>

      {/* Run cards */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3.5 px-4">
            <div className="flex items-center gap-3.5">
              <Skeleton className="w-9 h-9 rounded-[10px] bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-40 bg-muted" />
                <Skeleton className="h-3 w-64 bg-muted" />
              </div>
              <div className="w-28 space-y-1.5 shrink-0">
                <Skeleton className="h-2.5 w-20 bg-muted" />
                <Skeleton className="h-1.5 w-full bg-muted rounded-full" />
              </div>
              <Skeleton className="w-16 h-5 bg-muted rounded shrink-0" />
              <div className="w-16 shrink-0 space-y-1 text-right">
                <Skeleton className="h-3 w-12 bg-muted ml-auto" />
                <Skeleton className="h-3 w-10 bg-muted ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <PaginationSkeleton />
    </div>
  );
}

// ── Run detail ─────────────────────────────────────────────────────────────

export function RunDetailSkeleton() {
  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <Skeleton className="h-4 w-32 bg-muted" />

      {/* Run header card */}
      <div className="bg-card border border-border rounded-[14px] p-5 px-6 space-y-4">
        {/* Top: status + title + back button */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2.5">
              <Skeleton className="w-7 h-7 rounded-[8px] bg-muted shrink-0" />
              <Skeleton className="h-7 w-48 bg-muted" />
              <Skeleton className="h-5 w-20 bg-muted rounded" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Skeleton className="h-5 w-16 bg-muted rounded-full" />
              <Skeleton className="h-5 w-20 bg-muted rounded-full" />
              <Skeleton className="h-4 w-16 bg-muted" />
              <Skeleton className="h-4 w-14 bg-muted" />
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Skeleton className="h-8 w-16 bg-muted rounded-md" />
            <Skeleton className="h-8 w-32 bg-muted rounded-md" />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-background rounded-lg p-2.5 text-center border border-border/50">
              <Skeleton className="h-8 w-10 bg-muted mx-auto mb-1" />
              <Skeleton className="h-3 w-12 bg-muted mx-auto" />
            </div>
          ))}
        </div>

        {/* Status bar */}
        <Skeleton className="h-2 w-full rounded-full bg-muted" />
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 bg-muted rounded-lg" />
        ))}
        <Skeleton className="h-8 w-52 bg-muted rounded-md ml-2" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-28 bg-muted rounded-md" />
      </div>

      {/* Suite accordion skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Suite header */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Skeleton className="w-3.5 h-3.5 bg-muted rounded shrink-0" />
              <Skeleton className="h-4 w-44 bg-muted" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-10 bg-muted" />
              <Skeleton className="h-4 w-14 bg-muted rounded-full" />
              <Skeleton className="h-3 w-6 bg-muted" />
            </div>
          </div>
          {/* Test rows preview */}
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="pl-10 pr-4 py-2.5 flex items-center gap-3 border-t border-border/40">
              <Skeleton className="w-2 h-2 rounded-full bg-muted shrink-0" />
              <Skeleton className="h-3 flex-1 bg-muted" />
              <Skeleton className="h-3 w-12 bg-muted" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Test Cases list ────────────────────────────────────────────────────────

export function TestCasesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-36 bg-muted" />
        <Skeleton className="h-4 w-44 bg-muted" />
      </div>

      {/* Filter bar: search + group-by + team */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 max-w-sm bg-muted rounded-md" />
        <Skeleton className="h-10 w-44 bg-muted rounded-md" />
        <Skeleton className="h-10 w-44 bg-muted rounded-md" />
      </div>

      {/* Suite accordion skeletons */}
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="bg-card border-border">
          <CardHeader className="cursor-pointer">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 bg-muted rounded" />
              <Skeleton className="h-5 w-48 bg-muted" />
              <div className="ml-auto flex gap-4">
                <Skeleton className="h-4 w-16 bg-muted" />
                <Skeleton className="h-1.5 w-24 bg-muted rounded-full" />
                <Skeleton className="h-6 w-24 bg-muted rounded" />
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}

      <PaginationSkeleton />
    </div>
  );
}

// ── Teams list ─────────────────────────────────────────────────────────────

export function TeamsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-20 bg-muted" />
          <Skeleton className="h-4 w-32 bg-muted" />
        </div>
        <Skeleton className="h-9 w-28 bg-muted rounded-md" />
      </div>

      <TableCardSkeleton
        cols={6}
        rows={6}
        headers={['Team', 'Test Cases', 'Runs', 'Pass Rate', 'Last Run', 'Status']}
      />

      <PaginationSkeleton />
    </div>
  );
}

// ── Team detail ────────────────────────────────────────────────────────────

export function TeamDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-24 bg-muted" />

      {/* Team name */}
      <div className="space-y-1">
        <Skeleton className="h-8 w-48 bg-muted" />
        <Skeleton className="h-4 w-32 bg-muted" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-20 bg-muted" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12 bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Health breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <Skeleton className="h-3 w-24 bg-muted mb-2" />
              <Skeleton className="h-7 w-10 bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top failing + recent runs side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TableCardSkeleton
          title="Top Failing Tests"
          cols={2}
          rows={5}
          headers={['Test Case', 'Failures']}
        />
        <TableCardSkeleton
          title="Recent Runs"
          cols={4}
          rows={5}
          headers={['Status', 'Tests', 'Duration', 'Started']}
        />
      </div>
    </div>
  );
}

// ── Users ──────────────────────────────────────────────────────────────────

export function UsersSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-24 bg-muted" />
          <Skeleton className="h-4 w-36 bg-muted" />
        </div>
        <Skeleton className="h-9 w-28 bg-muted rounded-md" />
      </div>

      {/* Filters: search + role + status */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 max-w-sm bg-muted rounded-md" />
        <Skeleton className="h-10 w-36 bg-muted rounded-md" />
        <Skeleton className="h-10 w-36 bg-muted rounded-md" />
      </div>

      <TableCardSkeleton
        cols={6}
        rows={8}
        headers={['Name', 'Email', 'Role', 'Teams', 'Last Login', 'Actions']}
      />

      <PaginationSkeleton />
    </div>
  );
}

// ── Activity log ───────────────────────────────────────────────────────────

export function ActivitySkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-32 bg-muted" />
        <Skeleton className="h-4 w-44 bg-muted" />
      </div>

      <FilterBarSkeleton inputs={3} />

      <TableCardSkeleton
        cols={4}
        rows={10}
        headers={['Time', 'User', 'Action', 'Details']}
      />

      <PaginationSkeleton />
    </div>
  );
}

// ── Profile ────────────────────────────────────────────────────────────────

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-28 bg-muted" />
        <Skeleton className="h-4 w-44 bg-muted" />
      </div>

      {/* Personal info card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <Skeleton className="h-5 w-36 bg-muted" />
        </CardHeader>
        <CardContent className="space-y-4">
          {['Name', 'Email', 'Role'].map((f) => (
            <div key={f} className="space-y-1">
              <Skeleton className="h-3 w-10 bg-muted" />
              <Skeleton className="h-10 w-full bg-muted rounded-md" />
            </div>
          ))}
          <Skeleton className="h-9 w-24 bg-muted rounded-md" />
        </CardContent>
      </Card>

      {/* Teams card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <Skeleton className="h-5 w-24 bg-muted" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full bg-muted rounded-md" />
          ))}
        </CardContent>
      </Card>

      {/* Security / sessions card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <Skeleton className="h-5 w-32 bg-muted" />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {['Device', 'Created', 'Expires', ''].map((h) => (
                  <TableHead key={h} className="text-muted-foreground">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, i) => (
                <SkRow key={i} cols={4} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Retries ────────────────────────────────────────────────────────────────

export function RetriesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-24 bg-muted" />
        <Skeleton className="h-4 w-40 bg-muted" />
      </div>

      <FilterBarSkeleton inputs={1} />

      <TableCardSkeleton
        cols={6}
        rows={8}
        headers={['Test Case', 'Team', 'Status', 'Requested', 'Completed', 'Result']}
      />

      <PaginationSkeleton />
    </div>
  );
}

// ── Library — Collections grid ─────────────────────────────────────────────

export function CollectionGridSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-28 bg-muted" />
          <Skeleton className="h-4 w-44 bg-muted" />
        </div>
        <Skeleton className="h-9 w-36 bg-muted rounded-md" />
      </div>
      {/* Tab bar */}
      <div className="flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 bg-muted rounded-md" />
        ))}
      </div>
      {/* Search */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 max-w-sm bg-muted rounded-md" />
        <Skeleton className="h-10 w-36 bg-muted rounded-md" />
      </div>
      {/* 2-col grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 bg-muted rounded-lg" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-5 w-32 bg-muted" />
                  <Skeleton className="h-3 w-20 bg-muted" />
                </div>
                <Skeleton className="h-5 w-14 bg-muted rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-3 w-full bg-muted" />
              <Skeleton className="h-1.5 w-full bg-muted rounded-full" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16 bg-muted rounded" />
                <Skeleton className="h-6 w-16 bg-muted rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <PaginationSkeleton />
    </div>
  );
}

// ── Library — Test case list ────────────────────────────────────────────────

export function TestCaseListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-24 bg-muted" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48 bg-muted" />
        <Skeleton className="h-9 w-32 bg-muted rounded-md" />
      </div>
      <div className="flex gap-3 flex-wrap">
        <Skeleton className="h-10 flex-1 min-w-[200px] bg-muted rounded-md" />
        <Skeleton className="h-10 w-32 bg-muted rounded-md" />
        <Skeleton className="h-10 w-32 bg-muted rounded-md" />
        <Skeleton className="h-10 w-32 bg-muted rounded-md" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="bg-card border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4 bg-muted" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 bg-muted rounded" />
                  <Skeleton className="h-5 w-12 bg-muted rounded" />
                  <Skeleton className="h-5 w-14 bg-muted rounded" />
                </div>
                <Skeleton className="h-3 w-1/2 bg-muted" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8 bg-muted rounded-md" />
                <Skeleton className="h-8 w-8 bg-muted rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <PaginationSkeleton />
    </div>
  );
}

// ── Library — Test case detail ──────────────────────────────────────────────

export function TestCaseDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-48 bg-muted" />
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-3/4 bg-muted" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 bg-muted rounded" />
            <Skeleton className="h-6 w-16 bg-muted rounded" />
            <Skeleton className="h-6 w-14 bg-muted rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 bg-muted rounded-md" />
          <Skeleton className="h-9 w-28 bg-muted rounded-md" />
          <Skeleton className="h-9 w-9 bg-muted rounded-md" />
        </div>
      </div>
      {/* Tab bar */}
      <div className="flex gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 bg-muted rounded-md" />
        ))}
      </div>
      {/* Content */}
      <div className="space-y-4">
        <Skeleton className="h-4 w-full bg-muted" />
        <Skeleton className="h-4 w-5/6 bg-muted" />
        <Skeleton className="h-4 w-4/6 bg-muted" />
        <Skeleton className="h-32 w-full bg-muted rounded-md" />
      </div>
    </div>
  );
}

// ── Library — Coverage ──────────────────────────────────────────────────────

export function CoverageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-20 bg-muted" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12 bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TableCardSkeleton title="By Status" cols={2} rows={4} headers={['Status', 'Count']} />
        <TableCardSkeleton title="By Priority" cols={2} rows={4} headers={['Priority', 'Count']} />
      </div>
    </div>
  );
}

// ── Releases list ──────────────────────────────────────────────────────────

export function ReleasesListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-28 bg-muted" />
          <Skeleton className="h-4 w-56 bg-muted" />
        </div>
        <Skeleton className="h-9 w-32 bg-muted rounded-md" />
      </div>
      {/* Tab bar */}
      <div className="flex gap-1">
        <Skeleton className="h-9 w-28 bg-muted rounded-md" />
        <Skeleton className="h-9 w-28 bg-muted rounded-md" />
      </div>
      {/* Release cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="bg-card border-border border-l-4 border-l-muted">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <Skeleton className="h-5 w-48 bg-muted" />
                <Skeleton className="h-4 w-32 bg-muted" />
              </div>
              <Skeleton className="h-6 w-20 bg-muted rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-2.5 w-full bg-muted rounded-full" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-24 bg-muted" />
              <Skeleton className="h-4 w-24 bg-muted" />
              <Skeleton className="h-4 w-24 bg-muted" />
            </div>
            <Skeleton className="h-4 w-44 bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Release detail ──────────────────────────────────────────────────────────

export function ReleaseDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Skeleton className="h-4 w-36 bg-muted" />
      {/* Header card */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64 bg-muted" />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-24 bg-muted" />
                <Skeleton className="h-4 w-28 bg-muted" />
              </div>
              <Skeleton className="h-6 w-20 bg-muted rounded-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-16 bg-muted rounded-md" />
              <Skeleton className="h-9 w-36 bg-muted rounded-md" />
              <Skeleton className="h-9 w-28 bg-muted rounded-md" />
            </div>
          </div>
          <Skeleton className="h-4 w-3/4 bg-muted" />
          {/* Summary bar */}
          <div className="border border-border rounded-lg p-4 space-y-2">
            <div className="flex gap-6">
              <Skeleton className="h-4 w-24 bg-muted" />
              <Skeleton className="h-4 w-24 bg-muted" />
              <Skeleton className="h-4 w-24 bg-muted" />
            </div>
            <Skeleton className="h-2.5 w-full bg-muted rounded-full" />
          </div>
        </CardContent>
      </Card>
      {/* Checklist sections */}
      {Array.from({ length: 2 }).map((_, s) => (
        <div key={s} className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40 bg-muted" />
            <Skeleton className="h-8 w-32 bg-muted rounded-md" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-6 w-6 bg-muted rounded-full shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-3/4 bg-muted" />
                    <Skeleton className="h-3 w-1/2 bg-muted" />
                  </div>
                  <Skeleton className="h-6 w-12 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Import from Runs Modal ──────────────────────────────────────────────────

export function ImportFromRunsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, g) => (
        <div key={g} className="space-y-2">
          {/* Run date header */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 bg-muted rounded" />
            <Skeleton className="h-3 w-32 bg-muted" />
            <Skeleton className="h-4 w-16 bg-muted rounded-full" />
          </div>
          {/* Test case rows */}
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-2.5 border border-border rounded-lg">
              <Skeleton className="h-4 w-4 bg-muted rounded shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4 bg-muted" />
                <Skeleton className="h-2.5 w-1/2 bg-muted" />
              </div>
              <Skeleton className="h-5 w-14 bg-muted rounded-full shrink-0" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Suggestion Review Cards ─────────────────────────────────────────────────

export function SuggestionReviewSkeleton() {
  return (
    <div className="space-y-3">
      {/* Batch actions bar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32 bg-muted" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 bg-muted rounded-md" />
          <Skeleton className="h-8 w-24 bg-muted rounded-md" />
        </div>
      </div>
      {/* Suggestion cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="bg-card border-border">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-3/4 bg-muted" />
                <Skeleton className="h-3 w-1/2 bg-muted" />
              </div>
              <Skeleton className="h-5 w-16 bg-muted rounded-full" />
            </div>
            <Skeleton className="h-3 w-full bg-muted" />
            <Skeleton className="h-3 w-2/3 bg-muted" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-8 w-20 bg-muted rounded-md" />
              <Skeleton className="h-8 w-28 bg-muted rounded-md" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── API Keys ───────────────────────────────────────────────────────────────

export function ApiKeysSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-24 bg-muted" />
        <Skeleton className="h-4 w-48 bg-muted" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="bg-card border-border">
          <CardHeader>
            <Skeleton className="h-5 w-40 bg-muted" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 flex-1 bg-muted rounded-md" />
              <Skeleton className="h-10 w-10 bg-muted rounded-md" />
              <Skeleton className="h-10 w-10 bg-muted rounded-md" />
            </div>
            <Skeleton className="h-9 w-32 bg-muted rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
