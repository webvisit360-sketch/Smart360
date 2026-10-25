import { useEffect, useRef, useState } from "react";
import { coverImageCrop, landingInk } from "./landing-ink-model";

/** Never reads a third-party walk. A failed/tainted image retains white + shadow. */
export function useLandingInk(source: string | null | undefined, textSelector: string, revision: string) {
  const rootRef = useRef<HTMLElement>(null);
  const [ink, setInk] = useState<"dark" | "pale">("pale");
  useEffect(() => {
    setInk("pale");
    const root = rootRef.current;
    const img = root?.querySelector("img");
    if (!root || !img || !source) return;
    let disposed = false, frame = 0;
    const sampleImage = new Image();
    sampleImage.crossOrigin = "anonymous";
    const measure = () => {
      if (disposed || !sampleImage.naturalWidth) return;
      const bounds = img.getBoundingClientRect();
      const texts = [...root.querySelectorAll(textSelector)].map(el => el.getBoundingClientRect());
      if (!bounds.width || !bounds.height || !texts.length) return;
      const left = Math.max(bounds.left, Math.min(...texts.map(r => r.left)));
      const top = Math.max(bounds.top, Math.min(...texts.map(r => r.top)));
      const right = Math.min(bounds.right, Math.max(...texts.map(r => r.right)));
      const bottom = Math.min(bounds.bottom, Math.max(...texts.map(r => r.bottom)));
      if (right <= left || bottom <= top) return;
      const focus = getComputedStyle(img).objectPosition.split(" ").map(parseFloat);
      const crop = coverImageCrop(sampleImage.naturalWidth, sampleImage.naturalHeight,
        bounds.width, bounds.height, focus[0] || 0, focus[1] || 0,
        { x: left - bounds.left, y: top - bounds.top, width: right - left, height: bottom - top });
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 96; canvas.height = 32;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(sampleImage, crop.x, crop.y, crop.width, crop.height, 0, 0, 96, 32);
        setInk(landingInk(ctx.getImageData(0, 0, 96, 32).data));
      } catch { setInk("pale"); }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    sampleImage.onload = schedule;
    sampleImage.onerror = () => { if (!disposed) setInk("pale"); };
    sampleImage.src = source;
    const observer = new ResizeObserver(schedule);
    observer.observe(root); observer.observe(img);
    root.querySelectorAll(textSelector).forEach(el => observer.observe(el));
    document.fonts.ready.then(() => { if (!disposed) schedule(); });
    // The Trend hero has an entrance animation; measure its settled position too.
    root.addEventListener("animationend", schedule);
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      sampleImage.onload = null; sampleImage.onerror = null;
      root.removeEventListener("animationend", schedule);
    };
  }, [source, textSelector, revision]);
  return { rootRef, ink };
}
