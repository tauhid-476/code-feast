import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * The one Markdown renderer for Problem statements. Used by the organizer's
 * authoring preview now and by the participant statement later.
 *
 * Raw HTML is never rendered: `skipHtml` drops tags and their children that
 * would otherwise smuggle markup in, and the element allowlist removes the
 * containers that only exist to execute or embed.
 */
export function Statement({ markdown }: { markdown: string }) {
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
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
