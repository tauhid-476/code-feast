"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The one way a Figure is drawn. It sits on a light paper surface so a diagram
 * with a white background does not glare against the dark UI, reserves its
 * aspect ratio while loading, and opens full-size on click.
 */
export function FigureImage({
  src,
  alt,
  width,
  height,
}: {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={alt ? `View figure: ${alt}` : "View figure"}
        className="group my-3 inline-block max-w-full cursor-zoom-in rounded-lg border border-border bg-white p-2 text-left transition-colors duration-150 ease-out hover:border-muted-foreground/40 active:scale-[0.995]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          width={width ?? undefined}
          height={height ?? undefined}
          loading="lazy"
          decoding="async"
          className="mx-auto h-auto max-w-full rounded-sm"
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-auto max-w-[calc(100%-2rem)] bg-white p-2 sm:max-w-[min(90vw,72rem)]">
          <DialogTitle className="sr-only">{alt || "Figure"}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="mx-auto h-auto max-h-[80vh] w-auto max-w-full"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
