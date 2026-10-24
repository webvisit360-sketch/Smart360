// Enostaven owner deviation: remove ONLY the outer (drop) components of box-shadow
// from guest button surfaces; inset components (palette gap ring, selected states)
// stay exactly as authored. CSS cannot filter shadow lists, so runtime surfaces
// (incl. body portals) are normalised here while body[data-guest-design="simple"] is set.
export const SHADOW_BUTTON_SELECTOR =
  'button,[role="button"],input[type="button"],input[type="submit"],a[class*="btn"],a[class*="button"],a[class*="cta"],a.lgs-tile,.maplibregl-ctrl-group';

/** Split a computed box-shadow list and keep only inset layers ("none" if no inset). */
export function insetOnly(boxShadow: string): string {
  if (!boxShadow || boxShadow === "none") return "none";
  const parts = boxShadow.split(/,(?![^(]*\))/).map((p) => p.trim()).filter(Boolean);
  const inset = parts.filter((p) => /\binset\b/.test(p));
  return inset.length ? inset.join(", ") : "none";
}

const MARK = "lgsShadow";

function normalise(el: HTMLElement) {
  if (el.dataset[MARK] !== undefined) {
    el.style.removeProperty("box-shadow");
    delete el.dataset[MARK];
  }
  const computed = getComputedStyle(el).boxShadow;
  const kept = insetOnly(computed);
  if (kept !== computed && computed !== "none") {
    el.style.setProperty("box-shadow", kept, "important");
    el.dataset[MARK] = "";
  }
}

/** Starts the observer; returns a cleanup that restores every touched element. */
export function startOuterShadowStrip(root: HTMLElement = document.body): () => void {
  let frame = 0;
  const scan = () => {
    frame = 0;
    root.querySelectorAll<HTMLElement>(SHADOW_BUTTON_SELECTOR).forEach(normalise);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(scan); };
  scan();
  // Only childList + class changes: our own inline style writes never re-trigger.
  const mo = new MutationObserver(schedule);
  mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-selected", "aria-pressed", "data-state"] });
  return () => {
    mo.disconnect();
    if (frame) cancelAnimationFrame(frame);
    root.querySelectorAll<HTMLElement>(`[data-lgs-shadow]`).forEach((el) => {
      el.style.removeProperty("box-shadow");
      delete el.dataset[MARK];
    });
  };
}
