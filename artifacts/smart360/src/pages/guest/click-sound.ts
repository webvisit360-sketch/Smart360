/* =========================================================
   ZVOK GUMBOV — mehanski klik ob dotiku (zvok-gumbov.md)

   Sintetiziran z Web Audio API, brez zvočne datoteke; približno IBM Model M:
   kratek filtriran šum + padajoč kvadratni čirp, skupaj ~45 ms, plus
   navigator.vibrate(6), kjer je podprt.

   Kaj klikne: NE seznam razredov (ta zastari v trenutku, ko kdo doda
   komponento, in odpove tiho). Vse, kar gost lahko pritisne, je <button>,
   nosi role="button" ali atribut data-click — poslušalec ujame te tri.

   AudioContext se na iOS ustvari šele ob PRVI gesti uporabnika (pointerdown
   je gesta) in se tam pokliče resume() — ustvarjen ob nalaganju strani bi
   ostal suspendiran in aplikacija bi bila tiho brez napake.
   ========================================================= */

const SND_KEY = "s360sound";

let AC: AudioContext | null = null;

/** Ali je zvok vklopljen (privzeto DA; gost ga izklopi v spustnem seznamu jezika). */
export function isSoundOn(): boolean {
  try {
    return localStorage.getItem(SND_KEY) !== "0";
  } catch {
    return true; /* zasebni način */
  }
}

/** Preklop; ob vklopu se takoj sliši en klik, da gost ve, kaj je izbral. */
export function toggleSound(): boolean {
  const next = !isSoundOn();
  try {
    localStorage.setItem(SND_KEY, next ? "1" : "0");
  } catch { /* zasebni način */ }
  if (next) click();
  return next;
}

/** En mehanski klik. Ob tihem načinu telefona OS zvok utiša sam; nič ne vrže. */
export function click(): void {
  if (navigator.vibrate) {
    try { navigator.vibrate(6); } catch { /* ni podprto */ }
  }
  if (!isSoundOn()) return;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    AC = AC || new Ctor();
    if (AC.state === "suspended") AC.resume();
    const t = AC.currentTime;
    /* filtriran šum: bandpass 2600 Hz, Q 1,1; gain .17 -> .001 v 45 ms */
    const n = AC.createBufferSource();
    const b = AC.createBuffer(1, 1600, AC.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < 1600; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / 1600, 7);
    n.buffer = b;
    const bp = AC.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2600;
    bp.Q.value = 1.1;
    const g = AC.createGain();
    g.gain.setValueAtTime(0.17, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    n.connect(bp).connect(g).connect(AC.destination);
    n.start(t);
    n.stop(t + 0.06);
    /* čirp: kvadrat 1750 Hz -> 760 Hz v 30 ms; gain .055 -> .0008 v 35 ms */
    const o = AC.createOscillator();
    const og = AC.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(1750, t);
    o.frequency.exponentialRampToValueAtTime(760, t + 0.03);
    og.gain.setValueAtTime(0.055, t);
    og.gain.exponentialRampToValueAtTime(0.0008, t + 0.035);
    o.connect(og).connect(AC.destination);
    o.start(t);
    o.stop(t + 0.04);
  } catch { /* zvok ne sme nikoli podreti aplikacije */ }
}

/** Vse pritisljivo v gostujoči aplikaciji — brez seznama razredov. */
const PRESSABLE = 'button,[role="button"],[data-click],a[href]';

/**
 * Namesti en delegiran poslušalec (pointerdown, passive) na document.
 * Vrne odstranjevalca. Klicati samo v gostujoči postavitvi — admin ne klika.
 * data-nosound izvzame element (stikalo za zvok: izklop mora biti tih —
 * pointerdown bi se sicer sprožil PRED preklopom, ko je zvok še vklopljen).
 */
export function installClickSound(): () => void {
  const onDown = (e: PointerEvent) => {
    const el = e.target as HTMLElement | null;
    const hit = el?.closest?.(PRESSABLE);
    if (hit && !(hit as HTMLElement).closest("[data-nosound]")) click();
  };
  document.addEventListener("pointerdown", onDown, { passive: true });
  return () => document.removeEventListener("pointerdown", onDown);
}
