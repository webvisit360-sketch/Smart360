/** Display-only normalization. Single authored blank paragraphs remain untouched. */
export function collapseEmptyParagraphs(html: string): string {
  const blank = String.raw`<p\b[^>]*>(?:\s|&nbsp;|&#160;|&#x0*a0;|<br\s*\/?>)*<\/p>`;
  return html.replace(new RegExp(`(${blank})(?:\\s*${blank})+`, "gi"), "$1")
    .replace(/(<br\s*\/?>)(\s*<br\s*\/?>)(?:\s*<br\s*\/?>)+/gi, "$1$2")
    .replace(/(<\/p>)(\s*<br\s*\/?>)(?:\s*<br\s*\/?>)+/gi, "$1$2");
}
