// Live mounted owners only, not stale saved tracks. Ref-count duplicate owners.
const owners = new Map<string, number>();
export function registerActiveTourView(key: string) {
  owners.set(key, (owners.get(key) ?? 0) + 1);
  return () => {
    const count = (owners.get(key) ?? 1) - 1;
    if (count) owners.set(key, count); else owners.delete(key);
  };
}
export function hasActiveTourView(slug: string) {
  return [...owners.keys()].some(key => key.startsWith(`${slug}/`));
}
