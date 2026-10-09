import DOMPurify from "dompurify";

export function sanitizeMarkdown(html: string, assetBase: string) {
  const fragment = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: [
      "style",
      "form",
      "textarea",
      "select",
      "video",
      "audio",
      "iframe",
      "object",
      "embed",
    ],
    FORBID_ATTR: [
      "style",
      "srcset",
      "autofocus",
      "formaction",
      "contenteditable",
    ],
  });
  for (const image of fragment.querySelectorAll("img")) {
    const src = image.getAttribute("src") ?? "";
    if (
      /^https:\/\//i.test(src) ||
      /^data:image\/(png|jpeg|gif|webp);base64,/i.test(src)
    )
      image.src = src;
    else if (
      assetBase &&
      src &&
      !/^[a-z][a-z\d+.-]*:/i.test(src) &&
      !src.startsWith("//") &&
      !src.startsWith("\\")
    ) {
      image.src = new URL(src, assetBase).href;
    } else image.removeAttribute("src");
    image.setAttribute("referrerpolicy", "no-referrer");
    image.setAttribute("loading", "lazy");
  }
  for (const input of fragment.querySelectorAll("input")) {
    if (input.type !== "checkbox") input.remove();
    else input.disabled = true;
  }
  for (const button of fragment.querySelectorAll("button")) {
    if (!button.classList.contains("diagram-expand")) button.remove();
  }
  const wrapper = document.createElement("div");
  wrapper.append(fragment);
  return wrapper.innerHTML;
}
