import { useRef, type TouchEvent } from "react";
import { pullAxis, type PullAxis } from "./pull-close-gesture";

/** Native scrolling wins except a downward pull that starts at the true top. */
export function usePullClose(onClose: () => void, scrollSelector?: string) {
  const start = useRef<{ x: number; y: number; scroller: HTMLElement; axis: PullAxis } | null>(null);
  return {
    onTouchStart(e: TouchEvent<HTMLElement>) {
      const scroller = scrollSelector ? (e.target as Element).closest<HTMLElement>(scrollSelector) : e.currentTarget;
      start.current = e.touches.length === 1 && scroller && scroller.scrollTop <= 0 &&
        !(e.target as Element).closest("input,textarea,select")
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY, scroller, axis: "pending" } : null;
    },
    onTouchMove(e: TouchEvent<HTMLElement>) {
      const from = start.current;
      if (!from) return;
      if (e.touches.length !== 1) { start.current = null; return; }
      const dx = e.touches[0].clientX - from.x;
      const dy = e.touches[0].clientY - from.y;
      from.axis = pullAxis(from.axis, dx, dy, from.scroller.scrollTop);
      // Never cancel touchmove: upward/sideways gestures and all scrolling belong to the browser.
    },
    onTouchEnd(e: TouchEvent<HTMLElement>) {
      const from = start.current;
      start.current = null;
      const to = e.changedTouches[0];
      if (from && to && from.axis === "down" && from.scroller.scrollTop <= 0 &&
          to.clientY - from.y > 90 && to.clientY - from.y > Math.abs(to.clientX - from.x) * 1.5) {
        e.preventDefault(); // Suppress only the synthetic click after an actual close.
        onClose();
      }
    },
    onTouchCancel() { start.current = null; },
  };
}
