import type { DiagramExport } from "./shared";
import { translate, type Locale } from "./i18n";

export function diagramSize(value: unknown, locale: Locale) {
  const diagram = value as DiagramExport | null;
  if (
    !diagram || typeof diagram.svg !== "string" ||
    Buffer.byteLength(diagram.svg) > 5 * 1024 * 1024 ||
    !diagram.svg.trimStart().startsWith("<svg") ||
    !Number.isFinite(diagram.width) || !Number.isFinite(diagram.height) ||
    diagram.width < 1 || diagram.height < 1 ||
    diagram.width > 1e7 || diagram.height > 1e7 ||
    typeof diagram.dark !== "boolean"
  ) throw new Error(translate(locale, "invalidDiagram"));

  // Render vectors at 3x (at least 2400 px on the long side), bounded for memory.
  const longest = Math.max(diagram.width, diagram.height);
  const scale = Math.min(
    Math.max(3, 2400 / longest),
    8192 / longest,
    Math.sqrt(16_000_000 / (diagram.width * diagram.height)),
  );
  return {
    width: Math.max(1, Math.floor(diagram.width * scale)),
    height: Math.max(1, Math.floor(diagram.height * scale)),
  };
}
