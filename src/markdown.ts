import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import footnote from "markdown-it-footnote";
import container from "markdown-it-container";
import alerts from "markdown-it-github-alerts";
import hljs from "highlight.js/lib/common";
import { load, FAILSAFE_SCHEMA } from "js-yaml";

export interface Heading {
  id: string;
  text: string;
  level: number;
}
export interface RenderedDocument {
  html: string;
  headings: Heading[];
  metadata: Record<string, unknown>;
  warnings: string[];
}

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const mathMarkup = (source: string, block: boolean) =>
  `<${block ? "div" : "span"} class="${block ? "math-block" : "math-inline"}" data-tex="${escape(source)}">${escape(source)}</${block ? "div" : "span"}>`;

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
  highlight(source, language) {
    return language && hljs.getLanguage(language)
      ? hljs.highlight(source, { language, ignoreIllegals: true }).value
      : escape(source);
  },
})
  .use(taskLists)
  .use(footnote)
  .use(alerts);

for (const type of ["info", "tip", "warning", "danger", "details", "note"]) {
  md.use(container, type, {
    render(tokens: any[], index: number) {
      const token = tokens[index];
      if (token.nesting === -1)
        return type === "details" ? "</details>\n" : "</aside>\n";
      const title =
        token.info.trim().slice(type.length).trim() ||
        {
          info: "信息",
          tip: "提示",
          warning: "注意",
          danger: "警告",
          details: "展开详情",
          note: "备注",
        }[type];
      return type === "details"
        ? `<details><summary>${escape(title)}</summary>\n`
        : `<aside class="callout ${type}"><p class="callout-title">${escape(title)}</p>\n`;
    },
  });
}

const defaultFence = md.renderer.rules.fence!;
for (const cell of ["th_open", "td_open"]) {
  md.renderer.rules[cell] = (tokens, index, options, _env, self) => {
    const style = tokens[index].attrGet("style");
    if (style)
      tokens[index].attrSet(
        "data-align",
        String(style).replace("text-align:", "").trim(),
      );
    return self.renderToken(tokens, index, options);
  };
}
md.renderer.rules.fence = (tokens, index, options, env, self) => {
  const token = tokens[index];
  const language = token.info.trim().split(/\s+/)[0].toLowerCase();
  if (language === "mermaid") {
    return `<figure class="diagram"><div class="diagram-caption"><span>MERMAID</span><button type="button" class="diagram-expand" aria-label="放大图表">放大 ↗</button></div><div class="mermaid-source">${escape(token.content)}</div></figure>`;
  }
  if (language === "math" || language === "latex")
    return mathMarkup(token.content, true);
  return `<div class="code-block"><span class="code-language">${escape(language || "text")}</span>${defaultFence(tokens, index, options, env, self)}</div>`;
};

md.inline.ruler.before("escape", "math_inline", (state, silent) => {
  const start = state.pos;
  if (
    state.src[start] !== "$" ||
    state.src[start + 1] === "$" ||
    /\s/.test(state.src[start + 1] || " ")
  )
    return false;
  const tick = state.src[start + 1] === "`";
  const delimiter = tick ? "`$" : "$";
  let end = state.src.indexOf(delimiter, start + (tick ? 2 : 1));
  while (end > 0 && state.src[end - 1] === "\\")
    end = state.src.indexOf(delimiter, end + delimiter.length);
  if (
    end < 0 ||
    /\s/.test(state.src[end - 1]) ||
    /\d/.test(state.src[end + delimiter.length] || "")
  )
    return false;
  const content = state.src.slice(start + (tick ? 2 : 1), end);
  if (!content || content.includes("\n")) return false;
  if (!silent) {
    const token = state.push("math_inline", "math", 0);
    token.content = content;
  }
  state.pos = end + delimiter.length;
  return true;
});
md.renderer.rules.math_inline = (tokens, index) =>
  mathMarkup(tokens[index].content, false);

md.block.ruler.before(
  "fence",
  "math_block",
  (state, start, end, silent) => {
    const line = state.src
      .slice(state.bMarks[start] + state.tShift[start], state.eMarks[start])
      .trim();
    if (!line.startsWith("$$")) return false;
    let content = line.slice(2);
    let next = start + 1;
    if (content.endsWith("$$") && content.length >= 2)
      content = content.slice(0, -2);
    else {
      let closed = false;
      for (; next < end; next++) {
        const following = state.src.slice(
          state.bMarks[next] + state.tShift[next],
          state.eMarks[next],
        );
        if (following.trim().endsWith("$$")) {
          content += `\n${following.trimEnd().slice(0, -2)}`;
          next++;
          closed = true;
          break;
        }
        content += `\n${following}`;
      }
      if (!closed) return false;
    }
    if (!silent) {
      const token = state.push("math_block", "math", 0);
      token.block = true;
      token.content = content.trim();
      token.map = [start, next];
    }
    state.line = next;
    return true;
  },
  { alt: ["paragraph", "reference", "blockquote", "list"] },
);
md.renderer.rules.math_block = (tokens, index) =>
  mathMarkup(tokens[index].content, true);

export function renderMarkdown(source: string): RenderedDocument {
  let body = source.replace(/^\uFEFF/, "");
  const warnings: string[] = [];
  let metadata: Record<string, unknown> = {};
  const frontmatter = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (frontmatter) {
    try {
      const parsed = load(frontmatter[1], { schema: FAILSAFE_SCHEMA });
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        metadata = parsed as Record<string, unknown>;
      body = body.slice(frontmatter[0].length);
    } catch {
      warnings.push("YAML 文档信息格式有误，已保留原文。");
    }
  }
  if (
    /^\s*(?:import\s.+from\s|export\s(?:const|default)|<script\b)/m.test(body)
  )
    warnings.push(
      "此文档包含组件或脚本。仅预览静态 Markdown，不运行项目代码。",
    );
  if (/!\[\[|\[\[[^\]]+\]\]/.test(body))
    warnings.push("Obsidian 双向链接与笔记嵌入尚未解析，已保留原文。");
  const env = {};
  const tokens = md.parse(body, env);
  const headings: Heading[] = [];
  const duplicates = new Map<string, number>();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type !== "heading_open") continue;
    const inline = tokens[index + 1];
    const text = (inline?.children ?? [])
      .filter((child) =>
        ["text", "code_inline", "math_inline", "image"].includes(child.type),
      )
      .map((child) => child.content)
      .join("");
    const base =
      text
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}\s_-]/gu, "")
        .replace(/\s/g, "-") || "section";
    const count = duplicates.get(base) ?? 0;
    duplicates.set(base, count + 1);
    const id = `${base}${count ? `-${count}` : ""}`;
    token.attrSet("id", id);
    headings.push({ id, text, level: Number(token.tag.slice(1)) });
  }
  return {
    html: md.renderer.render(tokens, md.options, env),
    headings,
    metadata,
    warnings,
  };
}
