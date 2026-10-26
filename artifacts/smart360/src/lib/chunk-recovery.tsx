import { useEffect } from "react";
import { blockUnsafeRecovery, CHUNK_RETRY_KEY, isReloadSafe, requestSafeReload } from "./bundle-freshness";

let failed = false;
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading (?:CSS )?chunk .+ failed|ChunkLoadError|Unable to preload CSS/i.test(message);
}
/** Called before React unmounts the failed tree and clears its activity effects. */
export function captureChunkFailure(error: unknown): boolean {
  if (!isChunkLoadError(error)) return false;
  failed = true;
  if (!isReloadSafe()) blockUnsafeRecovery();
  return true;
}
export function recoverChunk(): boolean {
  if (!isReloadSafe()) return false;
  try {
    if (sessionStorage.getItem(CHUNK_RETRY_KEY)) return false;
    sessionStorage.setItem(CHUNK_RETRY_KEY, "1");
  } catch { return false; }
  return requestSafeReload();
}
export function installChunkRecovery(): void {
  window.addEventListener("vite:preloadError", ((event: Event & { payload?: unknown }) => {
    captureChunkFailure(event.payload);
  }) as EventListener);
  window.addEventListener("unhandledrejection", event => {
    if (captureChunkFailure(event.reason)) {
      event.preventDefault();
      recoverChunk();
      window.dispatchEvent(new CustomEvent("s360:chunk-error", { detail: event.reason }));
    }
  });
}
/** Lives INSIDE the route Suspense: never clear the guard on a loading fallback. */
export function ChunkLoadSucceeded() {
  useEffect(() => {
    if (failed) return;
    try { sessionStorage.removeItem(CHUNK_RETRY_KEY); } catch { /* fail closed */ }
  }, []);
  return null;
}
export function ChunkFailureScreen() {
  return <div role="alert" className="p-8 text-center font-medium bg-slate-50 rounded-xl border m-4">
    <p>Aplikacije ni bilo mogoče v celoti naložiti. Morda je bila pravkar posodobljena.</p>
    <p className="text-sm mt-2">Če snemate turo ali pišete sporočilo, najprej poskrbite za svoje podatke. Ročno ponovno nalaganje prekine trenutno delo.</p>
    <button className="mt-4 rounded border px-4 py-2" onClick={() => {
      if (!isReloadSafe() && !window.confirm("Ponovno nalaganje lahko prekine snemanje ali izgubi neposlano sporočilo. Nadaljujem?")) return;
      requestSafeReload(true);
    }}>Ponovno naloži</button>
  </div>;
}
