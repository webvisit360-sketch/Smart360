/**
 * Dedicated-worker bootstraps do not reliably pass through the page's tenant
 * service worker. Fetch the emitted, self-contained Vite worker from the
 * controlled window first, then boot MapLibre from a local Blob URL.
 */
export function createControlledMapWorkerUrl(
  load: typeof fetch = (...args) => fetch(...args),
  makeUrl: (blob: Blob) => string = (blob) => URL.createObjectURL(blob),
) {
  const pending = new Map<string, Promise<string>>();
  return (assetUrl: string): Promise<string> => {
    const existing = pending.get(assetUrl);
    if (existing) return existing;
    const request = (async () => {
      const response = await load(assetUrl, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Map worker could not be loaded (${response.status})`);
      const source = await response.text();
      return makeUrl(new Blob([source], { type: "text/javascript" }));
    })().catch((error: unknown) => {
      pending.delete(assetUrl); // a later mount may explicitly retry
      throw error;
    });
    pending.set(assetUrl, request);
    return request;
  };
}

// MapLibre pools workers across maps. Retain each URL for the document lifetime
// instead of revoking it when one inline/fullscreen map happens to unmount.
export const controlledMapWorkerUrl = createControlledMapWorkerUrl();