import sanitizeHtml from "sanitize-html";

/**
 * Server-side allowlist for guest-facing rich text (item body, tip text).
 * Spec (admin-urejevalnik-besedila.md): p, br, strong, em, ul, ol, li,
 * a[href,target,rel], h4. Legacy tags are mapped (b→strong, i→em,
 * h1–h3→h4) instead of dropped. Everything else — Word paste garbage,
 * styles, scripts — is stripped here, regardless of what the client sends.
 */
export function sanitizeBody(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "a", "h4"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      b: "strong",
      i: "em",
      h1: "h4",
      h2: "h4",
      h3: "h4",
      h5: "h4",
      h6: "h4",
      // target="_blank" without noopener leaks window.opener to the target
      a: (tagName, attribs) => ({
        tagName,
        attribs:
          attribs.target === "_blank"
            ? { ...attribs, rel: "noopener noreferrer" }
            : attribs,
      }),
    },
    // Word/Google Docs paste: collapse &nbsp; runs into ordinary spaces
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
