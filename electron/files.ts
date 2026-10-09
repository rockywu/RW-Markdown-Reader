import {
  readFile,
  realpath,
  stat,
  open,
  rename,
  unlink,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const isMarkdown = (file: string) => /\.(md|markdown)$/i.test(file);
const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

export async function readDocument(file: string) {
  if (!isMarkdown(file)) throw new Error("请选择 .md 或 .markdown 文档。");
  const canonical = await realpath(file);
  const info = await stat(canonical);
  if (!info.isFile()) throw new Error("所选路径不是文件。");
  if (info.size > MAX_DOCUMENT_BYTES)
    throw new Error("文档超过 10 MB，请先拆分后再打开。");
  const bytes = await readFile(canonical);
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new Error("文档超过 10 MB。");
  let content: string;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("文档不是 UTF-8 编码，请先转换为 UTF-8。");
  }
  return {
    path: canonical,
    name: path.basename(canonical),
    content: content.replace(/\r\n/g, "\n"),
    modifiedAt: info.mtimeMs,
    version: digest(bytes),
    lineEnding: (content.includes("\r\n") ? "\r\n" : "\n") as "\n" | "\r\n",
    bom: bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
  };
}

export async function diskVersion(file: string): Promise<string | null> {
  try {
    return digest(await readFile(file));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function saveDocument(
  file: string,
  content: string,
  expectedVersion: string | null,
  format: { lineEnding: "\n" | "\r\n"; bom: boolean },
) {
  if (!isMarkdown(file))
    throw new Error("请使用 .md 或 .markdown 文件扩展名。");
  const bytes = Buffer.from(
    (format.bom ? "\uFEFF" : "") +
      content.replace(/\r\n/g, "\n").replace(/\n/g, format.lineEnding),
  );
  if (bytes.length > MAX_DOCUMENT_BYTES)
    throw new Error("文档超过 10 MB，未保存。");
  const checkVersion = async () => {
    if ((await diskVersion(file)) !== expectedVersion)
      throw new Error(
        "文件已在外部修改或删除，未覆盖。请另存为，或重新加载磁盘版本。",
      );
  };
  await checkVersion();
  const mode = expectedVersion === null ? 0o600 : (await stat(file)).mode;
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${randomUUID()}.tmp`,
  );
  try {
    const handle = await open(temporary, "wx", mode);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await checkVersion();
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  return readDocument(file);
}

export async function resolveWithin(directory: string, relative: string) {
  const root = await realpath(directory);
  const resolved = path.resolve(root, relative);
  assertWithin(root, resolved);
  const candidate = await realpath(resolved);
  assertWithin(root, candidate);
  return candidate;
}

function assertWithin(root: string, candidate: string) {
  const relation = path.relative(root, candidate);
  if (
    relation === ".." ||
    relation.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relation)
  ) {
    throw new Error("此链接超出当前文档目录，请使用“打开文档”选择该文件。");
  }
}
