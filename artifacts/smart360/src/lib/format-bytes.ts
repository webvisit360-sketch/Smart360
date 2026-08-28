/** Binary media sizes with the product's user-facing MB/GB labels. */
export function fmtMediaSize(bytes: number, compactWholeGb = false): string {
  if (bytes < 1024 ** 3) {
    return `${Math.round(bytes / 1024 ** 2)} MB`;
  }
  const value = (bytes / 1024 ** 3).toFixed(1).replace(".", ",");
  return `${compactWholeGb ? value.replace(/,0$/, "") : value} GB`;
}

/** "31 MB od 2 GB" or "1,4 GB od 2 GB". */
export function fmtMediaUsage(usedBytes: number, quotaBytes: number): string {
  return `${fmtMediaSize(usedBytes)} od ${fmtMediaSize(quotaBytes, true)}`;
}

/** Kept for cleanup dialogs that only call this for values of at least 1 GiB. */
export function fmtGb(bytes: number): string {
  return fmtMediaSize(bytes);
}

export function usagePct(used: number, quota: number): number {
  return quota > 0 ? Math.round((used / quota) * 100) : 0;
}
