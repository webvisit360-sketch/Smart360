import { useEffect, useRef, useState } from "react";
import { imgSrc, mediaImgSrc } from "./img";
import { normalizeGuestMedia } from "../living-guide/living-guide-formatters";

/* =========================================================
   GALERIJA ČEZ CEL ZASLON — slike in video (tema Poteg/Sredozemska)
   Zvesta preslikava reference (smart360-poteg v23, "mv__" / lightbox):
   - pomik levo/desno med postavkami (scroll-snap)
   - ščipanje z dvema prstoma ali dvojni dotik za povečavo
   - gumb za vrtenje (za telefone z zaklenjeno usmerjenostjo)
   - video se predvaja v istem okviru, z istim povečanjem
   ========================================================= */

/* ZAMRZNJENO, NE ODSTRANJENO: ščipanje/dvojni dotik/vrtenje se ne obnašajo
   dovolj dobro za izdajo. Ena zastavica — ko bo geste urejena, jo obrnemo
   nazaj na true, brez ponovne implementacije. */
const ZOOM_ON = false;

/* ZAMRZNJENO: celozaslonski pregledovalnik. Dotik na fotografijo ne odpre
   ničesar — galerija se lista na mestu, s pikami pod sliko. Koda ostane;
   vklop: ena vrednost (pike-brisanje-ozadje.md). */
const LIGHTBOX_ON = false;

export type ViewerMedia = {
  id: string;
  url: string;
  alt?: string | null;
  kind?: string;
  posterUrl?: string | null;
  /** Žariščna točka izreza v odstotkih (izrez-wifi-eposta.md §1a). */
  focusX?: number | null;
  focusY?: number | null;
};

/* Oblika okvirja fotografij vnosa (izrez-wifi-eposta.md §1b): CSS
   spremenljivka --ph-ratio, ki jo temi bereta na .card__ph/.galtrack.
   Cela galerija enega vnosa deli obliko — mešane višine poskakujejo. */
const FRAME_RATIOS: Record<string, string> = { tall: "4 / 5", square: "1 / 1" };
export function frameStyle(frame?: string | null): React.CSSProperties | undefined {
  const r = frame ? FRAME_RATIOS[frame] : undefined;
  return r ? ({ "--ph-ratio": r } as React.CSSProperties) : undefined;
}

/** object-position prek --ph-focus; privzeto središče = današnji izris. */
export function focusStyle(m: ViewerMedia): React.CSSProperties | undefined {
  const x = m.focusX ?? 50;
  const y = m.focusY ?? 50;
  if (x === 50 && y === 50) return undefined;
  return { "--ph-focus": `${x}% ${y}%` } as React.CSSProperties;
}

export function MediaViewer({
  media,
  index,
  onClose,
}: {
  media: ViewerMedia[];
  index: number;
  onClose: () => void;
}) {
  media = normalizeGuestMedia(media) as ViewerMedia[];
  const trackRef = useRef<HTMLDivElement>(null);
  const mvRef = useRef<HTMLDivElement>(null);
  const iRef = useRef(index);
  const [count, setCount] = useState(index);
  const [turned, setTurned] = useState(false);
  const [hintOff, setHintOff] = useState(false);

  // Odpiranje: telo ne sme drseti pod galerijo; hint ugasne po 2,6 s;
  // Escape zapre. Ob zaprtju se vse pavzira in overflow povrne.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => setHintOff(true), 2600);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      mvRef.current?.querySelectorAll("video").forEach((v) => v.pause());
      document.body.style.overflow = "";
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Začetni pomik na izbrano postavko.
  useEffect(() => {
    const tr = trackRef.current;
    if (!tr) return;
    requestAnimationFrame(() => {
      tr.scrollLeft = index * (tr.clientWidth || window.innerWidth);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- povečava: ščipanje, dvojni dotik, vlečenje ----------
     Preslikano 1:1 iz reference (mvBind) — is-zoom na .mv izklopi
     horizontalni pomik traku, da povečana slika ne "uide" na sosednjo. */
  useEffect(() => {
    if (!ZOOM_ON) return; /* povečava zamrznjena — gest ne vežemo */
    const tr = trackRef.current;
    const mv = mvRef.current;
    if (!tr || !mv) return;
    const cleanups: Array<() => void> = [];
    tr.querySelectorAll<HTMLElement>(".mv__z").forEach((z) => {
      let st = { s: 1, x: 0, y: 0 };
      const pts = new Map<number, { x: number; y: number }>();
      let base: {
        single?: boolean; px?: number; py?: number;
        d?: number; s?: number; mx?: number; my?: number;
        x: number; y: number;
      } | null = null;
      let lastTap = 0;
      const apply = (live: boolean) => {
        z.classList.toggle("is-live", !!live);
        z.style.setProperty("--mvs", String(st.s));
        z.style.setProperty("--mvx", st.x + "px");
        z.style.setProperty("--mvy", st.y + "px");
        mv.classList.toggle("is-zoom", st.s > 1.02);
      };
      const clamp = () => {
        if (st.s <= 1.02) { st.s = 1; st.x = 0; st.y = 0; }
      };
      (z as HTMLElement & { __reset?: () => void }).__reset = () => {
        st = { s: 1, x: 0, y: 0 };
        apply(false);
      };

      const down = (e: PointerEvent) => {
        /* pusti gumbe predvajalnika */
        if ((e.target as HTMLElement).tagName === "VIDEO" && st.s <= 1.02) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        z.setPointerCapture(e.pointerId);
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          base = {
            d: Math.hypot(a.x - b.x, a.y - b.y), s: st.s,
            mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, x: st.x, y: st.y,
          };
        } else if (pts.size === 1) {
          base = { single: true, px: e.clientX, py: e.clientY, x: st.x, y: st.y };
          const now = Date.now();
          if (now - lastTap < 300) { /* dvojni dotik */
            if (st.s > 1.02) { st = { s: 1, x: 0, y: 0 }; }
            else {
              const r = z.getBoundingClientRect();
              st.s = 2.6;
              st.x = (r.left + r.width / 2 - e.clientX) * 1.6;
              st.y = (r.top + r.height / 2 - e.clientY) * 1.6;
            }
            clamp(); apply(false); lastTap = 0; pts.clear(); base = null; return;
          }
          lastTap = now;
        }
      };
      const move = (e: PointerEvent) => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2 && base && !base.single) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          st.s = Math.min(5, Math.max(1, (base.s ?? 1) * (d / (base.d || 1))));
          st.x = base.x + ((a.x + b.x) / 2 - (base.mx ?? 0));
          st.y = base.y + ((a.y + b.y) / 2 - (base.my ?? 0));
          apply(true); e.preventDefault();
        } else if (pts.size === 1 && base && base.single && st.s > 1.02) {
          st.x = base.x + (e.clientX - (base.px ?? 0));
          st.y = base.y + (e.clientY - (base.py ?? 0));
          apply(true); e.preventDefault();
        }
      };
      const up = (e: PointerEvent) => {
        pts.delete(e.pointerId);
        if (pts.size < 2)
          base = pts.size === 1
            ? { single: true, px: [...pts.values()][0].x, py: [...pts.values()][0].y, x: st.x, y: st.y }
            : null;
        clamp(); apply(false);
      };
      z.addEventListener("pointerdown", down);
      z.addEventListener("pointermove", move);
      z.addEventListener("pointerup", up);
      z.addEventListener("pointercancel", up);
      cleanups.push(() => {
        z.removeEventListener("pointerdown", down);
        z.removeEventListener("pointermove", move);
        z.removeEventListener("pointerup", up);
        z.removeEventListener("pointercancel", up);
      });
    });
    return () => cleanups.forEach((fn) => fn());
  }, [media]);

  // Pomik med postavkami: pavziraj videe in ponastavi povečavo prejšnje.
  const onScroll = () => {
    const tr = trackRef.current;
    if (!tr) return;
    const w = tr.clientWidth || window.innerWidth;
    const i = Math.round(tr.scrollLeft / w);
    if (i !== iRef.current) {
      tr.querySelectorAll("video").forEach((v) => v.pause());
      const z = document.getElementById("mvz" + iRef.current) as
        | (HTMLElement & { __reset?: () => void })
        | null;
      z?.__reset?.();
      mvRef.current?.classList.remove("is-zoom");
      iRef.current = i;
      setCount(i);
    }
  };

  /* vrtenje: pomaga, kadar ima gost zaklenjeno usmerjenost zaslona */
  const turn = () => {
    const next = !turned;
    setTurned(next);
    trackRef.current?.querySelectorAll<HTMLElement>(".mv__z").forEach((z) => {
      z.classList.toggle("is-turned", next);
      z.style.setProperty("--mvr", next ? "90deg" : "0deg");
    });
  };

  return (
    <div className="mv on" ref={mvRef}>
      <div className="mv__top">
        <span className="mv__c">{count + 1} / {media.length}</span>
        <span className="mv__sp"></span>
        {ZOOM_ON && (
          <button className="mv__b" onClick={turn} aria-label="Zavrti">
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 1 3 6.7" /><path d="M3 20v-5h5" /></svg>
          </button>
        )}
        <button className="mv__b" onClick={onClose} aria-label="Zapri">
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <div className="mv__track" ref={trackRef} onScroll={onScroll}>
        {media.map((m, i) => (
          <div className="mv__it" data-i={i} key={m.id}>
            <div className="mv__z" id={`mvz${i}`}>
              {m.kind === "video" ? (
                <video
                  src={m.url}
                  poster={imgSrc(m.posterUrl, 1400)}
                  playsInline
                  controls
                  preload="metadata"
                />
              ) : (
                <img src={imgSrc(m.url, 1400)} alt={m.alt || ""} />
              )}
            </div>
          </div>
        ))}
      </div>
      {ZOOM_ON && <div className={`mv__hint${hintOff ? " off" : ""}`}>{zoomHint()}</div>}
    </div>
  );
}

/** Namig za povečavo sledi <html lang>, ki ga nastavi applyDocumentLang. */
const ZOOM_HINTS: Record<string, string> = {
  sl: "Dvakrat tapnite za povečavo",
  en: "Double-tap to zoom",
  de: "Zum Vergrößern doppelt tippen",
  it: "Tocca due volte per ingrandire",
};
/** Dostopna oznaka za odpiranje galerije (video brez alt) — sledi <html lang>. */
const OPEN_LABELS: Record<string, string> = {
  sl: "Odpri galerijo",
  en: "Open gallery",
  de: "Galerie öffnen",
  it: "Apri la galleria",
};
function zoomOpenLabel(): string {
  const l = (document.documentElement.lang || "sl").slice(0, 2);
  return OPEN_LABELS[l] ?? OPEN_LABELS.sl!;
}

function zoomHint(): string {
  const l = (document.documentElement.lang || "sl").slice(0, 2);
  return ZOOM_HINTS[l] ?? ZOOM_HINTS.sl!;
}

/** Galerijski trak v vsebini: dotik odpre galerijo čez cel zaslon. */
export function GalleryStrip({
  media,
  style,
}: {
  media: ViewerMedia[];
  style?: React.CSSProperties;
}) {
  media = normalizeGuestMedia(media) as ViewerMedia[];
  const [idx, setIdx] = useState<number | null>(null);
  const [dot, setDot] = useState(0);
  const mediaKey = media.map((entry) => entry.id ?? entry.url).join("|");
  useEffect(() => {
    setDot(0);
    setIdx(null);
  }, [mediaKey]);
  const open = (i: number) => {
    if (!LIGHTBOX_ON) return; /* pregledovalnik zamrznjen — dotik ne odpre ničesar */
    setIdx(i);
  };
  /* Aktivna pika iz scrollLeft/clientWidth (kot galScroll v referenci). */
  const onTrackScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const tr = e.currentTarget;
    const w = tr.clientWidth || 1;
    const i = Math.round(tr.scrollLeft / w);
    if (i !== dot) setDot(i);
  };
  /* Fotografije so fokusabilne/klikabilne samo, ko je pregledovalnik vklopljen. */
  const clickable = LIGHTBOX_ON
    ? (i: number) => ({
        role: "button" as const,
        tabIndex: 0,
        onClick: () => open(i),
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); }
        },
      })
    : () => ({ style: { cursor: "default" } as React.CSSProperties });
  return (
    <div className="gal" style={style}>
      <div className="galtrack" onScroll={media.length > 1 ? onTrackScroll : undefined}>
        {media.map((m, i) =>
          m.kind === "video" ? (
            <span
              key={m.id}
              className="gvid"
              aria-label={m.alt || zoomOpenLabel()}
              {...clickable(i)}
            >
              <video src={m.url} poster={imgSrc(m.posterUrl, 1400)} muted playsInline preload="metadata" />
              <i className="gvid__p" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5l12 7-12 7z" /></svg></i>
            </span>
          ) : (
            <img
              key={m.id}
              loading="lazy"
              decoding="async"
              src={imgSrc(m.url, 1400)}
              alt={m.alt || ""}
              {...clickable(i)}
              style={{ ...(LIGHTBOX_ON ? undefined : { cursor: "default" }), ...focusStyle(m) }}
            />
          ),
        )}
      </div>
      {/* Pike: edini znak, da je fotografij več. Ena fotografija: brez pik. */}
      {media.length > 1 && (
        <div className="galdots" aria-hidden="true">
          {media.map((m, i) => (
            <i key={m.id} className={i === dot ? "on" : undefined} />
          ))}
        </div>
      )}
      {idx !== null && <MediaViewer media={media} index={idx} onClose={() => setIdx(null)} />}
    </div>
  );
}

/** Slika kartice/ploščice: dotik odpre celotno galerijo postavke. */
export function MediaThumb({
  media,
  alt,
}: {
  media: ViewerMedia[];
  alt?: string;
}) {
  media = normalizeGuestMedia(media) as ViewerMedia[];
  const [idx, setIdx] = useState<number | null>(null);
  const m = media[0];
  if (!m) return null;
  return (
    <>
      <img
        loading="lazy"
        decoding="async"
        src={mediaImgSrc(m, 620)}
        alt={alt ?? m.alt ?? ""}
        style={{ ...(LIGHTBOX_ON ? undefined : { cursor: "default" }), ...focusStyle(m) }}
        onClick={(e) => {
          e.stopPropagation();
          if (LIGHTBOX_ON) setIdx(0); /* pregledovalnik zamrznjen */
        }}
      />
      {m.kind === "video" && (
        <i className="gvid__p" aria-hidden="true" style={{ width: 44, height: 44 }}>
          <svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }}><path d="M8 5l12 7-12 7z" /></svg>
        </i>
      )}
      {idx !== null && <MediaViewer media={media} index={idx} onClose={() => setIdx(null)} />}
    </>
  );
}
