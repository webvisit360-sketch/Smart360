import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const subscribers = new Set<() => void>();
let promptEvent: InstallPromptEvent | null = null;
let promptSlug: string | null = null;
let pendingInstallSlug: string | null = null;
let installedSlug: string | null = null;
let capturing = false;
const memory = new Map<string, string>();
const COOLDOWN = 14 * 24 * 60 * 60 * 1000;

function notify() { subscribers.forEach((fn) => fn()); }
export function captureGuestInstallPrompt(): void {
  if (capturing) return;
  capturing = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    const slug = window.location.pathname.match(/^\/([a-z0-9][a-z0-9-]{1,38}[a-z0-9])\//)?.[1];
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!slug || !manifest?.href.includes(`/api/public/tenants/${slug}/manifest.webmanifest`) ||
        new URLSearchParams(window.location.search).has("preview")) return;
    event.preventDefault();
    promptEvent = event as InstallPromptEvent;
    promptSlug = slug;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installedSlug = pendingInstallSlug ??
      window.location.pathname.match(/^\/([a-z0-9][a-z0-9-]{1,38}[a-z0-9])\//)?.[1] ?? null;
    pendingInstallSlug = null;
    promptEvent = null;
    promptSlug = null;
    notify();
  });
}

function read(key: string): string | null {
  try { return localStorage.getItem(key) ?? memory.get(key) ?? null; }
  catch { return memory.get(key) ?? null; }
}
function write(key: string, value: string): void {
  memory.set(key, value);
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

export function useGuestInstall(slug: string, enabled: boolean) {
  const [, refresh] = useState(0);
  const [promptError, setPromptError] = useState(false);
  useEffect(() => {
    const update = () => refresh((value) => value + 1);
    subscribers.add(update);
    const displayMode = window.matchMedia("(display-mode: standalone)");
    displayMode.addEventListener("change", update);
    return () => {
      subscribers.delete(update);
      displayMode.removeEventListener("change", update);
    };
  }, []);
  const standalone = installedSlug === slug || window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const iosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const ios = iosDevice && /Safari/.test(navigator.userAgent) &&
    !/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(navigator.userAgent);
  const key = `smart360-install:${slug}:${ios ? "ios" : "chromium"}`;
  const previous = read(key);
  const hidden = ios ? previous === "dismissed" :
    previous !== null && Number.isFinite(Number(previous)) && Date.now() - Number(previous) < COOLDOWN;
  const mode = !enabled || standalone || hidden ? null :
    ios ? "ios" : (promptEvent && promptSlug === slug) || promptError ? "chromium" : null;
  const dismiss = () => {
    write(key, ios ? "dismissed" : String(Date.now()));
    refresh((value) => value + 1);
  };
  const install = async () => {
    const event = promptSlug === slug ? promptEvent : null;
    if (!event) return;
    promptEvent = null;
    promptSlug = null;
    pendingInstallSlug = slug;
    setPromptError(false);
    notify();
    // Call synchronously from the click handler, before the first await:
    // Chromium requires transient user activation for this native prompt.
    // Attach a rejection handler to userChoice *before* awaiting prompt(); a
    // browser may reject both promises in the same microtask.
    const choicePromise = event.userChoice.catch(() => null);
    try {
      await event.prompt();
      const choice = await choicePromise;
      if (!choice) throw new Error("Install choice unavailable");
      if (choice.outcome === "dismissed") {
        pendingInstallSlug = null;
        dismiss();
      }
    } catch {
      pendingInstallSlug = null;
      // Consumed prompts cannot be retried without another browser event.
      // Keep the card with an honest browser-menu instruction, not a false
      // installed state or an unhandled promise rejection.
      setPromptError(true);
    }
  };
  return { mode, dismiss, install, promptError, canPrompt: !!promptEvent && promptSlug === slug };
}