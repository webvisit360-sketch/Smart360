const ALLOWED_PROVIDER_DESCRIPTION =
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

export class VirtualTourUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VirtualTourUrlError";
  }
}

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

function extractCandidate(input: string): string {
  if (/^<\s*iframe\b/i.test(input)) {
    const src = attributeValue(input, "src");
    if (src) return src;
    throw new VirtualTourUrlError(
      `V iframe kodi manjka naslov src. ${ALLOWED_PROVIDER_DESCRIPTION}`,
    );
  }

  if (/^<\s*script\b/i.test(input)) {
    const dataAttributes = input.matchAll(
      /\bdata-[\w:-]+\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    );
    for (const match of dataAttributes) {
      const value = decodeHtmlAttribute(
        match[1] ?? match[2] ?? match[3] ?? "",
      );
      if (/^https?:\/\//i.test(value)) return value;
    }
    throw new VirtualTourUrlError(
      `V script kodi ni podatkovnega atributa z naslovom ogleda. ${ALLOWED_PROVIDER_DESCRIPTION}`,
    );
  }

  if (input.includes("<") || input.includes(">")) {
    throw new VirtualTourUrlError(
      `Prilepite iframe, script z data-* naslovom ali navaden HTTPS URL. ${ALLOWED_PROVIDER_DESCRIPTION}`,
    );
  }

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
 * Accepts a plain URL or provider embed snippet and returns only a canonical,
 * allowlisted URL. Pasted third-party markup is never persisted.
 */
export function extractVirtualTourUrl(input: string | null): string | null {
  const trimmed = input?.trim() ?? "";
  if (!trimmed) return null;

  const candidate = extractCandidate(trimmed);
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new VirtualTourUrlError(
      `Virtualni sprehod mora vsebovati veljaven HTTPS URL. ${ALLOWED_PROVIDER_DESCRIPTION}`,
    );
  }

  if (url.protocol !== "https:") {
    throw new VirtualTourUrlError(
      `Virtualni sprehod mora uporabljati HTTPS. ${ALLOWED_PROVIDER_DESCRIPTION}`,
    );
  }

  url.username = "";
  url.password = "";

  if (!isAllowedProvider(url)) {
    throw new VirtualTourUrlError(
      `Ponudnik virtualnega sprehoda ni dovoljen. ${ALLOWED_PROVIDER_DESCRIPTION}`,
    );
  }

  return url.toString();
}

export { ALLOWED_PROVIDER_DESCRIPTION };