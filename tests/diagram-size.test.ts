import { describe, expect, it } from "vitest";
import { diagramSize } from "../electron/diagram-size";

const diagram = { svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', width: 1000, height: 600, dark: false };

describe("high resolution diagram export", () => {
  it("uses vector dimensions, with 3x resolution and a useful minimum for small graphs", () => {
    expect(diagramSize(diagram, "en")).toEqual({ width: 3000, height: 1800 });
    expect(diagramSize({ ...diagram, width: 100, height: 200 }, "en"))
      .toEqual({ width: 1200, height: 2400 });
  });
  it.each([[10000, 10000], [1e7, 1], [2000, 10000]])("bounds memory and preserves the full aspect ratio for %s x %s", (width, height) => {
    const result = diagramSize({ ...diagram, width, height }, "en");
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(8192);
    expect(result.width * result.height).toBeLessThanOrEqual(16_000_000);
    expect(Math.min(result.width, result.height)).toBeGreaterThanOrEqual(1);
    expect(Math.abs(result.width - result.height * width / height)).toBeLessThanOrEqual(Math.max(1, width / height));
  });
  it.each([
    null, {}, "svg", { ...diagram, width: NaN }, { ...diagram, height: Infinity },
    { ...diagram, width: -1 }, { ...diagram, width: "1000" },
    { ...diagram, dark: "false" }, { ...diagram, svg: "<html/>" },
    { ...diagram, svg: "<svg>" + "中".repeat(2 * 1024 * 1024) },
  ])("rejects invalid or oversized IPC input", (value) => {
    expect(() => diagramSize(value, "en")).toThrow("invalid or too large");
  });
});
