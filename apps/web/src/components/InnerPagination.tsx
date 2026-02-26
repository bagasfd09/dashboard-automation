'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InnerPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onShowAll?: () => void;
}

export function InnerPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onShowAll,
}: InnerPaginationProps) {
  if (totalPages <= 1 && !onShowAll) return null;

  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);
  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages || totalPages === 0;

  const btnBase =
    'h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none';

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-border bg-card/50">
      {/* Left: range + show all */}
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-xs">
          {totalItems === 0 ? 'No items' : `${from}–${to} of ${totalItems}`}
        </span>
        {onShowAll && totalPages > 1 && (
          <button
            onClick={onShowAll}
            className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            Show all
          </button>
        )}
      </div>

      {/* Right: prev / next */}
      {totalPages > 1 && (
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={btnBase}
            onClick={() => onPageChange(currentPage - 1)}
            disabled={isFirst}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={btnBase}
            onClick={() => onPageChange(currentPage + 1)}
            disabled={isLast}
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
