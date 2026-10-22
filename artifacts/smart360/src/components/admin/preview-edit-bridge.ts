import { useEffect, useRef } from "react";
import type { PreviewNode, PreviewResolution, PreviewTarget } from "@/lib/preview-edit-resolver";
import { contactFieldFromHref, tooltipText } from "@/lib/preview-edit-resolver";
import { capturePreviewAnchor } from "./preview-selection-anchor";

/** Draft announcements are read through the authenticated admin endpoint only
 * inside this admin-owned preview. Public guest requests are never changed. */
export function usePreviewAnnouncements(iframe: HTMLIFrameElement | null, loadTick: number, tenantId: string, slug: string, enabled: boolean) {
  useEffect(() => {
    const win = iframe?.contentWindow;
    if (!enabled || !win || !slug || !tenantId) return;
    try { if (win.location.origin !== window.location.origin) return; } catch { return; }
    const original = win.fetch;
    const bridge: typeof fetch = (input, init) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(raw, win.location.href);
      const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
      if (url.origin === window.location.origin && url.pathname === `/api/guest/${encodeURIComponent(slug)}/announcements` && method.toUpperCase() === "GET") {
        return window.fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/announcements`, { credentials: "include", signal: init?.signal });
      }
      return original.call(win, input, init);
    };
    win.fetch = bridge;
    return () => { if (win.fetch === bridge) win.fetch = original; };
  }, [iframe, loadTick, tenantId, slug, enabled]);
}

/**
 * Admin-only bridge into the same-origin guest preview iframe. It attaches
 * capture listeners to the iframe window and injects its own overlay node;
 * nothing in the guest bundle knows about it. Everything is removed on
 * toggle, iframe reload and unmount.
 */

const OVERLAY_ID = "s360-admin-preview-edit-overlay";
const PROP_KEYS = ["item", "category", "section", "announcement", "row", "entry", "card", "tile", "cat"];
const ID_PROP_KEYS = ["itemId", "categoryId", "sectionId", "announcementId"];

type AnyFiber = { key?: unknown; type?: unknown; memoizedProps?: Record<string, unknown> | null; return?: AnyFiber | null };

function fiberOf(el: Element): AnyFiber | null {
  for (const key in el) {
    if (key.startsWith("__reactFiber$")) return (el as unknown as Record<string, AnyFiber>)[key] ?? null;
  }
  return null;
}

function collectFromProps(props: Record<string, unknown> | null | undefined, ids: string[], sectionKeys: string[]) {
  if (!props || typeof props !== "object") return;
  for (const key of PROP_KEYS) {
    const value = props[key] as { id?: unknown; key?: unknown } | undefined;
    if (value && typeof value === "object") {
      if (typeof value.id === "string") ids.push(value.id);
      if (key === "section" && typeof value.key === "string") sectionKeys.push(value.key);
    }
  }
  for (const key of ID_PROP_KEYS) {
    if (typeof props[key] === "string") ids.push(props[key] as string);
  }
}

/** React keys and data props owned by this host element (up to the next host). */
function reactRefs(el: Element) {
  const ids: string[] = [];
  const sectionKeys: string[] = [];
  let bulletList = false;
  const fiber = fiberOf(el);
  if (!fiber) return { ids, sectionKeys, bulletList };
  if (typeof fiber.key === "string") ids.push(fiber.key);
  let parent = fiber.return ?? null;
  let steps = 0;
  while (parent && typeof parent.type !== "string" && steps < 14) {
    if (typeof parent.key === "string") ids.push(parent.key);
    collectFromProps(parent.memoizedProps, ids, sectionKeys);
    if (Array.isArray(parent.memoizedProps?.bullets)) bulletList = true;
    parent = parent.return ?? null;
    steps++;
  }
  return { ids, sectionKeys, bulletList };
}

export function describeChain(start: Element): { nodes: PreviewNode[]; elements: Element[] } {
  const nodes: PreviewNode[] = [];
  const elements: Element[] = [];
  let el: Element | null = start;
  while (el && el.tagName !== "HTML" && nodes.length < 60) {
    const style = el.ownerDocument.defaultView?.getComputedStyle(el);
    const refs = reactRefs(el);
    nodes.push({
      tag: el.tagName,
      testId: el.getAttribute("data-testid"),
      href: el.getAttribute("href"),
      className: typeof el.className === "string" ? el.className : el.getAttribute("class"),
      isImage: Boolean(style && style.backgroundImage && style.backgroundImage !== "none" && el.tagName !== "BODY"),
      ids: refs.ids,
      sectionKeys: refs.sectionKeys,
      bulletList: refs.bulletList,
    });
    elements.push(el);
    el = el.parentElement;
  }
  return { nodes, elements };
}

const FIELD_SELECTORS: Record<string, string> = {
  media: "img, video, [class*=\"hero-image\"], [class*=\"photo\"]",
  title: "h1, h2, [class*=\"title\"]",
  bullets: "[class*=\"bullet\"], [class*=\"rule-row\"], [class*=\"lg2-step\"]",
  body: "[class*=\"body\"], [class*=\"rich\"], [class*=\"desc\"], [class*=\"prose\"], p",
  price: "[class*=\"price\"]",
  phone: "a[href^=\"tel:\"]",
};

function visible(el: Element | null | undefined): el is Element {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/**
 * Re-find an element for a persisted target after the iframe reloads. On an
 * entry's detail route the semantic field is re-resolved from the route (not
 * only from test ids); elsewhere React keys/props are matched by record id.
 */
export function findElementForTarget(doc: Document, target: PreviewTarget): Element | null {
  if (target.kind === "weather") return doc.querySelector('[data-testid="card-home-weather"]');
  if (target.kind === "appearance") {
    const selector = target.part === "logo" ? '[class*="logo"]'
      : target.part === "hero" ? '[class*="hero-image"], [class*="cover-photo"], [class*="hero"]'
      : '[data-testid="screen-cover"], [data-testid="screen-simple-cover"], [data-testid="screen-home"], [data-testid="screen-simple-home"]';
    return doc.querySelector(selector);
  }
  if (target.kind === "wifi") return doc.querySelector('[data-testid="button-home-wifi"]');
  if (target.kind === "announcement") {
    return target.id ? doc.querySelector(`[data-testid="card-announcement-${CSS.escape(target.id)}"]`) : doc.querySelector('[data-testid="button-home-announcements"]');
  }
  if (target.kind === "contact") {
    return Array.from(doc.querySelectorAll("a[href]")).find((a) => contactFieldFromHref(a.getAttribute("href")) === target.field) ?? null;
  }
  const id = target.id;
  const pathname = doc.defaultView?.location.pathname ?? "";
  if (target.kind === "item" && pathname.split("/").map((p) => { try { return decodeURIComponent(p); } catch { return p; } }).includes(id)) {
    const selector = target.field ? FIELD_SELECTORS[target.field] : null;
    const field = selector ? Array.from(doc.querySelectorAll(selector)).find((el) => visible(el) && !el.closest(`#${OVERLAY_ID}`)) : null;
    if (field) return field;
    const screen = Array.from(doc.querySelectorAll('[data-detail-open="true"] h1, [data-testid="program-detail"], main h1, h1')).find(visible);
    if (screen) return screen;
  }
  const byTestId = doc.querySelector(`[data-testid$="-${CSS.escape(id)}"]`);
  if (visible(byTestId)) return byTestId;
  const all = doc.body?.querySelectorAll("*") ?? [];
  let propMatch: Element | null = null;
  for (let i = 0; i < all.length && i < 6000; i++) {
    const el = all[i]!;
    const fiber = fiberOf(el);
    if (!fiber) continue;
    if (fiber.key === id || (typeof fiber.key === "string" && fiber.key.startsWith(`${id}-`))) {
      if (visible(el)) return el;
    }
    // Props match: outermost visible element whose owning components carry the id.
    if (!propMatch && visible(el) && reactRefs(el).ids.includes(id)) propMatch = el;
  }
  return propMatch;
}

function ensureOverlay(doc: Document) {
  let root = doc.getElementById(OVERLAY_ID);
  if (!root) {
    root = doc.createElement("div");
    root.id = OVERLAY_ID;
    root.setAttribute("aria-hidden", "true");
    root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483646;";
    root.innerHTML =
      '<div data-s360="hover" style="position:fixed;display:none;border:2px dashed #157347;border-radius:8px;background:rgba(21,115,71,.06);transition:transform .08s,width .08s,height .08s;"></div>' +
      '<div data-s360="selected" style="position:fixed;display:none;border:3px solid #157347;border-radius:10px;box-shadow:0 0 0 4px rgba(21,115,71,.18);"></div>' +
      '<div data-s360="tip" style="position:fixed;display:none;max-width:320px;padding:6px 10px;border-radius:8px;background:#14201F;color:#F4F6F2;font:600 13px/1.3 Archivo,system-ui,sans-serif;white-space:normal;"></div>';
    // Attach to <html>, not <body>: a transformed body (Trend sheets) would
    // otherwise become the containing block of the fixed overlay.
    doc.documentElement.appendChild(root);
  }
  return {
    hover: root.querySelector<HTMLElement>('[data-s360="hover"]')!,
    selected: root.querySelector<HTMLElement>('[data-s360="selected"]')!,
    tip: root.querySelector<HTMLElement>('[data-s360="tip"]')!,
    root,
  };
}

function place(box: HTMLElement, el: Element | null) {
  if (!el || !el.isConnected) { box.style.display = "none"; return null; }
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) { box.style.display = "none"; return null; }
  box.style.display = "block";
  box.style.left = `${r.left - 2}px`;
  box.style.top = `${r.top - 2}px`;
  box.style.width = `${r.width + 4}px`;
  box.style.height = `${r.height + 4}px`;
  return r;
}

export function usePreviewEditBridge({
  iframe,
  loadTick,
  enabled,
  resolve,
  onSelect,
  selected,
}: {
  iframe: HTMLIFrameElement | null;
  loadTick: number;
  enabled: boolean;
  resolve: (nodes: PreviewNode[], pathname: string) => PreviewResolution | null;
  onSelect: (resolution: PreviewResolution | null) => void;
  selected: PreviewTarget | null;
}) {
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const anchorRef = useRef<ReturnType<typeof capturePreviewAnchor> | null>(null);
  const pendingRef = useRef<{ key: string; anchor: ReturnType<typeof capturePreviewAnchor> } | null>(null);
  useEffect(() => {
    if (!selected) {
      anchorRef.current = null;
      pendingRef.current = null;
    }
  }, [selected]);

  useEffect(() => {
    if (!enabled || !iframe) return;
    let doc: Document | null = null;
    let win: Window | null = null;
    try {
      doc = iframe.contentDocument;
      win = iframe.contentWindow;
    } catch {
      return; // not same-origin: nothing to attach
    }
    if (!doc || !win || !doc.body) return;
    const overlay = ensureOverlay(doc);
    const cursorStyle = doc.createElement("style");
    cursorStyle.textContent = "html,body,body *{cursor:crosshair !important;}";
    doc.head?.appendChild(cursorStyle);
    let hoverEl: Element | null = null;
    let hoverResolution: PreviewResolution | null = null;
    let frame = 0;

    const sourceElement = (target: Element) => {
      const { nodes } = describeChain(target);
      const resolution = resolveRef.current(nodes, win!.location.pathname);
      // Nested SVG paths/text belong to the visible interactive tile/contact
      // row, not to an arbitrary React data-owner container.
      const el = target.closest('[data-testid^="tile-"], a[href]')
        ?? target.closest("h1,h2,h3,h4,p,li,img,video")
        ?? target;
      return { resolution, el };
    };

    const paint = () => {
      const r = place(overlay.hover, hoverEl);
      if (r) {
        overlay.tip.style.display = "block";
        overlay.tip.textContent = tooltipText(hoverResolution);
        overlay.tip.style.background = hoverResolution?.allowed === false || !hoverResolution ? "#6B3A2E" : "#14201F";
        const top = r.top > 40 ? r.top - 34 : r.bottom + 8;
        overlay.tip.style.left = `${Math.max(6, Math.min(r.left, win!.innerWidth - 330))}px`;
        overlay.tip.style.top = `${top}px`;
      } else {
        overlay.tip.style.display = "none";
      }
      if (selectedRef.current) {
        if (pendingRef.current?.key === JSON.stringify(selectedRef.current)) {
          anchorRef.current = pendingRef.current.anchor;
          pendingRef.current = null;
        }
        place(overlay.selected, doc!.querySelector(".guest-entry-splash")
          ? null : anchorRef.current?.resolve(doc!) ?? null);
      } else {
        overlay.selected.style.display = "none";
      }
      frame = win!.requestAnimationFrame(paint);
    };
    frame = win.requestAnimationFrame(paint);

    const onMove = (event: Event) => {
      const target = event.target as Element | null;
      if (!target || target.nodeType !== 1 || overlay.root.contains(target)) return;
      if (target.closest(".guest-entry-splash")) { hoverEl = null; hoverResolution = null; return; }
      const found = sourceElement(target);
      hoverEl = found.el;
      hoverResolution = found.resolution;
    };
    const onLeave = () => { hoverEl = null; hoverResolution = null; };
    const choose = (target: Element) => {
      // The entry splash covers the already-mounted detail during reload.
      // Its route is not evidence that the user clicked an editable field.
      if (target.closest(".guest-entry-splash")) return;
      const found = sourceElement(target);
      if (found.resolution?.allowed) {
        // Reuse the hovered DOM anchor, not the resolver's data-source ancestor.
        const anchor = capturePreviewAnchor(hoverEl === found.el ? hoverEl : found.el);
        pendingRef.current = { key: JSON.stringify(found.resolution.target), anchor };
      }
      onSelectRef.current(found.resolution);
    };
    // Block guest navigation/gestures before any guest handler runs.
    const block = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    const onClick = (event: Event) => {
      block(event);
      const target = event.target as Element | null;
      if (target && target.nodeType === 1) choose(target);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const active = doc!.activeElement;
      if (!active || active === doc!.body) return;
      block(event);
      choose(active);
    };
    const blocked = ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend", "dblclick", "submit", "auxclick", "contextmenu"];
    win.addEventListener("click", onClick, true);
    win.addEventListener("keydown", onKey, true);
    for (const type of blocked) win.addEventListener(type, block, { capture: true, passive: false });
    doc.addEventListener("mouseover", onMove, true);
    doc.addEventListener("mouseleave", onLeave, true);

    return () => {
      win!.cancelAnimationFrame(frame);
      win!.removeEventListener("click", onClick, true);
      win!.removeEventListener("keydown", onKey, true);
      for (const type of blocked) win!.removeEventListener(type, block, { capture: true });
      doc!.removeEventListener("mouseover", onMove, true);
      doc!.removeEventListener("mouseleave", onLeave, true);
      overlay.root.remove();
      cursorStyle.remove();
    };
  }, [iframe, loadTick, enabled]);
}
