export function publicationDraftChanged(
  currentForm: unknown,
  lastSavedForm: unknown,
  currentQuota: string,
  lastSavedQuota: string,
): boolean {
  return JSON.stringify(currentForm) !== JSON.stringify(lastSavedForm)
    || currentQuota !== lastSavedQuota;
}

export function publicationNeedsConfirmation({
  cachedDirty,
  localDirty,
  previewTotal,
  allowCleanAutoPublish,
}: {
  cachedDirty: boolean;
  localDirty: boolean;
  previewTotal: number;
  allowCleanAutoPublish: boolean;
}): boolean {
  return !allowCleanAutoPublish || cachedDirty || localDirty || previewTotal > 0;
}