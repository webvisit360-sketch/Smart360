import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";

export type TranslationFailureCategory =
  | "quota" | "rate_limit" | "authentication" | "provider_unavailable"
  | "timeout" | "network" | "invalid_output" | "unknown";
export type TranslationFailureMetadata = {
  category: TranslationFailureCategory;
  httpStatus: number | null;
  code: string | null;
  attempt: number;
  delayMs?: number;
};
export class TranslationFailure extends Error {
  constructor(
    public readonly category: TranslationFailureCategory,
    public readonly httpStatus: number | null,
    public readonly code: string | null,
    public readonly retryAfterMs: number | null = null,
  ) {
    super(category === "invalid_output" ? "Prevoda ni bilo mogoče varno preveriti." : category);
    this.name = "TranslationFailure";
  }
}

const knownCodes = new Set([
  "insufficient_quota", "quota_exceeded", "billing_hard_limit_reached",
  "credits_exhausted", "out_of_credits", "insufficient_credits",
  "insufficient_funds", "billing_not_active", "replit_insufficient_credits",
  "rate_limit_exceeded", "rate_limit_error",
  "invalid_api_key", "authentication_error", "permission_denied",
  "service_unavailable", "server_error", "gateway_timeout",
  "etimedout", "econnreset", "econnrefused", "enotfound", "eai_again",
]);
const quotaCodes = new Set(["insufficient_quota", "quota_exceeded", "billing_hard_limit_reached",
  "credits_exhausted", "out_of_credits", "insufficient_credits",
  "insufficient_funds", "billing_not_active", "replit_insufficient_credits"]);
const networkCodes = new Set(["econnreset", "econnrefused", "enotfound", "eai_again"]);
const timeoutCodes = new Set(["etimedout", "gateway_timeout"]);
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
const statusOf = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 400 && value <= 599 ? value : null;

// Only known provider codes are retained. Never copy provider text, body or arbitrary headers.
export function normalizeTranslationFailure(error: unknown, now = Date.now()): TranslationFailure {
  if (error instanceof TranslationFailure) return error;
  const value = record(error);
  const nested = record(value.error);
  const status = statusOf(value.status) ?? statusOf(value.statusCode) ?? statusOf(value.httpStatus);
  const candidate = [value.code, nested.code, value.type, nested.type]
    .find((entry) => typeof entry === "string" && knownCodes.has(entry));
  const code = typeof candidate === "string" ? candidate : null;
  // Proxy credit failures can have only a textual reason, even with HTTP 429.
  // Inspect locally, never persist or emit provider-supplied text.
  const providerText = [value.message, nested.message].filter((part): part is string => typeof part === "string");
  const creditsExhausted = providerText.some((text) =>
    /\b(?:insufficient|out of|not enough|exhausted|depleted)\s+(?:\w+\s+){0,2}(?:credits?|quota|balance)\b/i.test(text) ||
    /\b(?:credits?|quota)\s+(?:has been |is |are )?(?:exhausted|depleted|exceeded)\b/i.test(text));
  const headers = value.headers;
  let retryAfter: unknown;
  if (headers && typeof headers === "object" && "get" in headers && typeof headers.get === "function") {
    try { retryAfter = headers.get("retry-after"); } catch { /* Ignore malformed headers. */ }
  } else {
    retryAfter = record(headers)["retry-after"];
  }
  let retryAfterMs: number | null = null;
  if (typeof retryAfter === "string") {
    const trimmed = retryAfter.trim();
    const seconds = /^\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : NaN;
    const date = Number.isNaN(seconds) ? Date.parse(trimmed) : NaN;
    const duration = Number.isFinite(seconds) ? seconds * 1000 : date - now;
    if (Number.isFinite(duration) && duration >= 0) {
      // Retain only the fact that a long provider hold exceeds our wait budget.
      retryAfterMs = Math.min(8_001, Math.ceil(duration));
    } else if (/^\d+(?:\.\d+)?$/.test(trimmed) && seconds > 0) {
      retryAfterMs = 8_001;
    }
  }
  const name = value.name;
  const category: TranslationFailureCategory =
    status === 402 || creditsExhausted || (code && quotaCodes.has(code)) ? "quota" :
    status === 401 || status === 403 || code === "invalid_api_key" ||
      code === "authentication_error" || code === "permission_denied" ? "authentication" :
    status === 429 || code === "rate_limit_exceeded" || code === "rate_limit_error" ? "rate_limit" :
    status !== null && status >= 500 ? "provider_unavailable" :
    (code && timeoutCodes.has(code)) || name === "APIConnectionTimeoutError" ||
      name === "TimeoutError" || name === "AbortError" ? "timeout" :
    (code && networkCodes.has(code)) || name === "APIConnectionError" ? "network" : "unknown";
  return new TranslationFailure(category, status, code, retryAfterMs);
}

export function translationFailureMessage(error: unknown): string {
  const failure = normalizeTranslationFailure(error);
  switch (failure.category) {
    case "quota": return "Prevod ni na voljo: ponudniku je zmanjkalo dobroimetja ali kvote. Preverite obračunavanje.";
    case "authentication": return "Prevod ni na voljo: ponudnik je zavrnil dostop. Preverite nastavitve povezave.";
    case "rate_limit": return failure.retryAfterMs !== null && failure.retryAfterMs > 4_000
      ? "Preveč zahtev za prevajanje. Počakajte do izteka omejitve ponudnika in poskusite znova."
      : "Preveč zahtev za prevajanje. Počakajte in poskusite znova.";
    case "provider_unavailable": return "Ponudnik prevajanja trenutno ni dosegljiv. Poskusite znova pozneje.";
    case "timeout": return "Čas za prevajanje je potekel. Poskusite znova pozneje.";
    case "network": return "Povezava s ponudnikom prevajanja ni uspela. Poskusite znova pozneje.";
    case "invalid_output": return "Prevoda ni bilo mogoče varno preveriti. Preverite ga in poskusite znova.";
    default: return "Vzrok napake pri prevajanju ni znan. Poskusite znova ali obvestite podporo.";
  }
}

export type TranslationRetryOptions = {
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  log?: (event: "failed_attempt" | "retry" | "exhausted", metadata: TranslationFailureMetadata) => void;
};
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export async function withTranslationRetries<T>(
  operation: () => Promise<T>,
  options: TranslationRetryOptions = {},
): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;
  const started = now();
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const failure = normalizeTranslationFailure(error, now());
      const metadata: TranslationFailureMetadata = {
        category: failure.category, httpStatus: failure.httpStatus, code: failure.code, attempt,
      };
      const log = options.log ?? ((event: string, fields: TranslationFailureMetadata) =>
        logger.warn(fields, `Editorial translation ${event}`));
      log("failed_attempt", metadata);
      // Only a genuine rate limit is safe to retry automatically. Other failures
      // may represent billable ambiguous requests or durable provider outages.
      const retryable = failure.category === "rate_limit";
      const jitter = Math.min(1, Math.max(0, random()));
      const delayMs = Math.max(Math.round(500 * 2 ** (attempt - 1) * (0.75 + jitter * 0.5)),
        failure.retryAfterMs ?? 0);
      if (!retryable || attempt === 3 || delayMs > 4_000 || now() - started + delayMs > 8_000) {
        log("exhausted", metadata);
        throw failure;
      }
      log("retry", { ...metadata, delayMs });
      await sleep(delayMs);
    }
  }
  throw new TranslationFailure("unknown", null, null);
}

export const EDITORIAL_LANGUAGES = ["sl", "en", "de", "it"] as const;
export type EditorialLanguage = typeof EDITORIAL_LANGUAGES[number];
export type EditorialDraft = {
  language: EditorialLanguage;
  title: string;
  description: string;
};
export type EditorialSuggestion = {
  language: EditorialLanguage;
  title: string | null;
  description: string | null;
};

export function hasMeaningfulEditorialText(value: string): boolean {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim().length > 0;
}

function sourceFor(
  drafts: EditorialDraft[],
  field: "title" | "description",
  sourceLanguage?: EditorialLanguage,
): { language: EditorialLanguage; text: string } | null {
  if (sourceLanguage) {
    const text = drafts.find((draft) => draft.language === sourceLanguage)?.[field]?.trim();
    return text && hasMeaningfulEditorialText(text) ? { language: sourceLanguage, text } : null;
  }
  for (const language of EDITORIAL_LANGUAGES) {
    const text = drafts.find((draft) => draft.language === language)?.[field]?.trim();
    if (text && hasMeaningfulEditorialText(text)) return { language, text };
  }
  return null;
}

export async function translateMissingEditorial(
  drafts: EditorialDraft[],
  client = openai,
  sourceLanguage?: EditorialLanguage,
  retryOptions?: TranslationRetryOptions,
): Promise<EditorialSuggestion[]> {
  if (drafts.length !== 4 ||
    new Set(drafts.map((draft) => draft.language)).size !== 4 ||
    !EDITORIAL_LANGUAGES.every((language) => drafts.some((draft) => draft.language === language))) {
    throw new Error("Urejevalnik nima vseh štirih jezikov.");
  }

  const tasks = (["title", "description"] as const).flatMap((field) => {
    const source = sourceFor(drafts, field, sourceLanguage);
    if (!source) return [];
    const targetLanguages = EDITORIAL_LANGUAGES.filter((language) =>
      !hasMeaningfulEditorialText(
        drafts.find((draft) => draft.language === language)?.[field] ?? "",
      ));
    return targetLanguages.length ? [{ field, ...source, targetLanguages }] : [];
  });
  if (tasks.length === 0) return [];

  const expected = new Map<EditorialLanguage, Set<"title" | "description">>();
  for (const task of tasks) {
    for (const language of task.targetLanguages) {
      const fields = expected.get(language) ?? new Set<"title" | "description">();
      fields.add(task.field);
      expected.set(language, fields);
    }
  }

  const response = await withTranslationRetries(() => client.chat.completions.create({
    model: "gpt-5.6-terra",
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [{
      role: "system",
      content: "Translate only the supplied operator-authored text into exactly the requested target languages. Preserve meaning and allowed HTML formatting. Do not add facts, claims, names, addresses, explanations, or content. A field not requested for a language must be null. Return JSON only: {\"translations\":[{\"language\":\"sl|en|de|it\",\"title\":string|null,\"description\":string|null}]}."
    }, {
      role: "user",
      content: JSON.stringify({ tasks }),
    }],
  }, { maxRetries: 0 }), retryOptions);
  let translations: EditorialSuggestion[];
  try {
    const content = response.choices[0]?.message?.content ?? "";
    const parsed: unknown = JSON.parse(content);
    const result = record(parsed).translations;
    if (!Array.isArray(result) || result.some((item) =>
      typeof item !== "object" || item === null ||
      typeof item.language !== "string" ||
      !("title" in item) || !("description" in item))) throw new Error();
    translations = result as EditorialSuggestion[];
  } catch {
    throw new TranslationFailure("invalid_output", null, null);
  }

  if (translations.length !== expected.size ||
    new Set(translations.map((item) => item.language)).size !== expected.size ||
    translations.some((item) => !EDITORIAL_LANGUAGES.includes(item.language))) {
    throw new TranslationFailure("invalid_output", null, null);
  }
  for (const [language, fields] of expected) {
    const translated = translations.find((item) => item.language === language);
    if (!translated) throw new TranslationFailure("invalid_output", null, null);
    for (const field of ["title", "description"] as const) {
      const value = translated[field];
      if (fields.has(field)) {
        if (typeof value !== "string" || !hasMeaningfulEditorialText(value)) {
          throw new TranslationFailure("invalid_output", null, null);
        }
      } else if (value != null) {
        throw new TranslationFailure("invalid_output", null, null);
      }
    }
  }
  return translations;
}

export async function translateCreatorEditorial(
  source: { name: string; description: string },
  client = openai,
  retryOptions?: TranslationRetryOptions,
): Promise<Array<{ language: "en" | "de" | "it"; name: string; description: string }>> {
  const translations = await translateMissingEditorial([
    { language: "sl", title: source.name, description: source.description },
    { language: "en", title: "", description: "" },
    { language: "de", title: "", description: "" },
    { language: "it", title: "", description: "" },
  ], client, undefined, retryOptions);
  return translations.map((translation) => ({
    language: translation.language as "en" | "de" | "it",
    name: translation.title!,
    description: translation.description!,
  }));
}