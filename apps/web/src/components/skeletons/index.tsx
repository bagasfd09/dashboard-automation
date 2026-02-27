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
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Skeleton className="h-8 w-28 bg-muted" />
        <Skeleton className="h-4 w-32 bg-muted" />
      </div>

      <FilterBarSkeleton inputs={1} />

      <TableCardSkeleton
        title="All Runs"
        cols={9}
        rows={10}
        headers={['Run ID', 'Team', 'Status', 'Total', 'Passed', 'Failed', 'Skipped', 'Duration', 'Started At']}
      />

      <PaginationSkeleton />
    </div>
  );
}

// ── Run detail ─────────────────────────────────────────────────────────────

export function RunDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Skeleton className="h-5 w-24 bg-muted" />

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

      {/* Progress bar */}
      <Skeleton className="h-3 w-full rounded-full bg-muted" />

      <FilterBarSkeleton inputs={2} />

      {/* Suite cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40 bg-muted" />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-16 bg-muted" />
                <Skeleton className="h-4 w-16 bg-muted" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {Array.from({ length: 4 }).map((_, j) => (
                  <SkRow key={j} cols={5} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
