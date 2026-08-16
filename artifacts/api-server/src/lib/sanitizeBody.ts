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

/**
 * Plain-text fields: strip every tag, collapse nbsp, and DECODE entities.
 * Ta polja se izrisujejo kot navadno besedilo (React jih sam ubeži) — če bi
 * v bazi ostal "&amp;", bi gost videl dobesedno "&amp;" namesto "&".
 */
export function sanitizePlain(text: string): string {
  // Do fiksne točke: dekodiranje lahko razkrije nove oznake/entitete
  // ("&amp;lt;b&amp;gt;" → "&lt;b&gt;" → "<b>" → ""), zato ponavljamo, dokler
  // se izhod ne ustali — šele to zagotavlja sanitizePlain(sanitizePlain(x))
  // === sanitizePlain(x) za vsak vhod.
  let cur = text;
  for (let i = 0; i < 5; i++) {
    const next = decodeEntities(
      sanitizeHtml(cur, { allowedTags: [], allowedAttributes: {} }),
    )
      .replace(/\u00a0/g, " ")
      .trim();
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, ent: string) => {
    if (ent[0] === "#") {
      const code =
        ent[1] === "x" || ent[1] === "X"
          ? parseInt(ent.slice(2), 16)
          : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[ent] ?? m;
  });
}
