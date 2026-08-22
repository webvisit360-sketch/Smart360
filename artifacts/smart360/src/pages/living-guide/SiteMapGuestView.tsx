import { useState, useRef, useEffect } from "react";
import type { SitePlanImage } from "@workspace/api-client-react";
import type { UiTranslator } from "../guest/i18n";
import { calculatePinchZoom, clampPan } from "./living-guide-gestures";

function PinchZoomImage({
  src,
  alt,
  t,
}: {
  src: string;
  alt: string;
  t: UiTranslator;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const clampTransform = (x: number, y: number, scale: number) => {
    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image?.naturalWidth || !image.naturalHeight) {
      return { x: scale === 1 ? 0 : x, y: scale === 1 ? 0 : y, scale };
    }
    const fit = Math.min(
      container.clientWidth / image.naturalWidth,
      container.clientHeight / image.naturalHeight,
    );
    const clamped = clampPan(
      x,
      y,
      scale,
      container.clientWidth,
      container.clientHeight,
      image.naturalWidth * fit,
      image.naturalHeight * fit,
    );
    return { ...clamped, scale };
  };

  const handleZoomIn = () =>
    setTransform((current) =>
      clampTransform(
        current.x,
        current.y,
        Math.min(current.scale * 1.5, 5),
      ),
    );
  const handleZoomOut = () =>
    setTransform((current) =>
      clampTransform(
        current.x,
        current.y,
        Math.max(current.scale / 1.5, 1),
      ),
    );
  const handleReset = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let startDist = 0;
    let startScale = 1;
    let startTransform = { x: 0, y: 0 };
    let startCenter = { x: 0, y: 0 };
    let lastTouch = { x: 0, y: 0 };
    let isPanning = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault(); // prevent pinch-zoom of entire page
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        startDist = Math.hypot(dx, dy);
        startScale = transformRef.current.scale;
        startTransform = {
          x: transformRef.current.x,
          y: transformRef.current.y,
        };
        const rect = container.getBoundingClientRect();
        startCenter = {
          x:
            (e.touches[0].clientX + e.touches[1].clientX) / 2 -
            rect.left -
            rect.width / 2,
          y:
            (e.touches[0].clientY + e.touches[1].clientY) / 2 -
            rect.top -
            rect.height / 2,
        };
        isPanning = false;
      } else if (e.touches.length === 1 && transformRef.current.scale > 1) {
        // allow one-finger scrolling if scale === 1, but trap if zoomed in
        e.preventDefault();
        isPanning = true;
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const newScale = calculatePinchZoom(
          transformRef.current.scale,
          transformRef.current.x,
          transformRef.current.y,
          startDist,
          dist,
          startScale,
          startCenter,
          1,
          5,
        ).scale;
        const rect = container.getBoundingClientRect();
        const currentCenter = {
          x:
            (e.touches[0].clientX + e.touches[1].clientX) / 2 -
            rect.left -
            rect.width / 2,
          y:
            (e.touches[0].clientY + e.touches[1].clientY) / 2 -
            rect.top -
            rect.height / 2,
        };
        const anchor = {
          x: (startCenter.x - startTransform.x) / startScale,
          y: (startCenter.y - startTransform.y) / startScale,
        };
        setTransform(
          clampTransform(
            currentCenter.x - anchor.x * newScale,
            currentCenter.y - anchor.y * newScale,
            newScale,
          ),
        );
      } else if (e.touches.length === 1 && isPanning) {
        e.preventDefault();
        const dx = e.touches[0].clientX - lastTouch.x;
        const dy = e.touches[0].clientY - lastTouch.y;
        
        setTransform((current) =>
          clampTransform(
            current.x + dx,
            current.y + dy,
            current.scale,
          ),
        );
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 1 && transformRef.current.scale > 1) {
        isPanning = true;
        lastTouch = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      } else {
        isPanning = false;
      }
    };

    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("touchcancel", onTouchEnd);
    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  return (
    <div className="relative w-full h-full" ref={containerRef} style={{ touchAction: transform.scale > 1 ? "none" : "pan-x pan-y" }}>
      <img 
        ref={imageRef}
        src={src} 
        alt={alt} 
        className="w-full h-full object-contain transition-transform duration-75"
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
      />
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button onClick={handleZoomIn} aria-label={t("UI.lg.siteMapZoomIn")} className="w-10 h-10 rounded-full shadow flex items-center justify-center font-bold text-xl" style={{ background: 'var(--card)', color: 'var(--tx)' }}>+</button>
        <button onClick={handleZoomOut} aria-label={t("UI.lg.siteMapZoomOut")} className="w-10 h-10 rounded-full shadow flex items-center justify-center font-bold text-xl" style={{ background: 'var(--card)', color: 'var(--tx)' }}>-</button>
        {transform.scale > 1 && (
          <button onClick={handleReset} aria-label={t("UI.lg.siteMapReset")} className="w-10 h-10 rounded-full shadow flex items-center justify-center mt-2" style={{ background: 'var(--card)', color: 'var(--tx)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}

export function SiteMapGuestView({ images, t, onBack }: { images: SitePlanImage[]; t: UiTranslator; onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const activeImage = images[index] ?? images[0];

  return (
    <div className="lg2-view z-50">
      <div className="flex-none flex items-center h-14 px-4 border-b" style={{ borderColor: 'var(--line)' }}>
        <button onClick={onBack} aria-label={t("UI.nav.back")} className="p-2 -ml-2 rounded-full" style={{ color: 'var(--tx)' }}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 className="ml-4 font-bold text-lg" style={{ color: 'var(--tx)' }}>{t("UI.lg.siteMap")}</h1>
      </div>
      
      <div className="flex-1 relative overflow-hidden" style={{ background: 'var(--bg)' }}>
        {activeImage && (
          <div key={activeImage.id} className="absolute inset-0">
            <PinchZoomImage
              src={activeImage.url}
              alt={activeImage.caption || ""}
              t={t}
            />
            {activeImage.caption && (
              <div className="absolute bottom-6 left-4 right-4 p-3 rounded-xl text-sm text-center shadow-lg pointer-events-none" style={{ background: 'var(--glass)', color: 'var(--tx)' }}>
                {activeImage.caption}
              </div>
            )}
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex-none h-16 flex items-center justify-center gap-2 border-t" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}>
          {images.map((_, i) => (
            <button 
              key={i} 
              onClick={() => setIndex(i)} 
              className={`w-2.5 h-2.5 rounded-full transition-colors`}
              style={{ background: i === index ? 'var(--acc)' : 'var(--line)' }}
              aria-label={t("UI.lg.siteMapDot", { index: String(i + 1) })}
            />
          ))}
        </div>
      )}
    </div>
  );
}