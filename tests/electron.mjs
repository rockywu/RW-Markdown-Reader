import { _electron as electron } from "playwright";
import { strict as assert } from "node:assert";
import {
  mkdtemp,
  cp,
  readFile,
  writeFile,
  rename,
  rm,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const packaged = process.argv.includes("--packaged");
const releaseDirectory = path.resolve(
  process.env.MARKVIEW_RELEASE_DIR || path.join(root, "release"),
);
const executablePath = packaged
  ? process.platform === "darwin"
    ? path.join(
        releaseDirectory,
        process.arch === "arm64" ? "mac-arm64" : "mac",
        "Markview.app/Contents/MacOS/Markview",
      )
    : path.join(releaseDirectory, "win-unpacked/Markview.exe")
  : undefined;
const fixtures = await mkdtemp(path.join(tmpdir(), "markview-e2e-"));
const results = path.join(root, "test-results");
await mkdir(results, { recursive: true });
await cp(path.join(root, "examples"), fixtures, { recursive: true });
const sample = path.join(fixtures, "compatibility.md");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.MARKVIEW_DEV_URL;
const launch = () =>
  electron.launch({
    executablePath,
    args: [
      ...(packaged ? [] : [root]),
      `--user-data-dir=${path.join(fixtures, "profile")}`,
    ],
    env,
    timeout: 60000,
  });
let app = await launch();
let page;
const errors = [];
try {
  page = await app.firstWindow();
  await page.context().setOffline(true);
  page.on("pageerror", (error) => errors.push(error.message));
  const systemLanguage = await app.evaluate(
    ({ app }) => app.getPreferredSystemLanguages()[0] || app.getLocale(),
  );
  const expectedLanguage = /^zh(?:[-_]|$)/i.test(systemLanguage)
    ? "zh-CN"
    : "en";
  await page.waitForFunction(
    (language) =>
      document.documentElement.lang === language &&
      !!document.querySelector(".language-select"),
    expectedLanguage,
  );
  assert.equal(
    await page.evaluate(() => window.reader.getLocale()),
    expectedLanguage === "zh-CN" ? "zh" : "en",
  );
  await page
    .getByRole("combobox", { name: "界面语言 / Interface language" })
    .selectOption("en");
  await page
    .getByRole("heading", { name: "Give your words room to breathe." })
    .waitFor();
  await page
    .getByRole("combobox", { name: "界面语言 / Interface language" })
    .selectOption("zh");
  await page.getByRole("heading", { name: "让文字，清晰可见。" }).waitFor();
  await page
    .locator(".mermaid-source.is-rendered svg")
    .first()
    .waitFor({ timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelectorAll("mjx-container svg").length >= 2,
  );
  await page.screenshot({ path: path.join(results, "welcome-light.png") });
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  assert.equal(await page.evaluate(() => typeof window.process), "undefined");
  const security = await app.evaluate(({ BrowserWindow }) => {
    const prefs =
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      sandbox: prefs.sandbox,
      contextIsolation: prefs.contextIsolation,
      nodeIntegration: prefs.nodeIntegration,
    };
  });
  assert.deepEqual(security, {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
  });

  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, sample);
  await page.getByRole("button", { name: /打开文档/ }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".mermaid-source.is-rendered").length === 2 &&
      document.querySelector(".render-error"),
  );
  await page.waitForFunction(
    () => document.querySelectorAll("mjx-container svg").length === 4,
  );
  const originalDiagram = page.locator(".mermaid-source.is-rendered").first();
  assert.deepEqual(
    await originalDiagram
      .locator(".node rect.label-container")
      .first()
      .evaluate((node) => {
        const style = getComputedStyle(node);
        return { fill: style.fill, stroke: style.stroke, radius: style.rx };
      }),
    {
      fill: "rgb(229, 242, 255)",
      stroke: "rgb(211, 217, 223)",
      radius: "16px",
    },
  );
  assert.equal(
    await originalDiagram
      .locator(".node .nodeLabel")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
    "rgb(51, 156, 255)",
  );
  // Pills must fit inside Mermaid's measured labels and remain distinct after layout.
  assert.equal(
    await originalDiagram.evaluate((diagram) => {
      const labels = [...diagram.querySelectorAll("g.edgeLabel")].filter(
        (node) => node.textContent.trim(),
      );
      return labels.every((node, index) => {
        const a = node.getBoundingClientRect();
        const p = node.querySelector("p").getBoundingClientRect();
        return (
          p.width <= a.width + 1 &&
          p.height <= a.height + 1 &&
          labels.slice(index + 1).every((other) => {
            const b = other.getBoundingClientRect();
            return (
              a.right <= b.left ||
              b.right <= a.left ||
              a.bottom <= b.top ||
              b.bottom <= a.top
            );
          })
        );
      });
    }),
    true,
    "original diagram labels fit without overlapping",
  );
  assert.equal(
    (await page
      .locator(".mermaid-source.is-rendered")
      .first()
      .getByText("可信认证方", { exact: false })
      .count()) > 0,
    true,
  );
  assert.equal(await page.locator(".markdown-alert").count(), 2);
  // Code blocks copy their source without the language label, then confirm.
  const copyButton = page.getByRole("button", { name: "复制代码" }).first();
  await copyButton.click();
  await page.getByRole("button", { name: "已复制" }).waitFor();
  assert.equal(
    await app.evaluate(({ clipboard }) => clipboard.readText()),
    "const greeting: string = '你好，Markdown';\nconsole.log(greeting);",
  );
  await page.getByRole("button", { name: "复制代码" }).first().waitFor();

  // Back to top appears after scrolling past one screen.
  const backToTop = page.getByRole("button", { name: "回到顶部" });
  await page
    .locator(".reading-scroll")
    .evaluate((element) => element.scrollTo(0, 0));
  await backToTop.waitFor({ state: "detached" });
  await page
    .locator(".reading-scroll")
    .evaluate((element) => element.scrollTo(0, element.scrollHeight));
  await backToTop.click();
  await page.waitForFunction(
    () => document.querySelector(".reading-scroll").scrollTop === 0,
  );
  await backToTop.waitFor({ state: "detached" });

  await page.locator("article img").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const img = document.querySelector("article img");
    return img?.complete && img.naturalWidth > 0;
  });
  await page
    .locator(".diagram")
    .first()
    .screenshot({ path: path.join(results, "original-mermaid.png") });
  await page
    .getByRole("button", { name: "放大图表", exact: true })
    .first()
    .click();
  assert.equal(
    await page.locator("dialog").evaluate((dialog) => dialog.open),
    true,
  );
  await page
    .locator("dialog")
    .screenshot({ path: path.join(results, "diagram-expanded.png") });
  assert.equal(
    await page
      .locator(".enlarged-diagram .node rect.label-container")
      .first()
      .evaluate((node) => getComputedStyle(node).fill),
    "rgb(229, 242, 255)",
  );
  // Expand only the capture viewport to include the complete rendered architecture.
  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
  }));
  await page.setViewportSize({ width: 1200, height: 1500 });
  const captureStyle = await page.addStyleTag({
    content:
      ".diagram-dialog { top: 0; margin-top: 0; height: auto; max-height: none; width: 1100px; } .diagram-viewport { height: auto; overflow: visible; }",
  });
  await page
    .locator(".enlarged-diagram")
    .screenshot({ path: path.join(results, "mermaid-blue-theme.png") });
  await captureStyle.evaluate((element) => element.remove());
  await page.setViewportSize(viewport);
  await page.getByRole("button", { name: "关闭图表" }).click();

  await page.getByRole("button", { name: "切换深色主题" }).click();
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.theme === "dark" &&
      document.querySelectorAll(".mermaid-source.is-rendered").length === 2,
  );
  assert.equal(
    await originalDiagram
      .locator(".node rect.label-container")
      .first()
      .evaluate((node) => getComputedStyle(node).fill),
    "rgb(32, 61, 85)",
  );
  await page
    .locator(".reading-scroll")
    .evaluate((element) => element.scrollTo(0, 0));
  await page.screenshot({ path: path.join(results, "document-dark.png") });

  await page.getByRole("button", { name: "查找文档" }).click();
  await page.getByRole("textbox", { name: "搜索内容" }).fill("架构图");
  await page.waitForFunction(() =>
    /\/ [1-9]/.test(document.querySelector(".search-bar")?.textContent ?? ""),
  );
  await page.getByRole("button", { name: "关闭查找" }).click();

  // Atomic-save watcher: the file identity changes, but the open document must refresh.
  await page
    .locator(".reading-scroll")
    .evaluate((element) => element.scrollTo(0, 300));
  const beforeScroll = await page
    .locator(".reading-scroll")
    .evaluate((element) => element.scrollTop);
  const source = await readFile(sample, "utf8");
  await writeFile(
    path.join(fixtures, "replacement.tmp"),
    `${source}\n\n## 自动刷新验证\n\n文件替换后仍能更新。\n`,
  );
  await rename(path.join(fixtures, "replacement.tmp"), sample);
  await page.getByRole("heading", { name: "自动刷新验证" }).waitFor();
  await page.waitForFunction(
    () =>
      !document.querySelector(".statusbar")?.textContent?.includes("正在渲染"),
  );
  const afterScroll = await page
    .locator(".reading-scroll")
    .evaluate((element) => element.scrollTop);
  assert.ok(
    Math.abs(beforeScroll - afterScroll) < 10,
    `scroll preserved: ${beforeScroll} -> ${afterScroll}`,
  );

  await page
    .locator("article")
    .getByRole("link", { name: "打开关联文档" })
    .click();
  await page.getByRole("heading", { name: "让文字，清晰可见。" }).waitFor();
  await page.waitForFunction(() => {
    const target = document.getElementById("公式也很自然");
    const scroller = document.querySelector(".reading-scroll");
    if (!target || !scroller) return false;
    const offset =
      target.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    return offset >= -2 && offset < 60;
  });

  // Real File objects from Chromium exercise Electron webUtils + the drop IPC boundary.
  const unicode = path.join(fixtures, "中文 空格.md");
  await writeFile(
    unicode,
    '# 拖放文档\n\n<script>window.pwned = true</script>\n<img src=x onerror="window.pwned=true">\n\n[危险链接](javascript:alert(1))\n',
  );
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.id = "drop-fixture";
    document.body.append(input);
  });
  await page.locator("#drop-fixture").setInputFiles(unicode);
  await page.evaluate(() => {
    const input = document.querySelector("#drop-fixture");
    const transfer = new DataTransfer();
    transfer.items.add(input.files[0]);
    document
      .querySelector(".app-shell")
      .dispatchEvent(
        new DragEvent("drop", { bubbles: true, dataTransfer: transfer }),
      );
    input.remove();
  });
  await page.getByRole("heading", { name: "拖放文档" }).waitFor();
  assert.equal(await page.evaluate(() => window.pwned), undefined);
  assert.equal(
    await page
      .locator(
        'article script, article [onerror], article a[href^="javascript:"]',
      )
      .count(),
    0,
  );
  // Editing is local until an explicit save, including Mermaid and formula preview.
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  const editor = page.getByRole("textbox", {
    name: "Markdown 源码",
    exact: true,
  });
  const edited =
    "# 实时编辑\n\n文字 **实时更新**，公式 $E=mc^2$。\n\n```mermaid\nflowchart LR\n A[输入] --> B[实时预览]\n```\n\n| 功能 | 状态 |\n| --- | --- |\n| 编辑 | 完成 |\n";
  await editor.fill(edited);
  await page.getByRole("heading", { name: "实时编辑", exact: true }).waitFor();
  await page.locator(".mermaid-source.is-rendered svg").waitFor();
  await page.locator("mjx-container svg").waitFor();
  assert.notEqual(
    await readFile(unicode, "utf8"),
    edited,
    "typing does not implicitly save",
  );
  await page.getByRole("button", { name: "切换浅色主题" }).click();
  await page.waitForFunction(
    () =>
      !document.querySelector(".statusbar")?.textContent?.includes("正在渲染"),
  );
  await page.screenshot({
    path: path.join(results, "editor-live-preview.png"),
  });
  // Resize with both pointer and keyboard, then hide/show without touching the draft.
  const divider = page.getByRole("separator", {
    name: "调整编辑区与预览区宽度",
  });
  const dividerBox = await divider.boundingBox();
  const oldWidth = await page
    .locator(".editor-pane")
    .evaluate((pane) => pane.clientWidth);
  await page.mouse.move(
    dividerBox.x + dividerBox.width / 2,
    dividerBox.y + 120,
  );
  await page.mouse.down();
  await page.mouse.move(dividerBox.x + 150, dividerBox.y + 120, { steps: 8 });
  await page.mouse.up();
  assert.ok(
    (await page.locator(".editor-pane").evaluate((pane) => pane.clientWidth)) >
      oldWidth + 100,
  );
  await divider.focus();
  await divider.press("Home");
  assert.equal(await divider.getAttribute("aria-valuenow"), "20");
  await divider.press("End");
  assert.equal(await divider.getAttribute("aria-valuenow"), "80");
  await divider.dblclick();
  assert.equal(await divider.getAttribute("aria-valuenow"), "45");
  await divider.press("ArrowRight");
  assert.equal(await divider.getAttribute("aria-valuenow"), "47");
  await page.getByRole("button", { name: "隐藏预览", exact: true }).click();
  assert.equal(await page.locator(".preview-pane").isVisible(), false);
  assert.equal(await divider.count(), 0);
  assert.ok(
    await page
      .locator(".editor-pane")
      .evaluate(
        (pane) =>
          Math.abs(pane.clientWidth - pane.parentElement.clientWidth) < 2,
      ),
  );
  await editor.fill(edited + "\n## 隐藏时仍可编辑\n");
  await page.screenshot({
    path: path.join(results, "editor-preview-hidden.png"),
  });
  await page.getByRole("button", { name: "阅读", exact: true }).click();
  assert.equal(await page.locator(".preview-pane").isVisible(), true);
  await page.getByRole("heading", { name: "隐藏时仍可编辑" }).waitFor();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  assert.equal(await page.locator(".preview-pane").isVisible(), false);
  await page.getByRole("button", { name: "显示预览", exact: true }).click();
  assert.equal(await divider.getAttribute("aria-valuenow"), "47");
  assert.equal(await editor.inputValue(), edited + "\n## 隐藏时仍可编辑\n");
  await editor.fill(edited);
  await page.getByRole("button", { name: "阅读", exact: true }).click();
  assert.equal(await editor.isVisible(), false);
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  assert.equal(await editor.inputValue(), edited);
  await app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()
      .items.find((i) => i.label === "文件")
      .submenu.items.find((i) => i.label === "保存")
      .click(),
  );
  await page.waitForFunction(() => !document.querySelector(".unsaved-label"));
  assert.equal(await readFile(unicode, "utf8"), edited);
  await page
    .getByRole("status")
    .filter({ hasText: `已保存到 ${path.basename(unicode)}` })
    .waitFor();

  // External changes never overwrite the draft or get silently overwritten on save.
  const localDraft = edited + "\n本地未保存的修改。\n";
  await editor.fill(localDraft);
  await writeFile(unicode, "# 外部版本\n请保留这份内容。");
  await page.locator(".conflict-banner").waitFor();
  assert.equal(await editor.inputValue(), localDraft);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "未覆盖" }).waitFor();
  assert.equal(await readFile(unicode, "utf8"), "# 外部版本\n请保留这份内容。");
  const copy = path.join(fixtures, "保存副本.md");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, copy);
  await page.getByRole("button", { name: "另存为副本" }).click();
  await page.waitForFunction(
    () =>
      !document.querySelector(".unsaved-label") &&
      !document.querySelector(".conflict-banner"),
  );
  assert.equal(await readFile(copy, "utf8"), localDraft);
  assert.equal(await readFile(unicode, "utf8"), "# 外部版本\n请保留这份内容。");

  // Cancel must preserve the draft for open, close and application quit.
  await editor.fill(localDraft + "\n保留草稿");
  await app.evaluate(({ dialog }) => {
    globalThis.promptCount = 0;
    dialog.showMessageBox = async () => {
      globalThis.promptCount++;
      return { response: 2, checkboxChecked: false };
    };
  });
  await page.getByRole("button", { name: /打开文档/ }).click();
  await page.waitForFunction(
    () => !document.querySelector(".source-editor").readOnly,
  );
  assert.equal(await editor.inputValue(), localDraft + "\n保留草稿");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].close(),
  );
  await page.waitForFunction(
    () => !document.querySelector(".source-editor").readOnly,
  );
  assert.equal(await editor.inputValue(), localDraft + "\n保留草稿");
  await app.evaluate(({ app }) => app.quit());
  await page.waitForFunction(
    () => !document.querySelector(".source-editor").readOnly,
  );
  assert.equal(await app.evaluate(() => globalThis.promptCount), 3);

  // Saving in the unsaved-changes dialog completes before changing documents.
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({
      response: 0,
      checkboxChecked: false,
    });
  });
  await page.getByRole("button", { name: /打开文档/ }).click();
  await page
    .getByRole("heading", { name: "Markdown 兼容性样本", exact: true })
    .waitFor();
  assert.equal(await readFile(copy, "utf8"), localDraft + "\n保留草稿");

  await page.getByRole("button", { name: "新建", exact: true }).click();
  await editor.fill("# 新建文档\n\n新的内容");
  await app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: true });
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.waitForFunction(
    () => !document.querySelector(".source-editor").readOnly,
  );
  assert.equal(await editor.inputValue(), "# 新建文档\n\n新的内容");
  assert.equal(await page.locator(".unsaved-label").count(), 1);
  const created = path.join(fixtures, "新建保存.md");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, created);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".unsaved-label"));
  assert.equal(await readFile(created, "utf8"), "# 新建文档\n\n新的内容");

  // Author styles override the defaults, and diagram config never leaks to its neighbor.
  await editor.fill(
    await readFile(path.join(fixtures, "mermaid-styles.md"), "utf8"),
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".mermaid-source.is-rendered").length === 3,
  );
  const styledDiagrams = page.locator(".mermaid-source.is-rendered");
  const fills = () =>
    styledDiagrams.evaluateAll((diagrams) =>
      diagrams.map((diagram) =>
        [...diagram.querySelectorAll(".node rect.label-container")].map(
          (node) => getComputedStyle(node).fill,
        ),
      ),
    );
  const customFills = [
    ["rgb(220, 252, 231)", "rgb(255, 247, 237)"],
    ["rgb(255, 240, 246)", "rgb(255, 240, 246)"],
  ];
  assert.deepEqual(await fills(), [
    ...customFills,
    ["rgb(229, 242, 255)", "rgb(229, 242, 255)"],
  ]);
  assert.equal(
    await styledDiagrams
      .first()
      .locator(".flowchart-link")
      .evaluate((edge) => getComputedStyle(edge).stroke),
    "rgb(249, 115, 22)",
  );
  await page
    .getByRole("button", { name: "放大图表", exact: true })
    .first()
    .click();
  assert.equal(
    await page
      .locator(".enlarged-diagram .node rect.label-container")
      .first()
      .evaluate((node) => getComputedStyle(node).fill),
    "rgb(220, 252, 231)",
  );
  await page.getByRole("button", { name: "关闭图表" }).click();
  await page.getByRole("button", { name: "切换深色主题" }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".mermaid-source.is-rendered").length === 3 &&
      getComputedStyle(
        document
          .querySelectorAll(".mermaid-source.is-rendered")[2]
          .querySelector(".node rect.label-container"),
      ).fill === "rgb(32, 61, 85)",
  );
  assert.deepEqual(await fills(), [
    ...customFills,
    ["rgb(32, 61, 85)", "rgb(32, 61, 85)"],
  ]);
  await page.screenshot({
    path: path.join(results, "mermaid-custom-colors.png"),
  });

  const preservedDraft = await editor.inputValue();
  await page
    .getByRole("combobox", { name: "界面语言 / Interface language" })
    .selectOption("en");
  await page
    .getByRole("button", { name: "Hide preview", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Markdown source", exact: true })
      .inputValue(),
    preservedDraft,
  );
  assert.deepEqual(
    await app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu()
        .items.filter((item) => ["File", "Edit", "View"].includes(item.label))
        .map((item) => item.label),
    ),
    ["File", "Edit", "View"],
  );
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async (_window, options) => {
      globalThis.localizedPrompt = options;
      return { response: 2, checkboxChecked: false };
    };
  });
  await page.getByRole("button", { name: "New", exact: true }).click();
  assert.deepEqual(
    await app.evaluate(() => globalThis.localizedPrompt.buttons),
    ["Save", "Don’t save", "Cancel"],
  );
  assert.match(
    await app.evaluate(() => globalThis.localizedPrompt.message),
    /^Save changes to /,
  );
  assert.equal(
    await page.locator(".source-editor").inputValue(),
    preservedDraft,
  );
  const invalidFile = path.join(fixtures, "invalid.txt");
  await writeFile(invalidFile, "Not a Markdown file");
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, invalidFile);
  await page.getByRole("button", { name: /Open document/ }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Select a .md or .markdown document." })
    .waitFor();
  await page.getByRole("button", { name: "Dismiss error" }).click();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".unsaved-label"));
  await page.screenshot({ path: path.join(results, "editor-english.png") });
  await page.getByRole("button", { name: "Hide preview", exact: true }).click();

  const logo = await page.locator(".brand-logo").evaluate((img) => ({
    loaded: img.complete && img.naturalWidth > 0,
    url: img.src,
  }));
  assert.ok(logo.loaded);
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(900, 700),
  );
  assert.ok(
    await page
      .locator(".toolbar")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  );
  await app.close();
  app = await launch();
  page = await app.firstWindow();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.context().setOffline(true);
  await page
    .getByRole("heading", { name: "Give your words room to breathe." })
    .waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.lang), "en");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("button", { name: "Show preview", exact: true })
    .waitFor();
  assert.equal(await page.locator(".preview-pane").isVisible(), false);
  await page.getByRole("button", { name: "Show preview", exact: true }).click();
  assert.equal(
    await page
      .getByRole("separator", { name: "Resize editor and preview" })
      .getAttribute("aria-valuenow"),
    "47",
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "PASS: system language, Chinese/English UI, native menus and prompts, language persistence, draggable and keyboard-accessible divider, preview visibility and width persistence, draft preservation, rendering, offline preview, Mermaid themes, math, images, zoom, search, refresh, links, drop, sandbox, editing, safe saves and application logo.",
  );
} catch (error) {
  if (page) {
    await page
      .screenshot({ path: path.join(results, "failure.png") })
      .catch(() => {});
    console.error(
      await page
        .locator("body")
        .innerText()
        .catch(() => "No DOM"),
    );
  }
  console.error("Renderer errors:", errors);
  throw error;
} finally {
  await app
    .evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({
        response: 1,
        checkboxChecked: false,
      });
    })
    .catch(() => {});
  await app.close();
  await rm(fixtures, { recursive: true, force: true });
}
