"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  ExternalLink,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const emptySubscribe = () => () => {};

export function E2BApiKeyGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  function handleClose() {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsOpen(false);
  }

  // Keyboard shortcuts when modal is open
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft" || e.key === "j") {
        e.preventDefault();
        skip(-10);
      } else if (e.key === "ArrowRight" || e.key === "l") {
        e.preventDefault();
        skip(10);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  function skip(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    const target = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
    video.currentTime = target;
    setCurrentTime(target);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }

  function seekToClientX(clientX: number) {
    const video = videoRef.current;
    const progress = progressRef.current;
    if (!video || !progress) return;

    const targetDuration = video.duration || duration;
    if (!targetDuration) return;

    const rect = progress.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = rect.width > 0 ? clickX / rect.width : 0;
    const newTime = percentage * targetDuration;

    video.currentTime = newTime;
    setCurrentTime(newTime);
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    seekToClientX(e.clientX);

    function onMouseMove(moveEvent: MouseEvent) {
      seekToClientX(moveEvent.clientX);
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  const progressPercentage =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Need an E2B key for sandboxed execution?
        </span>
        <a
          href="https://e2b.dev/dashboard?tab=keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <span>e2b.dev/dashboard?tab=keys</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Clean, compact trigger card instead of an embedded video */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3 text-left transition-all hover:border-primary/40 hover:bg-muted/70 hover:shadow-xs cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs transition-transform group-hover:scale-105">
            <Play className="h-4 w-4 fill-current ml-0.5" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground leading-snug">
              Watch 1-minute video guide: How to get your free E2B API key
            </div>
            <div className="text-xs text-muted-foreground">
              Click to view step-by-step walkthrough in modal
            </div>
          </div>
        </div>

        <span className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground group-hover:text-foreground group-hover:border-primary/30 transition-colors">
          Watch guide
        </span>
      </button>

      {/* Modal Overlay */}
      {isOpen && isMounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="E2B API Key Video Guide"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in-0 duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-zinc-950 text-zinc-100 shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3 bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-semibold text-zinc-100">
                  How to get your free E2B API key
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://e2b.dev/dashboard?tab=keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-100 hover:underline mr-2"
                >
                  <span>e2b.dev dashboard</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Video Container */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
              {!hasError ? (
                <>
                  <video
                    ref={videoRef}
                    src="/assets/videos/e2b-api-key-guide.mp4"
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-contain cursor-pointer"
                    onClick={togglePlay}
                    onTimeUpdate={() => {
                      if (videoRef.current) {
                        setCurrentTime(videoRef.current.currentTime);
                      }
                    }}
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        setDuration(videoRef.current.duration);
                      }
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onError={() => setHasError(true)}
                  >
                    Your browser does not support the video tag.
                  </video>

                  {/* Centered big play button when paused */}
                  {!isPlaying && (
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/40"
                      aria-label="Play video"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg backdrop-blur-xs hover:scale-105 transition-transform">
                        <Play className="h-6 w-6 fill-current ml-0.5" />
                      </div>
                    </button>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-300">
                  <p className="text-sm font-medium">Video could not be loaded.</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    You can still get your free key directly from the E2B dashboard.
                  </p>
                  <a
                    href="https://e2b.dev/dashboard?tab=keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <span>Open E2B Keys Dashboard</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Custom Controls Bar */}
            {!hasError && (
              <div className="border-t border-zinc-800 bg-zinc-900/90 px-4 py-3 space-y-2">
                {/* Scrubber / Progress Bar */}
                <div
                  ref={progressRef}
                  onMouseDown={handleMouseDown}
                  className="group relative flex h-4 w-full cursor-pointer select-none items-center"
                  role="slider"
                  aria-label="Video progress"
                  aria-valuemin={0}
                  aria-valuemax={duration}
                  aria-valuenow={currentTime}
                >
                  {/* Background Track */}
                  <div className="relative h-1.5 w-full rounded-full bg-zinc-800 transition-all group-hover:h-2 overflow-hidden">
                    {/* Covered/Played Fill */}
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-75"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>

                  {/* Scrubber Dot / Thumb */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md ring-2 ring-primary transition-transform group-hover:scale-125 pointer-events-none"
                    style={{ left: `${progressPercentage}%` }}
                  />
                </div>

                {/* Control buttons & time display */}
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <div className="flex items-center gap-2">
                    {/* Backward 10s */}
                    <button
                      type="button"
                      onClick={() => skip(-10)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                      title="Rewind 10s (Left Arrow)"
                      aria-label="Rewind 10 seconds"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium">10s</span>
                    </button>

                    {/* Play / Pause */}
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
                      title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                      )}
                    </button>

                    {/* Forward 10s */}
                    <button
                      type="button"
                      onClick={() => skip(10)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                      title="Forward 10s (Right Arrow)"
                      aria-label="Forward 10 seconds"
                    >
                      <span className="text-[10px] font-medium">10s</span>
                      <RotateCw className="h-3.5 w-3.5" />
                    </button>

                    {/* Time readout */}
                    <span className="ml-2 tabular text-zinc-400 text-[11px]">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  {/* Right side controls */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                      title={isMuted ? "Unmute" : "Mute"}
                      aria-label={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>

                    <a
                      href="https://e2b.dev/dashboard?tab=keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      <span>Get E2B key</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
