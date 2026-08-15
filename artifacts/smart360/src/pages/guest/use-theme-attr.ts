import { useLayoutEffect } from "react";

// Both theme CSS files ship in one bundle, so their rules (including layout
// rules like .dpager{display:flex}) are scoped to html[data-theme="..."]. The
// attribute must therefore be present BEFORE any descendant layout effect
// measures the DOM — child layout effects run before parent ones, so setting
// it in an effect is too late for deep links. Setting it during render is an
// idempotent DOM write and safe to repeat.
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
