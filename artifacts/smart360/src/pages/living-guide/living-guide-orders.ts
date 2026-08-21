export const GUEST_STORAGE_PREFIX = "smart360:living-guide:guest:";
const ORDER_PASSWORD_STORAGE_PREFIX = "smart360:living-guide:order-password:";

export function getRememberedOrderPassword(slug: string): string {
  try {
    return localStorage.getItem(`${ORDER_PASSWORD_STORAGE_PREFIX}${slug}`) ?? "";
  } catch {
    return "";
  }
}

export function rememberOrderPassword(slug: string, password: string): void {
  const trimmed = password.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(`${ORDER_PASSWORD_STORAGE_PREFIX}${slug}`, trimmed);
  } catch {
    // Ignore quota errors / private mode. The order itself still succeeded.
  }
}

export function getDeviceToken(slug: string): string {
  const key = `${GUEST_STORAGE_PREFIX}${slug}:token`;
  let token = localStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
    try {
      localStorage.setItem(key, token);
    } catch {
      // ignore quota errors / private mode
    }
  }
  return token;
}

export function getOrderRefs(slug: string): string[] {
  const key = `${GUEST_STORAGE_PREFIX}${slug}:orders`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addOrderRef(slug: string, orderRef: string): void {
  const key = `${GUEST_STORAGE_PREFIX}${slug}:orders`;
  const refs = getOrderRefs(slug);
  if (!refs.includes(orderRef)) {
    refs.unshift(orderRef);
    try {
      localStorage.setItem(key, JSON.stringify(refs.slice(0, 50))); // Keep last 50
    } catch {
      // ignore
    }
  }
}

export function getIdempotencyKey(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
}


function stripMarkup(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const FULFILLMENT_WORDS = [
  /\bprevzem/i,
  /\bdostav/i,
  /\bprinese/i,
  /\bpri\s+gostitelj/i,
  /\bpick[\s-]?up\b/i,
  /\bdelivery\b/i,
  /\bdeliver\b/i,
  /\bcollect/i,
  /\britiro\b/i,
  /\bconsegna\b/i,
  /\bspedizione\b/i,
  /\babholun/i,
  /\babholen\b/i,
  /\blieferun/i,
  /\bliefern\b/i,
  /\bzustellun/i,
] as const;

export function extractFulfillmentText(item: any, t: (key: string) => string): string {
  if (!item) return t("UI.lg.order.pickupDefault");

  const texts = [
    typeof item.body === "string" ? item.body : "",
    typeof item.noteText === "string" ? item.noteText : "",
    ...(Array.isArray(item.bullets) ? item.bullets.filter((value: unknown): value is string => typeof value === "string") : []),
  ];

  for (const text of texts) {
    const sentences = stripMarkup(text).split(/(?<=[.!?;])\s+|\n+/);
    for (const sentence of sentences) {
      const candidate = sentence.trim();
      if (candidate && FULFILLMENT_WORDS.some((pattern) => pattern.test(candidate))) {
        return /[.!?;]$/.test(candidate) ? candidate : `${candidate}.`;
      }
    }
  }

  return t("UI.lg.order.pickupDefault");
}
