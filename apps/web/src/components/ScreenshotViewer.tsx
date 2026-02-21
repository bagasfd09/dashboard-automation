'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Screenshot {
  url: string;
  title: string;
}

interface ScreenshotViewerProps {
  screenshots: Screenshot[];
  initialIndex: number;
  onClose: () => void;
}

export function ScreenshotViewer({ screenshots, initialIndex, onClose }: ScreenshotViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  const current = screenshots[index];

  const prev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : screenshots.length - 1));
    setZoom(1);
  }, [screenshots.length]);

  const next = useCallback(() => {
    setIndex((i) => (i < screenshots.length - 1 ? i + 1 : 0));
    setZoom(1);
  }, [screenshots.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z + 0.25, 4));
      if (e.key === '-') setZoom((z) => Math.max(z - 0.25, 0.25));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-zinc-400 text-sm font-mono">
            {index + 1} / {screenshots.length}
          </span>
          <span className="text-white text-sm truncate max-w-xs">{current.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-white"
            onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-zinc-400 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-white"
            onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-white"
            onClick={() => setZoom(1)}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-white"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image area */}
      <div className="flex-1 relative overflow-auto flex items-center justify-center min-h-0">
        {screenshots.length > 1 && (
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 rounded-full p-2 text-white transition-colors"
            onClick={prev}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.title}
          className="max-w-none transition-transform duration-150"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        />

        {screenshots.length > 1 && (
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 rounded-full p-2 text-white transition-colors"
            onClick={next}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      {screenshots.length > 1 && (
        <div className="shrink-0 bg-zinc-900/80 border-t border-zinc-800 px-4 py-2 flex gap-2 overflow-x-auto">
          {screenshots.map((s, i) => (
            <button
              key={i}
              onClick={() => { setIndex(i); setZoom(1); }}
              className={`shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-colors ${
                i === index ? 'border-blue-400' : 'border-zinc-700 hover:border-zinc-500'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={s.title} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
