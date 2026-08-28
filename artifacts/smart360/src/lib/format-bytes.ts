/** Decimal media sizes: the displayed MB/GB labels match the byte calculation. */
export function fmtMediaSize(bytes: number, compactWholeGb = false): string {
  if (bytes < 1_000_000_000) {
    return `${Math.round(bytes / 1_000_000)} MB`;
  }
  const value = (bytes / 1_000_000_000).toFixed(1).replace(".", ",");
  return `${compactWholeGb ? value.replace(/,0$/, "") : value} GB`;
}

/** "31 MB od 2 GB" or "1,4 GB od 2 GB". */
export function fmtMediaUsage(usedBytes: number, quotaBytes: number): string {
  return `${fmtMediaSize(usedBytes)} od ${fmtMediaSize(quotaBytes, true)}`;
}

/** Backwards-compatible decimal GB/MB formatter for existing consumers. */
export function fmtGb(bytes: number): string {
  return fmtMediaSize(bytes);
}

export function usagePct(used: number, quota: number): number {
  return quota > 0 ? Math.round((used / quota) * 100) : 0;
}
