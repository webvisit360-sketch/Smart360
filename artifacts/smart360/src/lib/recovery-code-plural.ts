/** Slovenian recovery-code count sentence with the language's dual form. */
export function recoveryCodeCountSl(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 0) return "Ni več obnovitvenih kod.";
  if (n === 1) return "Na voljo je še 1 obnovitvena koda.";
  if (n === 2) return "Na voljo sta še 2 obnovitveni kodi.";
  if (n === 3 || n === 4) return `Na voljo so še ${n} obnovitvene kode.`;
  return `Na voljo je še ${n} obnovitvenih kod.`;
}