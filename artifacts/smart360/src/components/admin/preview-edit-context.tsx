import { createContext, useContext, useEffect, useRef } from "react";
import type { PreviewTarget } from "@/lib/preview-edit-resolver";

/** Selection coming from the live preview's "Klikni in uredi" mode. */
export type PreviewEditState = {
  target: PreviewTarget | null;
  /** Bumped on every selection so re-clicking the same element re-scrolls. */
  token: number;
  /** Release the selection after the form itself confirmed closing. */
  close: () => void;
  /** Inline form reports unsaved changes so admin-level exits can guard. */
  reportDirty: (dirty: boolean) => void;
};

const PreviewEditCtx = createContext<PreviewEditState>({ target: null, token: 0, close: () => {}, reportDirty: () => {} });

export const PreviewEditProvider = PreviewEditCtx.Provider;

export function usePreviewEdit() {
  return useContext(PreviewEditCtx);
}

/**
 * Scrolls the row into view, then the inline editor to the matching
 * `data-preview-field` anchor (if any) and focuses its first control.
 */
export function useRevealPreviewTarget(active: boolean, token: number, field: string | null | undefined) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const row = rowRef.current;
    if (!row) return;
    row.scrollIntoView({ block: "start", behavior: "smooth" });
    const timer = window.setTimeout(() => {
      const editor = row.parentElement?.querySelector<HTMLElement>("[data-preview-inline-editor]");
      const anchor = field ? editor?.querySelector<HTMLElement>(`[data-preview-field="${field}"]`) : null;
      const goal = anchor ?? editor;
      goal?.scrollIntoView({ block: anchor ? "center" : "start", behavior: "smooth" });
      const control = goal?.querySelector<HTMLElement>("input:not([type=file]):not([disabled]), textarea, [contenteditable=true], button");
      control?.focus({ preventScroll: true });
    }, 260);
    return () => window.clearTimeout(timer);
  }, [active, token, field]);
  return rowRef;
}
