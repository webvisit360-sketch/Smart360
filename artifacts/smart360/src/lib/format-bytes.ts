/** "1,2 GB" (sl-SI decimal comma). Media quotas are always shown in GB. */
export function fmtGb(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
}

export function usagePct(used: number, quota: number): number {
  return quota > 0 ? Math.round((used / quota) * 100) : 0;
}
