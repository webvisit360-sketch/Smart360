import type { FetchFn } from "./distanceEngine";

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryAfterMilliseconds(response: Response): number | null {
  const value = response.headers.get("retry-after")?.trim();
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.min(Math.max(0, date - Date.now()), 60_000) : null;
}

export type PacedNominatimFetch = {
  fetchFn: FetchFn;
  isStopped: () => boolean;
  stopReason: () => string | null;
  stop: (reason: string) => void;
};

/** One process-wide sequential Nominatim caller for one-off Creator runs.
 * Every HTTP attempt is at least one second after the previous one. A 429,
 * timeout, network failure, or 5xx response gets bounded exponential backoff;
 * exhaustion opens the stop circuit so callers preserve all remaining rows. */
export function createPacedNominatimFetch(options: {
  fetchFn?: FetchFn;
  timeoutMs?: number;
  maxAttempts?: number;
  minimumIntervalMs?: number;
  sleepFn?: (milliseconds: number) => Promise<void>;
} = {}): PacedNominatimFetch {
  const underlyingFetch = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxAttempts = options.maxAttempts ?? 3;
  const minimumIntervalMs = options.minimumIntervalMs ?? 1_000;
  const wait = options.sleepFn ?? sleep;
  let lastAttemptAt = 0;
  let stoppedReason: string | null = null;

  const stop = (reason: string) => {
    stoppedReason ??= reason;
  };

  const fetchFn: FetchFn = async (input, init) => {
    if (stoppedReason) throw new Error(stoppedReason);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const paceDelay = minimumIntervalMs - (Date.now() - lastAttemptAt);
      if (paceDelay > 0) await wait(paceDelay);
      lastAttemptAt = Date.now();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const signal = init?.signal
        ? AbortSignal.any([init.signal, controller.signal])
        : controller.signal;
      try {
        const response = await underlyingFetch(input, { ...init, signal });
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable) return response;
        if (attempt === maxAttempts) {
          stop(`Nominatim remained unavailable after ${maxAttempts} attempts (HTTP ${response.status}).`);
          return response;
        }
        await response.body?.cancel();
        const backoff = retryAfterMilliseconds(response) ?? 2 ** attempt * 1000;
        await wait(backoff);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        if (attempt === maxAttempts) {
          stop(`Nominatim remained unavailable after ${maxAttempts} attempts (${reason}).`);
          throw error;
        }
        await wait(2 ** attempt * 1000);
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error("Nominatim retry loop ended unexpectedly.");
  };

  return {
    fetchFn,
    isStopped: () => stoppedReason !== null,
    stopReason: () => stoppedReason,
    stop,
  };
}