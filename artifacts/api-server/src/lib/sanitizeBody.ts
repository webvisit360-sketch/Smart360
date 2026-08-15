import sanitizeHtml from "sanitize-html";

/**
 * Server-side allowlist for guest-facing rich text (item body).
 * Spec (urejanje-vsebine.md): paragraphs, bold, line breaks and links only.
 * Everything else — Word paste garbage, styles, scripts — is stripped here,
 * regardless of what the client sends.
 */
export function sanitizeBody(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "b", "strong", "br", "a"],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    // Word/Google Docs paste: drop empty paragraphs made of &nbsp;
    textFilter: (text) => text.replace(/\u00a0/g, " "),
  }).trim();
}

/**
 * URL fields rendered as href on guest pages. Only http(s) is allowed —
 * anything else (javascript:, data:, vbscript:) would be a guest-side XSS.
 */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed === "") return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Bare domains ("www.example.com") are common admin input — prefix them.
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}([/?#].*)?$/i.test(trimmed))
    return `https://${trimmed}`;
  return "";
}

/** Plain-text fields: strip every tag, collapse nbsp. */
export function sanitizePlain(text: string): string {
  return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} })
    .replace(/\u00a0/g, " ")
    .trim();
}
