import { useEffect } from "react";

/**
 * Paket 17: skupna lepljiva glava spodnjega lista — ročaj na sredini, križec desno.
 * Izrisana enkrat, uporabljena v vseh listih. Doda tudi zapiranje s tipko Escape,
 * tako da so vedno na voljo tri poti ven: križec, zastor in Escape.
 */
export function SheetTop({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <div className="sheet__top">
      <span className="grab"></span>
      <button className="sheet__x" onClick={onClose} aria-label="Zapri">
        <svg className="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}
