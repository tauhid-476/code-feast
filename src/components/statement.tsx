import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FigureImage } from "@/components/figure-image";
import {
  FIGURE_ROUTE_PREFIX,
  type FigureDimensions,
} from "@/lib/figures/types";

/**
 * The one Markdown renderer for Problem statements: the authoring preview, the
 * contest view, and the review screen all use it, so a Figure appears exactly
 * where the Organizer put it.
 *
 * Raw HTML is never rendered: `skipHtml` drops tags and their children that
 * would otherwise smuggle markup in, and the element allowlist removes the
 * containers that only exist to execute or embed.
 *
 * An `img` is only ever a Figure when its `src` is an app route. Any other URL
 * renders as a link: a live contest never depends on a third-party host.
 */
export function Statement({
  markdown,
  figures,
}: {
  markdown: string;
  /** Ready Figure metadata by id, so the statement does not jump on load. */
  figures?: Record<string, FigureDimensions>;
}) {
  return (
    <div className="prose-statement">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={["script", "style", "iframe"]}
        unwrapDisallowed
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          img: ({ src, alt }) => {
            if (typeof src === "string" && src.startsWith(FIGURE_ROUTE_PREFIX)) {
              const id = src.slice(FIGURE_ROUTE_PREFIX.length);
              const dimensions = figures?.[id];
              return (
                <FigureImage
                  src={src}
                  alt={alt ?? ""}
                  width={dimensions?.width ?? null}
                  height={dimensions?.height ?? null}
                />
              );
            }

            const label =
              alt?.trim() ||
              (typeof src === "string" && src ? src : "External image");
            return (
              <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {typeof src === "string" && src ? (
                  <a href={src} target="_blank" rel="noreferrer noopener">
                    {label}
                  </a>
                ) : (
                  <span>{label}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  External image not shown
                </span>
              </span>
            );
          },
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
