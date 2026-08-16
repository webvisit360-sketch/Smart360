import { useLayoutEffect } from "react";

// Both theme CSS files ship in one bundle, so their rules (including layout
// rules like .dpager{display:flex}) are scoped to html[data-theme="..."]. The
// attribute must therefore be present BEFORE any descendant layout effect
// measures the DOM — child layout effects run before parent ones, so setting
// it in an effect is too late for deep links. Setting it during render is an
// idempotent DOM write and safe to repeat.
/** Relative luminance of a #RRGGBB colour (sRGB -> linear, WCAG formula). */
function relLuminance(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return 1; // unparseable = treat as light, never accidentally dark
  const lin = (i: number) => {
    const c = parseInt(m[1]!.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
}

/**
 * One admin setting, "Ozadje strani": applies tenant.bgColor as --paper on
 * <html> and DERIVES dark mode (luminance < 0.42 -> data-dark="1") — text and
 * line tokens flip in CSS, they are never stored (wifi-in-barva-ozadja.md).
 * Idempotent render-time write, same reasoning as the theme attribute above.
 */
export function usePageBg(bgColor: string | null | undefined) {
  const apply = (root: HTMLElement) => {
    if (bgColor) {
      root.style.setProperty("--paper", bgColor);
      if (relLuminance(bgColor) < 0.42) root.setAttribute("data-dark", "1");
      else root.removeAttribute("data-dark");
    } else {
      root.style.removeProperty("--paper");
      root.removeAttribute("data-dark");
    }
  };
  // Render-time write for the same before-child-effects reason as the theme
  // attribute above; the layout effect RE-applies after its own cleanup, or
  // StrictMode's double-invoke would strip the attribute right after mount.
  if (typeof document !== "undefined") apply(document.documentElement);
  useLayoutEffect(() => {
    apply(document.documentElement);
    return () => {
      // Never leak the guest background into /admin.
      const root = document.documentElement;
      root.style.removeProperty("--paper");
      root.removeAttribute("data-dark");
    };
  });
}

export function useThemeAttr(theme: string | null | undefined) {
  if (theme && typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-theme") !== theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }
  // Cleanup when the guest page unmounts (e.g. navigating to /admin).
  useLayoutEffect(() => {
    if (!theme) return;
    document.documentElement.setAttribute("data-theme", theme);
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, [theme]);
}
