import { describe, expect, it } from "vitest";
import { systemLocale, translate } from "../electron/i18n";
import { renderMarkdown } from "../src/markdown";

describe("interface languages", () => {
  it.each([
    ["zh", "zh"],
    ["zh-CN", "zh"],
    ["zh-Hant-TW", "zh"],
    ["ZH_hk", "zh"],
    ["en", "en"],
    ["en-US", "en"],
    ["en-GB", "en"],
    ["ja-JP", "en"],
    ["fr-FR", "en"],
    ["de-DE", "en"],
    ["", "en"],
  ])("maps system language %s to %s", (system, expected) => {
    expect(systemLocale(system)).toBe(expected);
  });

  it("localizes generated controls while preserving authored content", () => {
    const source =
      "# 中文原文\n\n::: tip\nKeep this text.\n:::\n\n```mermaid\nflowchart LR\nA[中文节点] --> B[English node]\n```";
    const english = renderMarkdown(source, "en");
    const chinese = renderMarkdown(source, "zh");
    expect(english.html).toContain('aria-label="Zoom in diagram"');
    expect(chinese.html).toContain('aria-label="放大图表"');
    expect(english.html).toContain('class="callout-title">Tip');
    expect(chinese.html).toContain('class="callout-title">提示');
    for (const rendered of [english, chinese]) {
      expect(rendered.html).toContain("中文原文");
      expect(rendered.html).toContain("中文节点");
      expect(rendered.html).toContain("Keep this text.");
    }
    expect(
      renderMarkdown("---\nbroken: [\n---\ntext", "en").warnings[0],
    ).toContain("Invalid YAML");
  });

  it("preserves literal filenames inside localized prompts", () => {
    expect(translate("en", "saveQuestion", { name: "中文 $&.md" })).toBe(
      "Save changes to “中文 $&.md”?",
    );
    expect(translate("zh", "saveQuestion", { name: "draft.md" })).toBe(
      "保存对“draft.md”的修改？",
    );
  });
});
