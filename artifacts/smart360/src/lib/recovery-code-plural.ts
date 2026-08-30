import { formatSlovenianCount } from "./slovenian-plural";

const recoveryCodeForms = {
  one: "obnovitvena koda",
  two: "obnovitveni kodi",
  few: "obnovitvene kode",
  other: "obnovitvenih kod",
} as const;

export function recoveryCodeCountSl(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 0) return "Ni več obnovitvenih kod.";
  if (n === 1) return `Na voljo je še ${formatSlovenianCount(n, recoveryCodeForms)}.`;
  if (n === 2) return `Na voljo sta še ${formatSlovenianCount(n, recoveryCodeForms)}.`;
  if (n === 3 || n === 4) return `Na voljo so še ${formatSlovenianCount(n, recoveryCodeForms)}.`;
  return `Na voljo je še ${formatSlovenianCount(n, recoveryCodeForms)}.`;
}