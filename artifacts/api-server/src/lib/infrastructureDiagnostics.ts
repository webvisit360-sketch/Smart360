import { randomUUID } from "node:crypto";

const SQLSTATE_RE = /^[0-9A-Z]{5}$/;
const generatedRequestIds = new WeakMap<object, string>();

export type SafeDatabaseErrorDiagnostic = {
  errorClass: "database" | "unknown";
  databaseCode?: string;
  databaseClass?: string;
};

/**
 * Extracts only PostgreSQL's non-content SQLSTATE identifiers. In particular,
 * this must never return an Error message, query, parameters, stack, or cause.
 */
export function safeDatabaseErrorDiagnostic(error: unknown): SafeDatabaseErrorDiagnostic {
  let current: unknown = error;
  const seen = new Set<object>();

  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    if (seen.has(current)) break;
    seen.add(current);
    const record = current as Record<string, unknown>;
    if (typeof record.code === "string" && SQLSTATE_RE.test(record.code)) {
      return {
        errorClass: "database",
        databaseCode: record.code,
        databaseClass: record.code.slice(0, 2),
      };
    }
    current = record.cause;
  }

  return { errorClass: "unknown" };
}

/**
 * Preserve a non-empty request ID supplied by HTTP middleware, or allocate one
 * once for lightweight harnesses and other callers without that middleware.
 */
export function safeRequestId(request: object & { id?: unknown }): string {
  if (typeof request.id === "string" && request.id.trim()) return request.id;
  if (typeof request.id === "number" && Number.isFinite(request.id)) return String(request.id);
  const existing = generatedRequestIds.get(request);
  if (existing) return existing;
  const generated = randomUUID();
  generatedRequestIds.set(request, generated);
  return generated;
}