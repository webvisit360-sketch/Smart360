const DEFAULT_COLLAPSE_WINDOW_MS = 5 * 60 * 1_000;

type ChangelogLike = {
  id: string;
  action: string;
  entity: string;
  summary: string;
  actorLabel?: string;
  actorType?: string;
  requestIp?: string | null;
  createdAt: string;
};

export type CollapsedChangelogEntry<T> = T & { repeatCount: number };

function isSameEvent(a: ChangelogLike, b: ChangelogLike): boolean {
  return (
    a.action === b.action &&
    a.entity === b.entity &&
    a.summary === b.summary &&
    a.actorLabel === b.actorLabel &&
    a.actorType === b.actorType &&
    a.requestIp === b.requestIp
  );
}

export function collapseConsecutiveChangelog<T extends ChangelogLike>(
  entries: readonly T[],
  windowMs = DEFAULT_COLLAPSE_WINDOW_MS,
): Array<CollapsedChangelogEntry<T>> {
  const collapsed: Array<CollapsedChangelogEntry<T>> = [];

  for (const entry of entries) {
    const previous = collapsed.at(-1);
    const newestAt = previous ? new Date(previous.createdAt).getTime() : NaN;
    const entryAt = new Date(entry.createdAt).getTime();
    const withinWindow =
      previous &&
      Number.isFinite(newestAt) &&
      Number.isFinite(entryAt) &&
      newestAt - entryAt >= 0 &&
      newestAt - entryAt <= windowMs;

    if (previous && withinWindow && isSameEvent(previous, entry)) {
      previous.repeatCount += 1;
      continue;
    }

    collapsed.push({ ...entry, repeatCount: 1 });
  }

  return collapsed;
}