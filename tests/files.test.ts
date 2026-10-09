import { describe, expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readDocument, resolveWithin, saveDocument } from "../electron/files";

describe("local file boundary", () => {
  it("opens Unicode paths and rejects non-Markdown and non-UTF-8 files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "markview-"));
    try {
      const file = path.join(root, "中文 空格.MD");
      await writeFile(file, "# 中文");
      expect((await readDocument(file)).content).toBe("# 中文");
      await expect(readDocument(path.join(root, "secret.txt"))).rejects.toThrow(
        "Select a",
      );
      await writeFile(file, Buffer.from([0xff, 0xfe, 0xfd]));
      await expect(readDocument(file)).rejects.toThrow("UTF-8");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("rejects directory traversal and symlinks escaping the document folder", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "markview-"));
    try {
      const folder = path.join(root, "docs");
      await mkdir(folder);
      await writeFile(path.join(root, "secret.md"), "secret");
      await writeFile(path.join(folder, "safe.md"), "safe");
      expect(await resolveWithin(folder, "safe.md")).toBe(
        await resolveWithin(folder, "./safe.md"),
      );
      await expect(resolveWithin(folder, "../secret.md")).rejects.toThrow(
        "outside",
      );
      await expect(
        resolveWithin(folder, "../does-not-exist.md"),
      ).rejects.toThrow("outside");
      if (process.platform !== "win32") {
        await symlink(
          path.join(root, "secret.md"),
          path.join(folder, "link.md"),
        );
        await expect(resolveWithin(folder, "link.md")).rejects.toThrow(
          "outside",
        );
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("safe document saves", () => {
  it("preserves BOM and CRLF while editing normalized content", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "markview-save-"));
    try {
      const file = path.join(root, "中文.md");
      await writeFile(file, "\uFEFF# 标题\r\n原文\r\n");
      const doc = await readDocument(file);
      expect(doc.content).toBe("# 标题\n原文\n");
      const saved = await saveDocument(
        file,
        "# 修改\n正文\n",
        doc.version,
        doc,
      );
      expect(await readFile(file, "utf8")).toBe("\uFEFF# 修改\r\n正文\r\n");
      expect(saved.content).toBe("# 修改\n正文\n");
      expect(await readdir(root)).toEqual(["中文.md"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("refuses an external overwrite or deletion without losing the other version", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "markview-save-"));
    try {
      const file = path.join(root, "note.md");
      await writeFile(file, "# Original");
      const doc = await readDocument(file);
      await writeFile(file, "# External");
      await expect(
        saveDocument(file, "# My draft", doc.version, doc),
      ).rejects.toThrow("changed");
      expect(await readFile(file, "utf8")).toBe("# External");
      await rm(file);
      await expect(
        saveDocument(file, "# My draft", doc.version, doc),
      ).rejects.toThrow("deleted");
      expect(await readdir(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("creates a new document but refuses to silently replace an existing one", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "markview-save-"));
    try {
      const file = path.join(root, "new.md");
      const format = { lineEnding: "\n" as const, bom: false };
      await saveDocument(file, "# New", null, format);
      await expect(
        saveDocument(file, "# overwrite", null, format),
      ).rejects.toThrow("not overwritten");
      expect(await readFile(file, "utf8")).toBe("# New");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
