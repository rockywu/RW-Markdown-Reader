// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeMarkdown } from "../src/sanitize";

describe("untrusted document HTML", () => {
  it("removes scripts, active embeds, unsafe links and event handlers", () => {
    const html = sanitizeMarkdown(
      '<script>bad()</script><iframe src="https://evil.test"></iframe><img src="file:///etc/passwd" onerror="bad()"><a href="javascript:bad()">link</a><form><input value="secret"></form>',
      "markview-asset://test/",
    );
    expect(html).not.toMatch(
      /<script|<iframe|onerror|javascript:|file:\/\/|<form|<input/,
    );
  });
  it("loads local images through the scoped protocol and disallows srcset", () => {
    const html = sanitizeMarkdown(
      '<img src="assets/中文 图片.svg" srcset="file:///secret 2x"><details><summary>Details</summary>Body</details>',
      "markview-asset://test/",
    );
    expect(html).toContain("markview-asset://test/assets/");
    expect(html).not.toContain("srcset");
    expect(html).toContain("<details>");
  });
  it("keeps read-only task lists and prevents active form controls", () => {
    const html = sanitizeMarkdown(
      '<input type="checkbox" checked><input type="password"><button>Run</button>',
      "",
    );
    expect(html).toContain("disabled");
    expect(html).not.toContain("password");
    expect(html).not.toContain("<button");
  });
});
