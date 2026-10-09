import { BrowserWindow, dialog, session } from "electron";
import { open, rename, stat, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { DiagramExport } from "./shared";
import { diagramSize } from "./diagram-size";
import { translate, type Locale } from "./i18n";

let exporting = false;

export async function exportDiagram(
  parent: BrowserWindow,
  value: unknown,
  filename: string,
  locale: Locale,
): Promise<string | null> {
  const size = diagramSize(value, locale);
  const diagram = value as DiagramExport;
  if (exporting) return null;
  exporting = true;
  let renderer: BrowserWindow | undefined;
  let temporary: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await dialog.showSaveDialog(parent, {
      title: translate(locale, "exportDiagramTitle"),
      buttonLabel: translate(locale, "save"),
      defaultPath: `${path.basename(filename, path.extname(filename))}-mermaid.png`,
      filters: [{ name: "PNG", extensions: ["png"] }],
    });
    if (result.canceled || !result.filePath) return null;
    let target = result.filePath;
    if (!path.extname(target)) {
      target += ".png";
      // The native dialog could only confirm the name before we appended its extension.
      const exists = await stat(target).then(() => true, (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return false;
        throw error;
      });
      if (exists) {
        const confirmation = await dialog.showMessageBox(parent, {
          type: "warning",
          message: translate(locale, "replaceQuestion", { name: path.basename(target) }),
          buttons: [translate(locale, "cancel"), translate(locale, "replace")],
          defaultId: 0,
          cancelId: 0,
          noLink: true,
        });
        if (confirmation.response !== 1) return null;
      }
    }
    if (path.extname(target).toLowerCase() !== ".png")
      throw new Error(translate(locale, "pngExtension"));

    // A separate sandbox keeps document SVG away from file access and the reader IPC.
    const isolated = session.fromPartition("diagram-export");
    isolated.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    isolated.setPermissionCheckHandler(() => false);
    isolated.webRequest.onBeforeRequest((request, callback) =>
      callback({ cancel: !request.url.startsWith("data:") }),
    );
    const background = diagram.dark ? "#17212b" : "#f3f3f4";
    renderer = new BrowserWindow({
      ...size,
      useContentSize: true,
      enableLargerThanScreen: true,
      show: false,
      frame: false,
      backgroundColor: background,
      webPreferences: {
        session: isolated,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: false,
        offscreen: true,
        backgroundThrottling: false,
      },
    });
    const contents = renderer.webContents;
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-navigate", (event) => event.preventDefault());
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"><style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; overflow: hidden; background: ${background}; }
      body { text-align: center; font-family: system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif; }
      body > svg { display: block; width: ${size.width}px !important; height: ${size.height}px !important; max-width: none !important; overflow-wrap: normal; word-break: normal; line-height: 1.5; }
      p { margin: 0; line-height: 1.5; }
    </style></head><body></body></html>`;
    const render = async () => {
      await renderer!.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      await contents.executeJavaScript(`(async () => {
        const parsed = new DOMParser().parseFromString(${JSON.stringify(diagram.svg)}, 'image/svg+xml');
        const svg = parsed.documentElement;
        if (svg.localName !== 'svg' || svg.namespaceURI !== 'http://www.w3.org/2000/svg' || parsed.querySelector('parsererror')) throw new Error('Invalid SVG');
        // Export a static graph; executable and embedded browsing content is never needed.
        svg.querySelectorAll('script, iframe, object, embed, animate, animateMotion, animateTransform, set, foreignObject script').forEach(node => node.remove());
        for (const node of [svg, ...svg.querySelectorAll('*')]) {
          for (const attr of [...node.attributes]) {
            if (/^on/i.test(attr.name)) node.removeAttributeNode(attr);
          }
        }
        document.body.replaceChildren(document.importNode(svg, true));
        await document.fonts.ready;
        await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      })()`);
      // Animation frames only finish layout; wait for the offscreen compositor's pixels.
      const captured = await new Promise<Electron.NativeImage>(resolve => {
        const painted = (_event: Electron.Event, _dirty: Electron.Rectangle, image: Electron.NativeImage) => {
          const pixels = image.toBitmap();
          // Chromium can deliver the initial, solid background before the diagram's frame.
          for (let offset = 4; offset < pixels.length; offset += 4) {
            if (pixels.readUInt32LE(offset) !== pixels.readUInt32LE(0)) {
              contents.removeListener("paint", painted);
              resolve(image);
              return;
            }
          }
        };
        contents.on("paint", painted);
        contents.invalidate();
      });
      if (captured.isEmpty() || captured.getSize().width < size.width || captured.getSize().height < size.height)
        throw new Error(translate(locale, "invalidDiagram"));
      // Retina capture may contain more pixels; normalize down to the requested dimensions.
      return captured.resize({ ...size, quality: "best" }).toPNG();
    };
    const png = await Promise.race([
      render(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(translate(locale, "exportDiagramTimeout"))), 30_000);
      }),
    ]);
    temporary = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(png);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, target);
    return target;
  } finally {
    clearTimeout(timer);
    renderer?.destroy();
    if (temporary) await unlink(temporary).catch(() => {});
    exporting = false;
  }
}
