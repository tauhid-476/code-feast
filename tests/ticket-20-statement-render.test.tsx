import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Statement } from "@/components/statement";

/**
 * A Figure is only ever an image when its reference is an app route. Any other
 * URL is a link, so a live contest never depends on a third-party host.
 */
describe("Ticket 20: Statement figures", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("renders an /api/figures reference as an image with its alt text", () => {
    const html = renderToStaticMarkup(
      <Statement
        markdown={`![Graph of five nodes](/api/figures/${id})`}
        figures={{ [id]: { width: 640, height: 480 } }}
      />,
    );

    expect(html).toContain("<img");
    expect(html).toContain(`src="/api/figures/${id}"`);
    expect(html).toContain('alt="Graph of five nodes"');
    expect(html).toContain('width="640"');
    expect(html).toContain('height="480"');
    expect(html).toContain("bg-white");
  });

  it("renders a remote image URL as a link, never as an image", () => {
    const html = renderToStaticMarkup(
      <Statement markdown={"![Remote diagram](https://example.com/diagram.png)"} />,
    );

    expect(html).not.toContain("<img");
    expect(html).toContain('href="https://example.com/diagram.png"');
    expect(html).toContain("Remote diagram");
    expect(html).toContain("External image not shown");
  });

  it("keeps alt text when there is no Figure metadata", () => {
    const html = renderToStaticMarkup(
      <Statement markdown={`![Bare graph](/api/figures/${id})`} />,
    );

    expect(html).toContain("<img");
    expect(html).toContain('alt="Bare graph"');
    expect(html).not.toContain('width="');
  });
});
