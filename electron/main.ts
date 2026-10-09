import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  session,
  shell,
} from "electron";
import { watch, type FSWatcher } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import {
  isMarkdown,
  readDocument,
  resolveWithin,
  saveDocument,
  diskVersion,
  MAX_DOCUMENT_BYTES,
} from "./files";
import type { DocumentData } from "./shared";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "markview-asset",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
let window: BrowserWindow | null = null;
let current: DocumentData | null = null;
let draft = "";
let editing = false;
let operation = false;
let allowClose = false;
let watcher: FSWatcher | undefined;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let pendingFile = process.argv
  .slice(1)
  .find((arg) => isMarkdown(arg) && !arg.startsWith("-"));
const devURL = process.env.MARKVIEW_DEV_URL;
const rendererFile = path.join(__dirname, "../dist/index.html");
const rendererURL = devURL || pathToFileURL(rendererFile).href;
const icon = app.isPackaged
  ? path.join(process.resourcesPath, "icon.png")
  : path.join(__dirname, "../build/icon.png");
const dirty = () => !!current && draft !== current.content;

function report(error: unknown) {
  window?.webContents.send(
    "reader:error",
    error instanceof Error ? error.message : String(error),
  );
}
function updateTitle() {
  window?.setTitle(
    `${dirty() ? "● " : ""}${current?.name ?? "墨阅"} — Markview`,
  );
  window?.setDocumentEdited(dirty());
}
function publish(doc: DocumentData) {
  current = doc;
  draft = doc.content;
  updateTitle();
  window?.webContents.send("reader:document", doc);
  return doc;
}
async function exclusive<T>(action: () => Promise<T>): Promise<T | null> {
  if (operation) return null;
  operation = true;
  window?.webContents.send("reader:busy", true);
  try {
    return await action();
  } finally {
    operation = false;
    window?.webContents.send("reader:busy", false);
  }
}
function beginWatching(file: string) {
  watcher?.close();
  watcher = undefined;
  clearTimeout(refreshTimer);
  if (!file) return;
  // Directory watch survives atomic saves by this app and other editors.
  watcher = watch(path.dirname(file), (_event, name) => {
    if (name && name.toString() !== path.basename(file)) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      void refreshFromDisk(file).catch(report);
    }, 300);
  });
  watcher.on("error", report);
}
async function refreshFromDisk(file: string) {
  if (current?.path !== file) return;
  if (operation) {
    refreshTimer = setTimeout(() => {
      void refreshFromDisk(file).catch(report);
    }, 300);
    return;
  }
  const baseline = current;
  const loaded = await readDocument(file);
  if (current !== baseline || operation || loaded.version === current.version)
    return;
  if (dirty() || editing) {
    window?.webContents.send("reader:menu", "external-change");
    return;
  }
  publish({ ...loaded, assetBase: current.assetBase });
}
async function saveCurrent(saveAs = false): Promise<DocumentData | null> {
  if (!current || !window) return null;
  let target = current.path;
  if (saveAs || !target) {
    const result = await dialog.showSaveDialog(window, {
      title: "保存 Markdown 文档",
      defaultPath: target || "未命名.md",
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (result.canceled || !result.filePath) return null;
    target = result.filePath;
    if (!path.extname(target)) target += ".md";
  }
  const sameFile = target === current.path;
  const expected = sameFile ? current.version : await diskVersion(target);
  if (!sameFile && expected !== null) {
    const result = await dialog.showMessageBox(window, {
      type: "warning",
      message: `替换“${path.basename(target)}”？`,
      detail: "目标文件已存在，替换后将写入当前编辑内容。",
      buttons: ["取消", "替换"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (result.response !== 1) return null;
  }
  const loaded = await saveDocument(target, draft, expected, current);
  const doc = {
    ...loaded,
    assetBase: sameFile
      ? current.assetBase
      : `markview-asset://${randomUUID()}/`,
  };
  beginWatching(doc.path);
  return publish(doc);
}
async function confirmTransition(): Promise<boolean> {
  if (!dirty() || !window) return true;
  const { response } = await dialog.showMessageBox(window, {
    type: "warning",
    message: `保存对“${current!.name}”的修改？`,
    detail: "未保存的修改会丢失。",
    buttons: ["保存", "不保存", "取消"],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  });
  if (response === 2) return false;
  if (response === 0) return !!(await saveCurrent());
  return true;
}
async function openDocument(file: string): Promise<DocumentData | null> {
  // Validate before asking to discard a draft; an invalid file leaves it intact.
  await readDocument(file);
  if (!(await confirmTransition())) return null;
  const loaded = await readDocument(file);
  const doc = { ...loaded, assetBase: `markview-asset://${randomUUID()}/` };
  beginWatching(doc.path);
  return publish(doc);
}
async function chooseFile() {
  if (!window) return null;
  const result = await dialog.showOpenDialog(window, {
    title: "打开 Markdown 文档",
    properties: ["openFile"],
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
  });
  return result.canceled ? null : openDocument(result.filePaths[0]);
}
async function newDocument(content = "") {
  if (!(await confirmTransition())) return null;
  beginWatching("");
  const doc: DocumentData = {
    path: "",
    name: "未命名.md",
    content: "",
    assetBase: `markview-asset://${randomUUID()}/`,
    version: null,
    modifiedAt: 0,
    bom: false,
    lineEnding: "\n",
  };
  publish(doc);
  editing = true;
  draft = content;
  window?.webContents.send("reader:menu", "edit");
  updateTitle();
  return doc;
}
const run = (action: () => Promise<unknown>) => {
  void exclusive(action).catch(report);
};
function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" as const }] : []),
    {
      label: "文件",
      submenu: [
        {
          label: "新建文档",
          accelerator: "CmdOrCtrl+N",
          click: () => run(() => newDocument()),
        },
        {
          label: "打开文档…",
          accelerator: "CmdOrCtrl+O",
          click: () => run(chooseFile),
        },
        {
          label: "保存",
          accelerator: "CmdOrCtrl+S",
          click: () => run(() => saveCurrent()),
        },
        {
          label: "另存为…",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => run(() => saveCurrent(true)),
        },
        {
          label: "重新加载",
          accelerator: "CmdOrCtrl+R",
          click: () =>
            run(() =>
              current?.path
                ? openDocument(current.path)
                : Promise.resolve(null),
            ),
        },
        { type: "separator" },
        { role: process.platform === "darwin" ? "close" : "quit" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
        { type: "separator" },
        {
          label: "查找预览内容",
          accelerator: "CmdOrCtrl+F",
          click: () => window?.webContents.send("reader:menu", "find"),
        },
      ],
    },
    {
      label: "视图",
      submenu: [
        {
          label: "编辑 / 阅读",
          accelerator: "CmdOrCtrl+E",
          click: () => window?.webContents.send("reader:menu", "toggle-edit"),
        },
        {
          label: "显示 / 隐藏目录",
          accelerator: "CmdOrCtrl+Shift+L",
          click: () => window?.webContents.send("reader:menu", "outline"),
        },
        { role: "togglefullscreen" },
        ...(devURL ? [{ role: "toggleDevTools" as const }] : []),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
function createWindow() {
  allowClose = false;
  window = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 820,
    minHeight: 560,
    title: "墨阅 · Markview",
    backgroundColor: "#f4f3ef",
    icon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
    },
  });
  window.once("ready-to-show", () => window?.show());
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.webContents.on("found-in-page", (_event, result) =>
    window?.webContents.send("reader:find-result", result),
  );
  window.on("close", (event) => {
    if (!allowClose && (dirty() || operation)) {
      event.preventDefault();
      run(async () => {
        if (await confirmTransition()) {
          allowClose = true;
          window?.close();
        }
      });
    }
  });
  window.on("closed", () => {
    window = null;
    draft = current?.content ?? "";
    editing = false;
  });
  if (devURL) void window.loadURL(devURL);
  else void window.loadFile(rendererFile);
}
function trusted(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) {
  return (
    !!window &&
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    event.senderFrame?.url.split("#")[0] === rendererURL
  );
}
function registerIPC() {
  const handle = (channel: string, callback: (...args: any[]) => unknown) => {
    ipcMain.handle(channel, (event, ...args) => {
      if (!trusted(event)) throw new Error("不允许的调用来源。");
      return callback(...args);
    });
  };
  ipcMain.on(
    "reader:draft",
    (event, id: unknown, content: unknown, isEditing: unknown) => {
      if (
        !trusted(event) ||
        !current ||
        id !== current.assetBase ||
        typeof content !== "string" ||
        Buffer.byteLength(content) > MAX_DOCUMENT_BYTES
      )
        return;
      draft = content;
      editing = isEditing === true;
      updateTitle();
    },
  );
  handle("reader:open", () => exclusive(chooseFile));
  handle("reader:current", () => current);
  handle("reader:new", (content: unknown) => {
    if (
      typeof content !== "string" ||
      Buffer.byteLength(content) > MAX_DOCUMENT_BYTES
    )
      throw new Error("文档内容无效。");
    return exclusive(() => newDocument(content));
  });
  handle("reader:save", (saveAs: unknown) =>
    exclusive(() => saveCurrent(saveAs === true)),
  );
  handle("reader:drop", (file: unknown) => {
    if (typeof file !== "string" || !path.isAbsolute(file))
      throw new Error("请从文件管理器拖入文档。");
    return exclusive(() => openDocument(file));
  });
  handle("reader:reload", () =>
    exclusive(() =>
      current?.path ? openDocument(current.path) : Promise.resolve(null),
    ),
  );
  handle("reader:link", async (href: unknown) => {
    if (typeof href !== "string" || href.length > 8192)
      throw new Error("无效链接。");
    if (/^https?:\/\//i.test(href)) {
      await shell.openExternal(new URL(href).href);
      return;
    }
    if (
      !current?.path ||
      /^[a-z][a-z\d+.-]*:/i.test(href) ||
      href.startsWith("//") ||
      href.startsWith("\\")
    )
      throw new Error("请先保存文档，或使用“打开文档”选择文件。");
    const file = await resolveWithin(
      path.dirname(current.path),
      decodeURIComponent(href.split(/[?#]/)[0]),
    );
    await exclusive(() => openDocument(file));
  });
  handle("reader:find", (text: unknown, forward: unknown) => {
    if (typeof text !== "string" || text.length > 500) return;
    if (text)
      window?.webContents.findInPage(text, { forward: forward !== false });
    else window?.webContents.stopFindInPage("clearSelection");
  });
  handle("reader:stop-find", () =>
    window?.webContents.stopFindInPage("clearSelection"),
  );
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("open-file", (event, file) => {
    event.preventDefault();
    if (app.isReady()) {
      if (!window) createWindow();
      run(() => openDocument(file));
    } else pendingFile = file;
  });
  app.on("second-instance", (_event, argv) => {
    const file = argv
      .slice(1)
      .find((arg) => isMarkdown(arg) && !arg.startsWith("-"));
    if (!window) createWindow();
    if (file) run(() => openDocument(file));
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app.whenReady().then(async () => {
    app.setAppUserModelId("dev.markview.reader");
    if (process.platform === "darwin") app.dock?.setIcon(icon);
    session.defaultSession.setPermissionRequestHandler(
      (_wc, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    await protocol.handle("markview-asset", async (request) => {
      try {
        if (!current?.path || !request.url.startsWith(current.assetBase))
          return new Response("", { status: 403 });
        const url = new URL(request.url);
        const file = await resolveWithin(
          path.dirname(current.path),
          decodeURIComponent(url.pathname.slice(1)),
        );
        if (
          !/\.(png|jpe?g|gif|webp|svg|avif|ico)$/i.test(file) ||
          (await stat(file)).size > 20 * 1024 * 1024
        )
          return new Response("", { status: 403 });
        const response = await net.fetch(pathToFileURL(file).href);
        return new Response(response.body, {
          headers: {
            "Content-Type":
              response.headers.get("Content-Type") ??
              "application/octet-stream",
            "Content-Security-Policy":
              "default-src 'none'; style-src 'unsafe-inline'",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch {
        return new Response("", { status: 404 });
      }
    });
    registerIPC();
    createMenu();
    if (pendingFile) {
      try {
        await openDocument(pendingFile);
      } catch (error) {
        dialog.showErrorBox(
          "无法打开文档",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    createWindow();
    app.on("activate", () => {
      if (!window) createWindow();
    });
  });
  app.on("before-quit", (event) => {
    if (!allowClose && (dirty() || operation)) {
      event.preventDefault();
      run(async () => {
        if (await confirmTransition()) {
          allowClose = true;
          app.quit();
        }
      });
    }
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("will-quit", () => {
    watcher?.close();
    clearTimeout(refreshTimer);
  });
}
