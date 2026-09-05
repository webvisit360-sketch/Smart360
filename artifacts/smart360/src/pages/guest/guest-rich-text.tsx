import { sanitizeHtml } from "@/lib/sanitize";

function richParts(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          (part) =>
            part != null &&
            String(part).trim() !== "" &&
            !["null", "undefined", "NaN", "[null]"].includes(String(part).trim()),
        )
        .map((part) => sanitizeHtml(String(part)));
    }
  } catch {
    // Stored rich HTML continues through the sanitizer below.
  }
  return [sanitizeHtml(value)];
}

export function GuestRichInline({ value }: { value: unknown }) {
  const parts = richParts(value);
  if (parts.length === 0) return null;
  return (
    <>
      {parts.map((html, index) => (
        <span
          key={index}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ))}
    </>
  );
}

export function GuestRichBody({ value }: { value: unknown }) {
  const parts = richParts(value);
  if (parts.length === 0) return null;
  return (
    <>
      {parts.map((html, index) => (
        <p
          key={index}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ))}
    </>
  );
}