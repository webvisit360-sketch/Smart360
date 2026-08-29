export const VIRTUAL_TOUR_ALLOWED_PROVIDERS =
  "Dovoljeni so Kuula, Matterport, Momento360, Google Maps embed, YouTube embed in Vimeo.";

type ProviderRule = {
  host: string;
  pathPrefix?: string;
};

const PROVIDER_RULES: ProviderRule[] = [
  { host: "kuula.co" },
  { host: "matterport.com" },
  { host: "momento360.com" },
  { host: "google.com", pathPrefix: "/maps/embed" },
  { host: "youtube.com", pathPrefix: "/embed" },
  { host: "vimeo.com" },
];

export type VirtualTourParseResult = {
  url: string | null;
  error: string | null;
};

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function attributeValue(
  markup: string,
  attributePattern: string,
): string | null {
  const match = new RegExp(
    `\\b${attributePattern}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  ).exec(markup);
  return decodeHtmlAttribute(match?.[1] ?? match?.[2] ?? match?.[3] ?? "") || null;
}

function candidateFromInput(input: string): string | null {
  if (/^<\s*iframe\b/i.test(input)) {
    return attributeValue(input, "src");
  }
  if (/^<\s*script\b/i.test(input)) {
    for (const match of input.matchAll(
      /\bdata-[\w:-]+\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    )) {
      const value = decodeHtmlAttribute(
        match[1] ?? match[2] ?? match[3] ?? "",
      );
      if (/^https?:\/\//i.test(value)) return value;
    }
    return null;
  }
  if (input.includes("<") || input.includes(">")) return null;
  return input;
}

function hostMatches(hostname: string, allowedHost: string): boolean {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
}

function pathMatches(pathname: string, allowedPath: string): boolean {
  const normalizedPath = pathname.toLowerCase();
  const normalizedAllowed = allowedPath.toLowerCase();
  return (
    normalizedPath === normalizedAllowed ||
    normalizedPath.startsWith(`${normalizedAllowed}/`)
  );
}

function isAllowedProvider(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return PROVIDER_RULES.some(
    ({ host, pathPrefix }) =>
      hostMatches(hostname, host) &&
      (!pathPrefix || pathMatches(url.pathname, pathPrefix)),
  );
}

/**
 * Browser-side preview defense. The API repeats this validation and is the
 * authority for the canonical URL that is persisted.
 */
export function parseVirtualTourInput(input: string | null | undefined): VirtualTourParseResult {
  const trimmed = input?.trim() ?? "";
  if (!trimmed) return { url: null, error: null };

  const candidate = candidateFromInput(trimmed);
  if (!candidate) {
    return {
      url: null,
      error: `Prilepite iframe, script z data-* naslovom ali navaden HTTPS URL. ${VIRTUAL_TOUR_ALLOWED_PROVIDERS}`,
    };
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return {
      url: null,
      error: `Virtualni sprehod mora vsebovati veljaven HTTPS URL. ${VIRTUAL_TOUR_ALLOWED_PROVIDERS}`,
    };
  }

  if (url.protocol !== "https:") {
    return {
      url: null,
      error: `Virtualni sprehod mora uporabljati HTTPS. ${VIRTUAL_TOUR_ALLOWED_PROVIDERS}`,
    };
  }

  url.username = "";
  url.password = "";

  if (!isAllowedProvider(url)) {
    return {
      url: null,
      error: `Ponudnik virtualnega sprehoda ni dovoljen. ${VIRTUAL_TOUR_ALLOWED_PROVIDERS}`,
    };
  }

  return { url: url.toString(), error: null };
}

const KUULA_EMBED_PRESENTATION = {
  logo: "-1",
  info: "0",
  fs: "0",
  vr: "0",
  gyro: "0",
  thumbs: "-1",
  pause: "0",
} as const;

/**
 * Applies Smart360's Kuula presentation contract without mutating the URL
 * stored for the tenant. Unknown parameters and tour identity pass through.
 */
export function virtualTourEmbedUrl(
  input: string | null | undefined,
): string | null {
  const parsed = parseVirtualTourInput(input).url;
  if (!parsed) return null;

  const url = new URL(parsed);
  if (hostMatches(url.hostname.toLowerCase(), "kuula.co")) {
    for (const [key, value] of Object.entries(KUULA_EMBED_PRESENTATION)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}