/**
 * Vocabulary for Problem Figures (GLOSSARY: Figure). These types are neutral so
 * both server code and client components can use them without touching the
 * database or the AWS SDK.
 */

export type FigureActor = {
  id: string;
  email: string;
};

/** SPEC §4.2: PNG, JPEG or WebP only. */
export const FIGURE_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type FigureContentType = (typeof FIGURE_CONTENT_TYPES)[number];

export const MAX_FIGURE_BYTES = 2 * 1024 * 1024;

/** SPEC §4.2: at most six Figures per Problem. */
export const MAX_FIGURES_PER_PROBLEM = 6;

/** The one reference shape a statement may use: `/api/figures/<id>`. */
export const FIGURE_ROUTE_PREFIX = "/api/figures/";

export type FigureState = "pending" | "ready";

export type Figure = {
  id: string;
  problemId: string;
  storageKey: string;
  contentType: FigureContentType;
  bytes: number;
  width: number | null;
  height: number | null;
  state: FigureState;
  createdAt: Date;
};

/** What a renderer needs; never the storage key or the bytes. */
export type FigureView = {
  id: string;
  width: number | null;
  height: number | null;
};

export type FigureDimensions = {
  width: number | null;
  height: number | null;
};

export function isFigureContentType(
  value: unknown,
): value is FigureContentType {
  return (
    typeof value === "string" &&
    (FIGURE_CONTENT_TYPES as readonly string[]).includes(value)
  );
}

export function figureExtension(contentType: FigureContentType): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
  }
}

/**
 * The `figures` prop `Statement` takes. The three call sites already load the
 * metadata; this turns it into the id-keyed map the renderer reads.
 */
export function figureDimensionsMap(
  figures: readonly FigureView[],
): Record<string, FigureDimensions> {
  return Object.fromEntries(
    figures.map((figure) => [
      figure.id,
      { width: figure.width, height: figure.height },
    ]),
  );
}

export function toFigureView(figure: Figure): FigureView {
  return { id: figure.id, width: figure.width, height: figure.height };
}
