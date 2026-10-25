import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(html);
}

/** Rule cards carry inline editor markup only; never nested content/media. */
export function ruleInlineHtml(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ["a", "strong", "b", "em", "i", "u", "s", "strike", "br"],
    ALLOWED_ATTR: ["href", "target", "rel", "title"],
    FORBID_CONTENTS: ["ul", "ol", "script", "style"],
  });
}

export function ruleInlineText(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = ruleInlineHtml(html).replace(/<br\s*\/?>/gi, " ");
  return container.textContent ?? "";
}
