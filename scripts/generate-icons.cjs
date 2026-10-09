// One vector master for the application, Dock, installer, uninstaller and shortcuts.
const { app, BrowserWindow, nativeImage } = require("electron");
const { readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");
app
  .whenReady()
  .then(async () => {
    const root = path.join(__dirname, "..", "build");
    const svg = await readFile(path.join(root, "icon.svg"), "utf8");
    const window = new BrowserWindow({
      width: 1024,
      height: 1024,
      useContentSize: true,
      show: false,
      frame: false,
      transparent: true,
      webPreferences: { sandbox: true, contextIsolation: true },
    });
    await window.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(
          `<style>html,body{margin:0;width:1024px;height:1024px;overflow:hidden;background:transparent}svg{display:block}</style>${svg}`,
        ),
    );
    const capture = await window.webContents.capturePage();
    const master = nativeImage
      .createFromBuffer(capture.toPNG())
      .resize({ width: 1024, height: 1024 });
    const png = (size) =>
      master.resize({ width: size, height: size, quality: "best" }).toPNG();
    await writeFile(path.join(root, "icon.png"), png(1024));
    const icoSizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
    const images = icoSizes.map(png);
    const header = Buffer.alloc(6 + images.length * 16);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(images.length, 4);
    let offset = header.length;
    images.forEach((image, index) => {
      const entry = 6 + index * 16;
      header[entry] = header[entry + 1] = icoSizes[index] % 256;
      header.writeUInt16LE(1, entry + 4);
      header.writeUInt16LE(32, entry + 6);
      header.writeUInt32LE(image.length, entry + 8);
      header.writeUInt32LE(offset, entry + 12);
      offset += image.length;
    });
    await writeFile(
      path.join(root, "icon.ico"),
      Buffer.concat([header, ...images]),
    );
    const entries = [
      ["icp4", 16],
      ["icp5", 32],
      ["icp6", 64],
      ["ic07", 128],
      ["ic08", 256],
      ["ic09", 512],
      ["ic10", 1024],
    ];
    const chunks = entries.map(([type, size]) => {
      const image = png(size);
      const chunk = Buffer.alloc(8);
      chunk.write(type);
      chunk.writeUInt32BE(image.length + 8, 4);
      return Buffer.concat([chunk, image]);
    });
    const icns = Buffer.alloc(8);
    icns.write("icns");
    icns.writeUInt32BE(
      8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0),
      4,
    );
    await writeFile(
      path.join(root, "icon.icns"),
      Buffer.concat([icns, ...chunks]),
    );
    window.destroy();
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
