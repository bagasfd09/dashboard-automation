'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoPlayerProps {
  url: string;
  title: string;
  onClose: () => void;
}

const SPEEDS = [0.5, 1, 1.5, 2] as const;

export function VideoPlayer({ url, title, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function onTimeUpdate() {
    const v = videoRef.current;
    if (v) setProgress(v.currentTime);
  }

  function onLoadedMetadata() {
    const v = videoRef.current;
    if (v) setDuration(v.duration);
  }

  function onEnded() {
    setPlaying(false);
    setProgress(0);
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current;
    if (v) {
      v.currentTime = Number(e.target.value);
      setProgress(Number(e.target.value));
    }
  }

  function setPlaybackSpeed(s: (typeof SPEEDS)[number]) {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden w-full max-w-3xl mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="text-white text-sm font-medium truncate">{title}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-white shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Video */}
        <div className="bg-black flex items-center justify-center" style={{ minHeight: 360 }}>
          <video
            ref={videoRef}
            src={url}
            className="max-h-[60vh] max-w-full"
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onLoadedMetadata}
            onEnded={onEnded}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        </div>

        {/* Controls */}
        <div className="px-4 py-3 space-y-2 bg-zinc-900">
          {/* Seek bar */}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={progress}
            onChange={seek}
            className="w-full accent-blue-500 cursor-pointer"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-300 hover:text-white"
                onClick={togglePlay}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <span className="text-zinc-400 text-xs font-mono">
                {formatTime(progress)} / {formatTime(duration)}
              </span>
            </div>
            {/* Speed controls */}
            <div className="flex items-center gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                    speed === s
                      ? 'bg-blue-500 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
