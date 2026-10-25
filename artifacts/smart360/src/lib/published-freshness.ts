/** Network checks never replace the visible snapshot until every activity is safe.
 * The payload carries its own atomic publication identity (not the earlier probe's).
 */
export function createPublishedFreshness<T extends { publishedVersion?: string }>(env: {
  current(): T | undefined;
  safe(): boolean;
  version(): Promise<string>;
  content(): Promise<T>;
  apply(value: T): void;
}) {
  let disposed = false;
  let checking = false;
  let pending: T | undefined;
  const flush = () => {
    if (disposed || !pending || !env.safe()) return;
    const next = pending;
    pending = undefined;
    env.apply(next);
  };
  return {
    flush,
    async check() {
      if (disposed || checking) return;
      checking = true;
      try {
        const version = await env.version();
        if (disposed || !version) return;
        if (version !== env.current()?.publishedVersion && version !== pending?.publishedVersion) {
          const next = await env.content();
          // An offline worker can return an old cached payload. Do not mistake
          // it for a new publication or discard the current view.
          if (next.publishedVersion === version) pending = next;
        }
        flush();
      } catch {
        // Offline: retain the existing view and existing worker fallback.
      } finally { checking = false; }
    },
    dispose() { disposed = true; pending = undefined; },
  };
}
