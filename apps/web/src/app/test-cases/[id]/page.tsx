'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTestCase } from '@/hooks/use-test-cases';
import { StatusBadge } from '@/components/status-badge';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RetryButton } from '@/components/RetryButton';
import { api } from '@/lib/api';
import type { Artifact, TestStatus } from '@/lib/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function formatDuration(ms?: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ArtifactDisplay({ artifact }: { artifact: Artifact }) {
  const [open, setOpen] = useState(false);
  const url = api.artifactProxyUrl(artifact.id);

  if (artifact.type === 'SCREENSHOT') {
    return (
      <>
        <button onClick={() => setOpen(true)} className="focus:outline-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={artifact.fileName}
            className="w-24 h-16 object-cover rounded border border-border hover:border-muted-foreground/50 cursor-pointer transition-colors"
          />
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">{artifact.fileName}</DialogTitle>
            </DialogHeader>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={artifact.fileName} className="w-full rounded" />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (artifact.type === 'VIDEO') {
    return (
      <video
        src={url}
        controls
        className="max-w-xs rounded border border-border"
      />
    );
  }

  return (
    <a
      href={url}
      download={artifact.fileName}
      className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 text-xs underline"
    >
      Download {artifact.fileName}
    </a>
  );
}

export default function TestCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useTestCase(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 bg-muted" />
        <Skeleton className="h-40 w-full bg-muted" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        Test case not found.{' '}
        <Button variant="link" onClick={() => router.back()} className="text-blue-600 dark:text-blue-400">
          Go back
        </Button>
      </div>
    );
  }

  const sortedResults = [...(data.results ?? [])].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Back
        </Button>
        <h1 className="text-2xl font-bold text-foreground truncate">{data.title}</h1>
      </div>

      {/* Header card */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-3">
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">File Path</span>
            <code className="block mt-1 text-sm text-foreground/80 font-mono bg-muted px-3 py-1.5 rounded">
              {data.filePath}
            </code>
          </div>
          {data.tags.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Tags</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {data.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="bg-muted text-muted-foreground border-border"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base">
            Run History ({sortedResults.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Run Date</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Duration</TableHead>
                <TableHead className="text-muted-foreground">Retries</TableHead>
                <TableHead className="text-muted-foreground">Error</TableHead>
                <TableHead className="text-muted-foreground">Artifacts</TableHead>
                <TableHead className="text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedResults.map((result) => (
                <TableRow key={result.id} className="border-border hover:bg-muted/50 align-top">
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatDate(result.startedAt)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={result.status as TestStatus} type="test" />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDuration(result.duration)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{result.retryCount}</TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-xs">
                    {result.error ? (
                      <span className="text-red-600 dark:text-red-400 truncate block" title={result.error}>
                        {result.error.slice(0, 60)}{result.error.length > 60 ? '…' : ''}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {result.artifacts?.map((artifact) => (
                        <ArtifactDisplay key={artifact.id} artifact={artifact} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {result.status === 'FAILED' && (
                      <RetryButton testCaseId={data.id} teamId={data.teamId} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {sortedResults.length === 0 && (
                <TableRow className="border-border">
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No run history yet
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
