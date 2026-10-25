/** WindowProxy can become cross-origin between setup and effect cleanup. Never
 * retain authority from an earlier origin check: guard the whole operation. */
export function withPreviewFrame<T>(
  frame: HTMLIFrameElement | null,
  origin: string,
  action: (win: Window & typeof globalThis, doc: Document) => T,
): T | undefined {
  try {
    const win = frame?.contentWindow;
    if (!win) return;
    const locationOrigin = win.location.origin;
    // srcdoc/about:blank inherit the parent's origin, although their URL's
    // origin is "null". Reading Window.origin still enforces same-origin.
    if (locationOrigin !== origin && !(win.location.protocol === "about:" && (win as Window & typeof globalThis).origin === origin)) return;
    const doc = frame?.contentDocument;
    if (!doc || doc !== win.document) return;
    return action(win as Window & typeof globalThis, doc);
  } catch {
    return;
  }
}

export function isExternalPreviewLink(href: string, base: string): boolean {
  try {
    const url = new URL(href, base);
    return !["javascript:", "data:", "blob:", "about:", "file:"].includes(url.protocol)
      && (url.origin !== new URL(base).origin || !["http:", "https:"].includes(url.protocol));
  } catch { return false; }
}
