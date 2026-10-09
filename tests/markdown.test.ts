import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/markdown";

describe("community document syntax", () => {
  it("renders tables, disabled tasks, footnotes, containers and alerts together", () => {
    const result = renderMarkdown(
      "# 文档\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n\nNote[^1]\n\n[^1]: Footnote\n\n> [!NOTE]\n> Notice\n\n::: tip Title\nBody\n:::",
    );
    expect(result.html).toContain("<table>");
    expect(result.html).toContain('type="checkbox"');
    expect(result.html).toContain("disabled");
    expect(result.html).toContain("footnote");
    expect(result.html).toContain("markdown-alert");
    expect(result.html).toContain("callout tip");
  });
  it("keeps Chinese headings and disambiguates repeated anchors", () => {
    const result = renderMarkdown(
      "# 中文 **标题**\n\n## 中文标题\n\n## 中文标题",
    );
    expect(result.headings.map((h) => h.id)).toEqual([
      "中文-标题",
      "中文标题",
      "中文标题-1",
    ]);
  });
  it("handles frontmatter without swallowing malformed data", () => {
    const good = renderMarkdown(
      "---\ntitle: Test\ntags: [a, b]\n---\n# Content",
    );
    expect(good.metadata).toEqual({ title: "Test", tags: ["a", "b"] });
    expect(good.html).not.toContain("tags:");
    const bad = renderMarkdown("---\ntitle: [broken\n---\n# Content");
    expect(bad.warnings).toHaveLength(1);
    expect(bad.html).toContain("[broken");
  });
  it("retains table alignment through safe attributes", () => {
    const result = renderMarkdown("| A | B |\n| :---: | ---: |\n| a | b |");
    expect(result.html).toContain('data-align="center"');
    expect(result.html).toContain('data-align="right"');
  });
  it("recognizes equations but leaves prices and code untouched", () => {
    const result = renderMarkdown(
      "价格 $10 和 $20。 $E=mc^2$ 和 $`x^2`$，`$code$`\n\n$$\nx+1\n$$\n\n```math\nx=2\n```",
    );
    expect(result.html.match(/data-tex=/g)).toHaveLength(4);
    expect(result.html).toContain("$10 和 $20");
    expect(result.html).toContain("<code>$code$</code>");
  });
  it("preserves incomplete math and escapes hostile diagram sources", () => {
    expect(renderMarkdown("$$\nunfinished").html).toContain("unfinished");
    const result = renderMarkdown(
      "```mermaid\n</div><script>alert(1)</script>\n```",
    );
    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;script&gt;");
  });
});
