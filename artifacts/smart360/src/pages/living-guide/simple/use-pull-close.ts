import { useRef, type TouchEvent } from "react";

/** Native scrolling wins except a downward pull that starts at the true top. */
export function usePullClose(onClose: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart(e: TouchEvent<HTMLElement>) {
      start.current = e.touches.length === 1 && e.currentTarget.scrollTop <= 0 &&
        !(e.target as Element).closest("button,a,input,textarea,select")
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    },
    onTouchEnd(e: TouchEvent<HTMLElement>) {
      const from = start.current;
      start.current = null;
      const to = e.changedTouches[0];
      if (from && to && e.currentTarget.scrollTop <= 0 &&
          to.clientY - from.y > 90 && to.clientY - from.y > Math.abs(to.clientX - from.x) * 1.5) onClose();
    },
    onTouchCancel() { start.current = null; },
  };
}
