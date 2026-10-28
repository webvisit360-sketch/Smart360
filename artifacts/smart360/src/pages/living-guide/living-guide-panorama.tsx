import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { mediaImgSrc, HERO_IMAGE_WIDTH, CARD_IMAGE_WIDTH } from "../guest/img";
import { isSphericalPanorama } from "@/lib/panorama-projection";
import { GuideBackCircle } from "./simple/GuideHeaderControls";
import { useTourSummaryContext } from "./living-guide-tour-summary";
import {
  centredPanoramaPan,
  clampPanoramaPan,
  panoramaEdgeIntent,
  panoramaLabel,
  stepPanoramaIndex,
} from "@/lib/panorama-media";
import "./living-guide-panorama.css";
const SphericalPanorama = lazy(() => import("./living-guide-sphere"));

// Same width/URL as the hero gallery so the offline worker serves one cached
// asset — never introduce another width variant here.
const panoSrc = (m: any) => mediaImgSrc(m, HERO_IMAGE_WIDTH);

/** Stops gestures from reaching the detail sheet (pull-close, outside-click close). */
const isolate = (e: SyntheticEvent) => e.stopPropagation();

// Keep the media's owning entry on the leaf component, including category
// detail routes without /i/:id. The admin bridge reads this validated itemId.
function PanoramaThumb({ itemId, children, ...props }: React.ComponentProps<"button"> & { itemId?: string | null }) {
  return <button {...props}>{children}</button>;
}

export function PanoramaStrip({ media }: { media: any[] }) {
  const { lang } = useTourSummaryContext();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<{ el: HTMLElement | null; top: number }>({ el: null, top: 0 });
  if (!media.length) return null;

  const open = (index: number, button: HTMLButtonElement) => {
    openerRef.current = button;
    // Detail templates scroll in .lg2-detail-scroll[data-lg-scroll]; fall back to the view.
    const el = button.closest<HTMLElement>("[data-lg-scroll], .lg2-detail-scroll, .lg2-detail-view");
    scrollRef.current = { el, top: el?.scrollTop ?? 0 };
    setOpenIndex(index);
  };
  const close = () => {
    setOpenIndex(null);
    const { el, top } = scrollRef.current;
    requestAnimationFrame(() => {
      if (el) el.scrollTop = top;
      openerRef.current?.focus({ preventScroll: true });
    });
  };

  return (
    <section className="lg2-pano-strip" aria-label={panoramaLabel("strip", lang)} data-testid="panorama-strip">
      <h2 className="lg2-pano-strip-title">{panoramaLabel("strip", lang)}</h2>
      <div
        className="lg2-pano-strip-track"
        data-lg-scroll-x
        onTouchStart={isolate}
        onTouchMove={isolate}
        onPointerDown={isolate}
      >
        {media.map((m, i) => (
          <PanoramaThumb
            key={m.id ?? m.url}
            itemId={m.itemId}
            type="button"
            className="lg2-pano-thumb"
            aria-label={panoramaLabel("open", lang, i + 1, media.length)}
            onClick={(e) => { e.stopPropagation(); open(i, e.currentTarget); }}
            data-testid={`button-open-panorama-${i}`}
          >
            <img src={panoSrc(m)} alt={m.alt || ""} loading="lazy" decoding="async" draggable={false}
              style={{ objectPosition: `${m.focusX ?? 50}% ${m.focusY ?? 50}%` }} />
            <span className="lg2-pano-thumb-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M2 8c6-2.5 14-2.5 20 0v8c-6-2.5-14-2.5-20 0Z" /></svg>
            </span>
          </PanoramaThumb>
        ))}
      </div>
      {openIndex !== null && (
        <PanoramaViewer media={media} initialIndex={openIndex} lang={lang} onClose={close} />
      )}
    </section>
  );
}

function Chevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={dir === "prev" ? "M15.5 3 6.5 12l9 9 2.1-2.1L10.7 12l6.9-6.9Z" : "M8.5 3l9 9-9 9-2.1-2.1 6.9-6.9-6.9-6.9Z"} />
    </svg>
  );
}

export function PanoramaViewer({ media, initialIndex, lang, onClose }: {
  media: any[]; initialIndex: number; lang: string; onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [pan, setPan] = useState(0);
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ imgW: 0, viewW: 0 });
  const dragRef = useRef<{ id: number; startX: number; startPan: number; raw: number } | null>(null);
  const count = media.length;
  const entry = media[index];
  const src = panoSrc(entry);
  const [decodedSize, setDecodedSize] = useState<{ src: string; width: number; height: number } | null>(null);
  const sphere = isSphericalPanorama(
    decodedSize?.src === src ? decodedSize.width : entry?.width,
    decodedSize?.src === src ? decodedSize.height : entry?.height,
  );

  const measure = useCallback(() => {
    const viewW = stageRef.current?.clientWidth ?? 0;
    const imgW = imgRef.current?.getBoundingClientRect().width ?? 0;
    sizeRef.current = { imgW, viewW };
    return sizeRef.current;
  }, []);

  const recentre = useCallback(() => {
    const { imgW, viewW } = measure();
    setPan(centredPanoramaPan(imgW, viewW));
  }, [measure]);

  useLayoutEffect(() => { recentre(); }, [index, recentre]);
  useEffect(() => {
    const onResize = () => {
      const { imgW, viewW } = measure();
      setPan((p) => clampPanoramaPan(p, imgW, viewW));
    };
    window.addEventListener("resize", onResize);
    const dialog = dialogRef.current;
    dialog?.focus({ preventScroll: true });
    // Non-passive native listeners: nothing behind the viewer scrolls while it
    // is open, and nothing is left behind globally once it closes.
    const block = (ev: Event) => { ev.preventDefault(); ev.stopPropagation(); };
    dialog?.addEventListener("wheel", block, { passive: false });
    dialog?.addEventListener("touchmove", block, { passive: false });
    return () => {
      window.removeEventListener("resize", onResize);
      dialog?.removeEventListener("wheel", block);
      dialog?.removeEventListener("touchmove", block);
      
    };
  }, [measure]);

  const go = (dir: "prev" | "next") => setIndex((i) => stepPanoramaIndex(i, count, dir));

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    // One active pointer only: a second finger is ignored (no pinch, intentionally).
    if (dragRef.current) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: e.pointerId, startX: e.clientX, startPan: pan, raw: pan };
    setDragging(true);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    d.raw = d.startPan + (e.clientX - d.startX);
    const { imgW, viewW } = sizeRef.current;
    const clamped = clampPanoramaPan(d.raw, imgW, viewW);
    // Light rubber band past the edges hints at next/previous.
    setPan(clamped + (d.raw - clamped) * 0.25);
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    e.stopPropagation();
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    const { imgW, viewW } = sizeRef.current;
    const intent = cancelled ? null : panoramaEdgeIntent(d.raw, imgW, viewW, index, count);
    if (intent) go(intent);
    else setPan(clampPanoramaPan(d.raw, imgW, viewW));
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Tab") {
      const focusables = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), summary") ?? [],
      );
      if (!focusables.length) { e.preventDefault(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !dialogRef.current?.contains(active))) { e.preventDefault(); first.focus(); }
      return;
    }
    const isButton = e.target instanceof HTMLButtonElement;
    if (["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"].includes(e.key) || (e.key === " " && !isButton)) {
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowLeft" && index > 0) { e.preventDefault(); go("prev"); }
    else if (e.key === "ArrowRight" && index < count - 1) { e.preventDefault(); go("next"); }
  };

  const host = (typeof document !== "undefined" && document.querySelector(".lg2-app")) || document.body;
  return createPortal(
    <div
      ref={dialogRef}
      className="lg2-pano-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={panoramaLabel("viewer", lang)}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={isolate}
      onTouchStart={isolate}
      onTouchMove={isolate}
      onTouchEnd={isolate}
      onWheel={isolate}
      data-testid="panorama-viewer"
    >
      <div
        ref={stageRef}
        className={`lg2-pano-stage${dragging ? " is-dragging" : ""}`}
        onPointerDown={sphere ? undefined : onPointerDown}
        onPointerMove={sphere ? undefined : onPointerMove}
        onPointerUp={sphere ? undefined : (e) => endDrag(e)}
        onPointerCancel={sphere ? undefined : (e) => endDrag(e, true)}
        aria-label={panoramaLabel(sphere ? "lookAround" : "pan", lang)}
        aria-roledescription="panorama"
        data-testid="panorama-stage"
      >
        {sphere ? <Suspense fallback={<div className="lg2-pano-status" role="status">{panoramaLabel("loading", lang)}</div>}>
          <SphericalPanorama key={src} src={src} preview={mediaImgSrc(entry, CARD_IMAGE_WIDTH)} lang={lang} />
        </Suspense> : <img
          key={entry?.id ?? entry?.url}
          ref={imgRef}
          src={panoSrc(entry)}
          alt={entry?.alt || ""}
          draggable={false}
          onLoad={(event) => {
            setDecodedSize({ src, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
            recentre();
          }}
          style={{ transform: `translate3d(${pan}px,0,0)` }}
          data-testid="panorama-image"
        />}
      </div>
      <GuideBackCircle className="lg-back-circle--float lg2-pano-close" label={panoramaLabel("close", lang)} onClick={onClose} testId="button-panorama-close" />
      {count > 1 && (
        <>
          <button type="button" className="lg-back-circle lg2-pano-nav lg2-pano-nav--prev" aria-label={panoramaLabel("prev", lang)} title={panoramaLabel("prev", lang)}
            disabled={index === 0} onClick={() => go("prev")} data-testid="button-panorama-prev"><Chevron dir="prev" /></button>
          <button type="button" className="lg-back-circle lg2-pano-nav lg2-pano-nav--next" aria-label={panoramaLabel("next", lang)} title={panoramaLabel("next", lang)}
            disabled={index === count - 1} onClick={() => go("next")} data-testid="button-panorama-next"><Chevron dir="next" /></button>
        </>
      )}
      <div className="lg2-pano-counter" aria-live="polite" aria-label={panoramaLabel("counter", lang, index + 1, count)} data-testid="text-panorama-counter">
        {index + 1} / {count}
      </div>
    </div>,
    host,
  );
}
