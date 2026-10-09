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

import { translate, type Locale } from "./i18n";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const isMarkdown = (file: string) => /\.(md|markdown)$/i.test(file);
const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

export async function readDocument(file: string, locale: Locale = "en") {
  if (!isMarkdown(file)) throw new Error(translate(locale, "chooseMarkdown"));
  const canonical = await realpath(file);
  const info = await stat(canonical);
  if (!info.isFile()) throw new Error(translate(locale, "notFile"));
  if (info.size > MAX_DOCUMENT_BYTES)
    throw new Error(translate(locale, "largeDocument"));
  const bytes = await readFile(canonical);
  if (bytes.length > MAX_DOCUMENT_BYTES)
    throw new Error(translate(locale, "largeDocument"));
  let content: string;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(translate(locale, "invalidEncoding"));
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
  locale: Locale = "en",
) {
  if (!isMarkdown(file))
    throw new Error(translate(locale, "markdownExtension"));
  const bytes = Buffer.from(
    (format.bom ? "\uFEFF" : "") +
      content.replace(/\r\n/g, "\n").replace(/\n/g, format.lineEnding),
  );
  if (bytes.length > MAX_DOCUMENT_BYTES)
    throw new Error(translate(locale, "largeSave"));
  const checkVersion = async () => {
    if ((await diskVersion(file)) !== expectedVersion)
      throw new Error(translate(locale, "saveConflict"));
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
  return readDocument(file, locale);
}

export async function resolveWithin(
  directory: string,
  relative: string,
  locale: Locale = "en",
) {
  const root = await realpath(directory);
  const resolved = path.resolve(root, relative);
  assertWithin(root, resolved, locale);
  const candidate = await realpath(resolved);
  assertWithin(root, candidate, locale);
  return candidate;
}

function assertWithin(root: string, candidate: string, locale: Locale) {
  const relation = path.relative(root, candidate);
  if (
    relation === ".." ||
    relation.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relation)
  ) {
    throw new Error(translate(locale, "outsideDirectory"));
  }
}
