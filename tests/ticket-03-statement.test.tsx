import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Statement } from "@/components/statement";

/**
 * The statement renderer is the security boundary for problem text: it is the
 * only place Markdown becomes HTML, for the organizer preview now and the
 * participant statement later.
 */
describe("Statement", () => {
  it("renders GFM markdown, including tables", () => {
    const html = renderToStaticMarkup(
      <Statement
        markdown={
          "# Two Sum\n\nUse **two** pointers.\n\n| a | b |\n| - | - |\n| 1 | 2 |\n"
        }
      />,
    );

    expect(html).toContain("<h1>Two Sum</h1>");
    expect(html).toContain("<strong>two</strong>");
    expect(html).toContain("<table>");
    expect(html).toContain('class="prose-statement"');
  });

  it("never renders raw HTML as markup", () => {
    const html = renderToStaticMarkup(
      <Statement markdown={"<script>alert(1)</script>\n\n<b>bold</b>"} />,
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("<b>");
    expect(html).toContain("bold");
  });

  it("drops script and iframe containers and neutralises javascript links", () => {
    const html = renderToStaticMarkup(
      <Statement
        markdown={
          "hello\n\n<iframe src=\"https://example.com\"></iframe>\n\n[click](javascript:alert(1))"
        }
      />,
    );

    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href=""');
  });
});
