import DOMPurify from "dompurify";

let counter = 0;
let queue = Promise.resolve();

// Mermaid maintains global rendering state, so document refreshes must not render concurrently.
export function enhanceDocument(
  root: HTMLElement,
  dark: boolean,
  isCurrent: () => boolean,
) {
  const work = async () => {
    if (!isCurrent()) return;
    const formulas = root.querySelectorAll<HTMLElement>("[data-tex]");
    if (formulas.length) {
      const { renderMath } = await import("./math");
      for (const formula of formulas) {
        if (!isCurrent()) return;
        try {
          formula.innerHTML = DOMPurify.sanitize(
            renderMath(
              formula.dataset.tex!,
              formula.classList.contains("math-block"),
            ),
            {
              ADD_TAGS: ["mjx-container"],
              USE_PROFILES: { html: true, svg: true, svgFilters: true },
            },
          );
        } catch {
          formula.classList.add("render-error");
          formula.title = "公式解析失败，已保留源码";
        }
      }
    }
    const diagrams = root.querySelectorAll<HTMLElement>(".mermaid-source");
    if (!diagrams.length || !isCurrent()) return;
    const { default: mermaid } = await import("mermaid");
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      layout: "elk",
      elk: { preset: "legacy" },
      themeVariables: {
        darkMode: dark,
        background: dark ? "#17212b" : "#f3f3f4",
        primaryColor: dark ? "#203d55" : "#e5f2ff",
        primaryTextColor: dark ? "#8bc5ff" : "#339cff",
        primaryBorderColor: dark ? "#45637c" : "#d3d9df",
        lineColor: dark ? "#8c9aa9" : "#999999",
        secondaryColor: dark ? "#1b2935" : "#fefefe",
        tertiaryColor: dark ? "#1b2935" : "#fefefe",
        clusterBkg: dark ? "#1b2935" : "#fefefe",
        clusterBorder: dark ? "#344352" : "#e5e5e7",
        titleColor: dark ? "#dce5ee" : "#282a2e",
        edgeLabelBackground: dark ? "#17212b" : "#ffffff",
        strokeWidth: 1,
        useGradient: false,
        dropShadow: "none",
      },
      flowchart: {
        theme: "base",
        look: "classic",
        curve: "rounded",
        wrappingWidth: 360,
        padding: 20,
        diagramPadding: 24,
      },
      // Embed geometry in the SVG so enlarged diagrams retain the same styling.
      themeCSS: `
        .node rect.label-container { rx: 16px; ry: 16px; }
        .edgeLabel .labelBkg { background: transparent; }
        .edgeLabel p { border: 1px solid currentColor; border-radius: 999px; padding: 2px 12px; }
      `,
      fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
      maxTextSize: 50000,
      maxEdges: 1000,
      suppressErrorRendering: true,
      secure: [
        "secure",
        "securityLevel",
        "startOnLoad",
        "maxTextSize",
        "maxEdges",
        "suppressErrorRendering",
      ],
    });
    for (const diagram of diagrams) {
      if (!isCurrent()) return;
      const source = diagram.textContent || "";
      try {
        const { svg } = await mermaid.render(
          `markview-diagram-${++counter}`,
          source,
        );
        if (!isCurrent()) return;
        diagram.innerHTML = svg;
        diagram.classList.add("is-rendered");
      } catch (error) {
        if (!isCurrent()) return;
        diagram.replaceChildren();
        const message = document.createElement("p");
        message.className = "render-error";
        message.textContent = "图表暂时无法渲染，原文已保留。";
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = "查看错误和源码";
        const pre = document.createElement("pre");
        pre.textContent = `${String(error).slice(0, 1500)}\n\n${source}`;
        details.append(summary, pre);
        diagram.append(message, details);
      }
    }
  };
  const result = queue.then(work);
  queue = result.catch(() => {});
  return result;
}
