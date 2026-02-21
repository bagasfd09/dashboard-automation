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
            className="w-24 h-16 object-cover rounded border border-zinc-700 hover:border-zinc-500 cursor-pointer"
          />
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl bg-zinc-900 border-zinc-700">
            <DialogHeader>
              <DialogTitle className="text-white">{artifact.fileName}</DialogTitle>
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
        className="max-w-xs rounded border border-zinc-700"
      />
    );
  }

  return (
    <a
      href={url}
      download={artifact.fileName}
      className="text-blue-400 hover:text-blue-300 text-xs underline"
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
        <Skeleton className="h-8 w-64 bg-zinc-800" />
        <Skeleton className="h-40 w-full bg-zinc-800" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-zinc-500 py-12 text-center">
        Test case not found.{' '}
        <Button variant="link" onClick={() => router.back()} className="text-blue-400">
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
          className="text-zinc-400 hover:text-zinc-100"
        >
          ← Back
        </Button>
        <h1 className="text-2xl font-bold text-white truncate">{data.title}</h1>
      </div>

      {/* Header card */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="pt-6 space-y-3">
          <div>
            <span className="text-xs text-zinc-500 uppercase tracking-wide">File Path</span>
            <code className="block mt-1 text-sm text-zinc-300 font-mono bg-zinc-800 px-3 py-1.5 rounded">
              {data.filePath}
            </code>
          </div>
          {data.tags.length > 0 && (
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Tags</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {data.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="bg-zinc-800 text-zinc-300 border-zinc-700"
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
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">
            Run History ({sortedResults.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Run Date</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400">Duration</TableHead>
                <TableHead className="text-zinc-400">Retries</TableHead>
                <TableHead className="text-zinc-400">Error</TableHead>
                <TableHead className="text-zinc-400">Artifacts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedResults.map((result) => (
                <TableRow key={result.id} className="border-zinc-800 hover:bg-zinc-800/50 align-top">
                  <TableCell className="text-zinc-400 text-xs whitespace-nowrap">
                    {formatDate(result.startedAt)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={result.status as TestStatus} type="test" />
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    {formatDuration(result.duration)}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">{result.retryCount}</TableCell>
                  <TableCell className="text-zinc-400 text-xs max-w-xs">
                    {result.error ? (
                      <span className="text-red-400 truncate block" title={result.error}>
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
                </TableRow>
              ))}
              {sortedResults.length === 0 && (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={6} className="text-center text-zinc-500 py-8">
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
