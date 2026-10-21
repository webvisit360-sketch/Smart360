import { useLayoutEffect, useRef } from "react";
import { createPwaLaunchPolicy } from "@/lib/pwa-launch";

export function usePwaLaunch(key: string, enabled: boolean, reset: () => void) {
  const callback = useRef(reset);
  callback.current = reset;
  useLayoutEffect(() => {
    const installed = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!installed || !enabled) return;
    const policy = createPwaLaunchPolicy(() => callback.current());
    const visibility = () => {
      if (document.visibilityState === "hidden") policy.hide();
      else policy.show();
    };
    const hide = () => policy.hide();
    const show = (event: PageTransitionEvent) => {
      if (document.visibilityState === "visible") policy.show(event.persisted);
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    if (document.visibilityState === "visible") policy.show();
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, [key, enabled]);
}
