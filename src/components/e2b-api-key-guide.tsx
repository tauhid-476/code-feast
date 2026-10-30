"use client";

import { useState } from "react";
import { ExternalLink, Play } from "lucide-react";

export function E2BApiKeyGuide() {
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <div className="space-y-2.5">
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

      {!videoFailed ? (
        <div className="overflow-hidden rounded-lg border border-border bg-black/5">
          <video
            src="/assets/videos/e2b-api-key-guide.mp4"
            controls
            preload="metadata"
            className="w-full aspect-video rounded-lg object-cover"
            onError={() => setVideoFailed(true)}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      ) : (
        <a
          href="https://e2b.dev/dashboard?tab=keys"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 transition-colors hover:bg-muted/70 hover:border-primary/40 cursor-pointer"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:scale-105 transition-transform">
            <Play className="h-4 w-4 fill-current ml-0.5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-medium text-foreground leading-tight">
              Watch 1-minute video guide: How to get your free E2B API key
            </span>
            <span className="text-xs text-muted-foreground mt-0.5">
              Opens E2B key dashboard in new tab
            </span>
          </div>
        </a>
      )}
    </div>
  );
}
