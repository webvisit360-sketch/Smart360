import { useEffect, useState } from "react";
import { isExternalPreviewLink, withPreviewFrame } from "@/lib/preview-frame-safety";

/** Only installed by the admin parent; normal guest navigation is untouched. */
export function usePreviewNavigation(frame: HTMLIFrameElement | null, tick: number, editing: boolean) {
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!frame) return;
    const origin = window.location.origin;
    let active = true;
    const check = () => setUnavailable(withPreviewFrame(frame, origin, () => true) !== true);
    check();
    const timer = window.setInterval(check, 1000);
    const cleanup = withPreviewFrame(frame, origin, (win, doc) => {
      const open = win.open;
      const safeOpen: typeof window.open = (url, target, features) => {
        const href = String(url ?? "");
        if (isExternalPreviewLink(href, doc.baseURI)) {
          return window.open(new URL(href, doc.baseURI).href, "_blank", "noopener,noreferrer");
        }
        return open.call(win, url, target, features);
      };
      win.open = safeOpen;
      const click = (event: Event) => {
        if (!active || editing || event.defaultPrevented) return; // edit bridge owns selection
        const element = event.target as Element | null;
        const link = element?.nodeType === 1 ? element.closest("a[href],area[href]") : null;
        const href = link?.getAttribute("href");
        if (!href || !isExternalPreviewLink(href, doc.baseURI)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        window.open(new URL(href, doc.baseURI).href, "_blank", "noopener,noreferrer");
      };
      win.addEventListener("click", click, true);
      win.addEventListener("auxclick", click, true);
      return () => withPreviewFrame(frame, origin, (current, currentDoc) => {
        if (currentDoc !== doc) return;
        current.removeEventListener("click", click, true);
        current.removeEventListener("auxclick", click, true);
        if (current.open === safeOpen) current.open = open;
      });
    });
    return () => { active = false; window.clearInterval(timer); cleanup?.(); };
  }, [frame, tick, editing]);
  return unavailable;
}
