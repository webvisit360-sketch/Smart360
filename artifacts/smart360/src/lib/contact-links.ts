export type InstagramLink = {
  href: string;
  label: string;
};

function instagramHandle(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const hostname = url.hostname.toLowerCase();
      if (hostname !== "instagram.com" && !hostname.endsWith(".instagram.com")) {
        return null;
      }
      const handle = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return handle && /^[a-z0-9._]+$/i.test(handle) ? handle : null;
    } catch {
      return null;
    }
  }

  const handle = trimmed.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
  return /^[a-z0-9._]+$/i.test(handle) ? handle : null;
}

export function instagramLink(value: unknown): InstagramLink | null {
  if (typeof value !== "string") return null;
  const handle = instagramHandle(value);
  if (!handle) return null;

  return {
    href: `https://www.instagram.com/${encodeURIComponent(handle)}/`,
    label: `@${handle}`,
  };
}

export function viberHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return `viber://chat?number=${encodeURIComponent(`+${digits}`)}`;
}