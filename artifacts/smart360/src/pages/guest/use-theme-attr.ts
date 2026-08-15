import { useEffect } from "react";

// Both theme CSS files ship in one bundle, so their cover-variable defaults are
// scoped to html[data-theme="mediterran"] / html[data-theme="swipe"]. This hook
// sets the attribute from Tenant.theme; admin overrides written to
// document.documentElement.style still win over both blocks.
export function useThemeAttr(theme: string | null | undefined) {
  useEffect(() => {
    if (!theme) return;
    document.documentElement.setAttribute("data-theme", theme);
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, [theme]);
}
