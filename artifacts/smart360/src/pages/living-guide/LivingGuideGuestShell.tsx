import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  getListDeviceOrdersQueryKey,
  useListDeviceOrders,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { getOpenStatus } from "@/lib/hours";
import { sanitizeHtml } from "@/lib/sanitize";
import { resolveTenantMapsUrl } from "@/lib/tenant-maps";
import { itemMapsHref } from "@/lib/maps-href";
import { beginGuestActivity, endGuestActivity } from "@/lib/bundle-freshness";
import {
  CARD_IMAGE_WIDTH,
  HERO_IMAGE_WIDTH,
  imgSrc,
  mediaImgSrc,
} from "../guest/img";
import { buildGuestPath } from "../guest/guest-url";
import {
  makeT,
  type UiLanguage,
  type UiTranslator,
} from "../guest/i18n";
import { LivingGuideSprite } from "./LivingGuideSprite";
import { livingGuideInterWoff2 } from "./inter-font-source";
import {
  isLivingTheme,
  type LivingTheme,
  useLivingTheme,
} from "./theme-clock";
import { LivingGuideSearchSheet } from "./LivingGuideSearchSheet";
import { LivingGuideLanguageSheet } from "./LivingGuideLanguageSheet";
import {
  itemDistanceText,
  itemPriceText,
  itemSupportingText,
  normalizeGuestMedia,
} from "./living-guide-formatters";
import {
  calculateLivingGuideHeroLayout,
  calculateLivingGuideUniformGalleryLayout,
  stableMediaAspect,
  nearestGalleryIndex,
} from "./living-guide-hero-layout";
import "./living-guide-tokens.css";
import "./living-guide-guest.css";
import { OrderSheet, MyOrdersSheet } from "./living-guide-order-sheet";
import { MessagesView } from "./living-guide-messages";
import {
  forgetRememberedOrderPassword,
  getDeviceToken,
  getRememberedGuestIdentity,
  getRememberedOrderPassword,
  rememberGuestIdentity,
  rememberOrderPassword,
} from "./living-guide-orders";
import { virtualTourEmbedUrl } from "@/lib/virtual-tour";
import { instagramLink, viberHref } from "@/lib/contact-links";
import {
  findDatedEventDestination as datedEventDestination,
  getLivingGuideAvailableFeatures,
  resolveLivingGuideNav,
  shouldShowLivingGuideBottomNav,
  type NavState,
} from "./living-guide-nav-resolver";
import {
  nudgeTodayStrip,
  resolveHomeHeroMedia,
  selectHomeTodayEntries,
} from "./living-guide-home";
import { SiteMapGuestView } from "./SiteMapGuestView";
import { MoreGuestView } from "./MoreGuestView";
import {
  activeExploreCategories,
  EXPLORE_ALL_CATEGORY_KEY,
  exploreItemDescription,
  exploreItemsForCategory,
  groupExploreItemsByDistance,
  suppressesGuestDescription,
} from "./living-guide-explore";
import {
  OFFER_GROUPS,
  STAY_GROUPS,
  populatedSectionGroups,
} from "./living-guide-groups";

type GuestRecord = {
  unit: string;
  name: string;
  phone: string;
};

type ScreenName = "cover" | "home" | "grid" | "detail" | "explore" | "messages" | "site-map" | "more";
type LivingGuidePresentation = "standard" | "tab" | "detail";
type DetailTransitionPhase =
  | "idle"
  | "preparing"
  | "armed"
  | "open"
  | "closing"
  | "restoring";
type LivingGuideScrollSnapshot = {
  scrollTops: number[];
  galleryScrollLefts: number[];
  galleryIndex: number;
};
type HeldRouteSurface = {
  surface: HTMLElement;
  bottomNav: HTMLElement | null;
};

const MAX_HELD_VIEW_DEPTH = 2;
const HELD_LIVE_STATE_SELECTOR =
  "form,input,textarea,select,[contenteditable='true'],video,audio";
const HELD_ACTIVE_EMBED_SELECTOR =
  "iframe,video,audio,object,embed,source,track,script,link";

function nextPaintFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function detailVisualSignature(sheet: HTMLElement): string | null {
  const panel = sheet.querySelector<HTMLElement>(".lg2-detail-sheet");
  const hero = sheet.querySelector<HTMLElement>(".lg2-detail-hero");
  const photoHero = sheet.querySelector<HTMLElement>(
    ".lg2-detail-hero--photo",
  );
  const grabber = panel?.querySelector<HTMLElement>(".lg2-grabber") ?? null;
  const slides = [
    ...sheet.querySelectorAll<HTMLElement>(".lg2-gallery-slide"),
  ];
  const dots = [
    ...sheet.querySelectorAll<HTMLElement>(".lg2-gallery-dots i"),
  ];
  const title = sheet.querySelector<HTMLElement>(
    "h1, h2, [data-lg-detail-title]",
  );

  if (!title || !hero) return null;
  if (photoHero && photoHero.dataset.lgHeroLayoutReady !== "true") return null;
  if (
    panel &&
    !panel.classList.contains("lg2-detail-sheet--solo") &&
    !grabber
  ) {
    return null;
  }
  if (slides.length > 1 && dots.length !== slides.length) return null;

  const sheetStyle = getComputedStyle(sheet);
  if (
    Number.parseFloat(sheetStyle.borderTopLeftRadius) !== 0 ||
    Number.parseFloat(sheetStyle.borderTopRightRadius) !== 0
  ) {
    return null;
  }

  const rectValue = (element: HTMLElement | null) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      x: Number(rect.x.toFixed(3)),
      y: Number(rect.y.toFixed(3)),
      width: Number(rect.width.toFixed(3)),
      height: Number(rect.height.toFixed(3)),
      borderTopLeftRadius: style.borderTopLeftRadius,
      borderTopRightRadius: style.borderTopRightRadius,
      display: style.display,
      visibility: style.visibility,
    };
  };

  return JSON.stringify({
    panel: rectValue(panel),
    hero: rectValue(hero),
    grabber: rectValue(grabber),
    dots: dots.map((dot) => rectValue(dot)),
    images: [
      ...sheet.querySelectorAll<HTMLImageElement>(
        ".lg2-gallery-slide:first-child .lg2-hero-image-main",
      ),
    ].map((image) => ({
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      confirmed: image.dataset.lgDimensionsConfirmed ?? null,
    })),
  });
}

async function waitForDetailVisualReadiness(
  sheet: HTMLElement,
  isCancelled: () => boolean,
): Promise<boolean> {
  await document.fonts.ready;
  const firstScreenImages = [
    ...sheet.querySelectorAll<HTMLImageElement>(
      ".lg2-gallery-slide:first-child .lg2-hero-image-main",
    ),
  ];
  await Promise.all(
    firstScreenImages.map((image) => image.decode().catch(() => undefined)),
  );
  let previousSignature: string | null = null;
  let stableFrames = 0;
  while (!isCancelled() && sheet.isConnected) {
    await nextPaintFrame();
    const signature = detailVisualSignature(sheet);
    if (signature && signature === previousSignature) {
      stableFrames += 1;
      if (stableFrames >= 2) return true;
    } else {
      previousSignature = signature;
      stableFrames = signature ? 1 : 0;
    }
  }
  return false;
}

function selfAndDescendants(
  root: HTMLElement,
  selector: string,
): HTMLElement[] {
  return [
    ...(root.matches(selector) ? [root] : []),
    ...root.querySelectorAll<HTMLElement>(selector),
  ];
}

function hasSelfOrDescendant(root: HTMLElement, selector: string): boolean {
  return root.matches(selector) || Boolean(root.querySelector(selector));
}

function sanitizeHeldClone(source: HTMLElement, clone: HTMLElement): boolean {
  // A detached visual clone must never become a second owner of live state.
  if (hasSelfOrDescendant(source, HELD_LIVE_STATE_SELECTOR)) return false;

  const sourceEmbeds = selfAndDescendants(source, HELD_ACTIVE_EMBED_SELECTOR);
  selfAndDescendants(clone, HELD_ACTIVE_EMBED_SELECTOR).forEach(
    (element, index) => {
      const placeholder = document.createElement("div");
      const sourceElement = sourceEmbeds[index];
      const rect = sourceElement?.getBoundingClientRect();
      placeholder.className = "lg2-held-embed-placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      if (rect?.height) placeholder.style.height = `${rect.height}px`;
      element.replaceWith(placeholder);
    },
  );

  selfAndDescendants(clone, "[id]").forEach((element) => {
    element.removeAttribute("id");
  });
  selfAndDescendants(
    clone,
    "[for],[aria-labelledby],[aria-describedby],[aria-controls],[aria-owns]",
  ).forEach((element) => {
    element.removeAttribute("for");
    element.removeAttribute("aria-labelledby");
    element.removeAttribute("aria-describedby");
    element.removeAttribute("aria-controls");
    element.removeAttribute("aria-owns");
  });
  return true;
}

function visible(rows: any[] | null | undefined): any[] {
  return (rows ?? []).filter((row) => row.isVisible !== false);
}

function RichInline({ value }: { value: unknown }) {
  if (typeof value !== "string" || !value.trim()) return null;
  return <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }} />;
}

function adminTreeTenant(tenant: any): any {
  const expose = (row: any) => ({
    ...row,
    __adminInactive: row.isVisible === false,
    isVisible: true,
  });
  return {
    ...tenant,
    sections: (tenant?.sections ?? []).map((section: any) => ({
      ...expose(section),
      categories: (section.categories ?? []).map((category: any) => ({
        ...expose(category),
        __adminStructurePreview: true,
        items: (category.items ?? []).map(expose),
      })),
    })),
  };
}

function adminCategoryNote(category: any): string | null {
  if (!category?.__adminStructurePreview) return null;
  if (category?.__adminInactive) return "Neaktivna kategorija";
  return visible(category?.items).length === 0 ? "čaka vsebino" : null;
}

function bodyHtml(body: string | null | undefined): string {
  if (!body) return "";
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((part): part is string => typeof part === "string" && !!part.trim())
        .map((part) => `<p>${sanitizeHtml(part)}</p>`)
        .join("");
    }
  } catch {}
  return sanitizeHtml(body);
}

function normalizeDisplayText(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").toLocaleLowerCase()
    : "";
}

function distinctSubtitle(
  title: unknown,
  subtitle: unknown,
): string | null {
  if (typeof subtitle !== "string" || !subtitle.trim()) return null;
  const cleanSubtitle = subtitle.trim();
  return normalizeDisplayText(cleanSubtitle) === normalizeDisplayText(title)
    ? null
    : cleanSubtitle;
}

function standaloneBodyBullets(body: unknown): string[] {
  if (typeof body !== "string" || !body.trim()) return [];
  const cleanBody = body.trim();
  const lines = cleanBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (
    lines.length > 0 &&
    lines.every((line) => /^(?:[-*•]|\d+[.)])\s+/.test(line))
  ) {
    return lines.map((line) =>
      line.replace(/^(?:[-*•]|\d+[.)])\s+/, "").trim(),
    );
  }

  const sanitized = sanitizeHtml(cleanBody);
  if (!/^<ul(?:\s[^>]*)?>[\s\S]*<\/ul>$/i.test(sanitized)) return [];
  const items = Array.from(sanitized.matchAll(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi))
    .map((match) =>
      match[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  return items;
}

function itemBullets(item: any, category?: any): string[] {
  const explicit = Array.isArray(item?.bullets)
    ? item.bullets.filter(
        (bullet: unknown): bullet is string =>
          typeof bullet === "string" && !!bullet.trim(),
      )
    : [];
  return explicit.length > 0
    ? explicit.map((bullet: string) => bullet.trim())
    : standaloneBodyBullets(item?.body);
}

function itemBodyHtml(item: any, category?: any): string {
  return standaloneBodyBullets(item?.body).length > 0
    ? ""
    : bodyHtml(item?.body);
}

function StructuredBulletRows({
  bullets,
  numbered = false,
}: {
  bullets: string[];
  numbered?: boolean;
}) {
  if (bullets.length === 0) return null;
  if (numbered) {
    return (
      <div className="lg2-steps">
        {bullets.map((bullet, index) => (
          <div className="lg2-step" key={`${index}-${bullet}`}>
            <span className="lg2-step-number">{index + 1}</span>
            <p>{bullet}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="lg2-rule-list lg2-bullet-rules">
      {bullets.map((bullet, index) => (
        <div className="lg2-rule-row" key={`${index}-${bullet}`}>
          <span className="lg2-rule-icon" aria-hidden="true">
            <svg><use href="#lg-i-doc" /></svg>
          </span>
          <p>{bullet}</p>
        </div>
      ))}
    </div>
  );
}

function firstMedia(category: any): any | null {
  for (const item of visible(category?.items)) {
    const media = normalizeGuestMedia(item.media)[0];
    if (media) return media;
  }
  return null;
}

function itemOpenStatus(
  item: any,
  t: UiTranslator,
): { text: string; isOpen: boolean } | null {
  if (item?.open24) {
    return { text: t("UI.lg.hours.alwaysValue"), isOpen: true };
  }
  const status = getOpenStatus(item?.hoursJson);
  if (!status) return null;
  const closedText = status.opensAt
    ? `${t("UI.lg.hours.closed")} · ${t("UI.lg.hours.opensAt")} ${status.opensAt}`
    : t("UI.lg.hours.closed");
  return {
    text:
      status.isOpen && status.closesAt
        ? `${t("UI.lg.hours.openUntil")} ${status.closesAt}`
        : closedText,
    isOpen: status.isOpen,
  };
}

function categoryMedia(category: any): any[] {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const item of visible(category?.items)) {
    for (const media of normalizeGuestMedia(item.media)) {
      const key = `${media.kind ?? "image"}:${media.url ?? media.posterUrl ?? ""}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(media);
    }
  }
  return result;
}

const DETAIL_SHELL_MAX_WIDTH = 430;

function detailHeroMedia(category: any, itemId: string | null): any[] {
  const items = visible(category?.items);
  const activeItem = itemId
    ? items.find((item: any) => item.id === itemId)
    : null;
  if (activeItem) return normalizeGuestMedia(activeItem.media);

  const layout = category?.layout ?? "";
  if (layout === "tabs" && items.length === 2) {
    return normalizeGuestMedia(items[0]?.media);
  }
  if (
    layout === "tabs" ||
    layout === "apartments" ||
    layout === "products" ||
    layout === "poi" ||
    layout === "routes" ||
    layout === "events"
  ) {
    const media = firstMedia(category);
    return media ? [media] : [];
  }
  return categoryMedia(category);
}

function detailHeroHeight(media: any[]): number {
  const frameWidth =
    typeof window === "undefined"
      ? 390
      : Math.min(window.innerWidth, DETAIL_SHELL_MAX_WIDTH);
  const viewportHeight =
    typeof window === "undefined" ? 844 : window.innerHeight;

  if (media.length > 1) {
    const galleryLayout = calculateLivingGuideUniformGalleryLayout({
      containerWidth: frameWidth,
      imageAspects: media.map(
        (entry: any) => stableMediaAspect(entry.width, entry.height).aspect,
      ),
      viewportHeight,
    });
    if (galleryLayout) return galleryLayout.heroHeight;
  }

  const entry = media[0];
  const layout = calculateLivingGuideHeroLayout({
    containerWidth: frameWidth,
    imageAspect: stableMediaAspect(entry?.width, entry?.height).aspect,
    viewportHeight,
  });
  return layout?.heroHeight ?? 1;
}

function categoryIcon(category: any): string {
  const firstItem = visible(category?.items)[0];
  if (category?.layout === "wifi") return "wifi";
  if (category?.layout === "apartments") return "bed";
  if (category?.layout === "products") return "bag";
  if (category?.layout === "poi" || category?.layout === "routes") return "pin";
  if (category?.layout === "events") return "cal";
  if (category?.layout === "tabs") return "tool";
  if (firstItem?.phone) return "phone";
  if (firstItem?.hoursJson || firstItem?.open24) return "clk";
  if (firstItem?.mapQuery) return "pin";
  return "doc";
}

function isOperationalRulesCategory(category: any): boolean {
  if (category?.layout !== "rules") return false;
  const items = visible(category.items);
  if (items.some((item: any) => item.hoursJson || item.open24)) return true;
  const firstItem = items[0];
  return !!firstItem?.title && !firstItem?.tint;
}

function enabledLanguageCodes(tenant: any): string[] {
  const enabled = new Set(
    (tenant?.languages ?? [])
      .map((entry: any) => (typeof entry === "string" ? entry : entry?.code))
      .filter((entry: unknown): entry is string => typeof entry === "string"),
  );
  return ["sl", "en", "de", "it"].filter(
    (code) => code === "sl" || enabled.has(code),
  );
}

function externalUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function imageStyle(media: any, tenantOverride?: any): CSSProperties | undefined {
  if (tenantOverride) {
    const focusX = tenantOverride.heroFocusX ?? media?.focusX ?? 50;
    const focusY = tenantOverride.heroFocusY ?? media?.focusY ?? 50;
    return { objectPosition: `${focusX}% ${focusY}%` };
  }
  if (!media) return undefined;
  return {
    objectPosition: `${media.focusX ?? 50}% ${media.focusY ?? 50}%`,
  };
}

function noticeTimestamp(notice: any): number | null {
  const value = notice?.publishedAt ?? notice?.createdAt;
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function noticeDayGroup(notice: any): "today" | "yesterday" | "older" {
  const timestamp = noticeTimestamp(notice);
  if (timestamp === null) return "older";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const noticeDate = new Date(timestamp);
  const noticeDay = new Date(
    noticeDate.getFullYear(),
    noticeDate.getMonth(),
    noticeDate.getDate(),
  ).getTime();
  const difference = Math.round((today - noticeDay) / 86_400_000);
  if (difference === 0) return "today";
  if (difference === 1) return "yesterday";
  return "older";
}

function isNewNotice(notice: any): boolean {
  const timestamp = noticeTimestamp(notice);
  if (timestamp === null) return false;
  const age = Date.now() - timestamp;
  return age >= 0 && age < 72 * 60 * 60 * 1000;
}

function minutesUntilClock(clock: string | null, now = new Date()): number {
  if (!clock) return Number.POSITIVE_INFINITY;
  const [hours, minutes] = clock.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.POSITIVE_INFINITY;
  }
  let delta =
    hours * 60 + minutes - (now.getHours() * 60 + now.getMinutes());
  if (delta <= 0) delta += 24 * 60;
  return delta;
}

export default function LivingGuideGuestShell({
  tenant,
  slug,
  lang,
  adminFullTree = false,
  onLanguageChange,
  onReady,
}: {
  tenant: any;
  slug: string;
  lang: string;
  adminFullTree?: boolean;
  onLanguageChange: (lang: string) => void;
  onReady?: () => void;
}) {
  const [location, setLocation] = useLocation();
  tenant = useMemo(
    () => (adminFullTree ? adminTreeTenant(tenant) : tenant),
    [adminFullTree, tenant],
  );
  const requestedTheme = new URLSearchParams(window.location.search).get("theme");
  const themeOverride: LivingTheme | undefined =
    import.meta.env.DEV && isLivingTheme(requestedTheme)
      ? requestedTheme
      : undefined;
  // Real-sun themes: tenant coordinates (derived from the pasted Maps link)
  // drive dawn/sunrise/sunset/dusk; tenants without coordinates keep the
  // fixed-hour clock (handled inside the hook — never crashes).
  const theme = useLivingTheme(themeOverride, {
    latitude: tenant?.latitude ?? null,
    longitude: tenant?.longitude ?? null,
  });
  const t = makeT(tenant, lang);
  const rootRef = useRef<HTMLDivElement>(null);
  const heldLayerRef = useRef<HTMLDivElement>(null);
  const heldViewStackRef = useRef<HeldRouteSurface[]>([]);
  const routeScrollSnapshotsRef = useRef(
    new Map<string, LivingGuideScrollSnapshot>(),
  );
  const compactHistoryAfterCloseRef = useRef(false);
  const closeTransitionCleanupRef = useRef<(() => void) | null>(null);
  const closeSourceLocationRef = useRef<string | null>(null);
  const detailSourceLocationRef = useRef<string | null>(null);
  const detailSourceScrollRef = useRef<{
    element: HTMLElement;
    scrollTop: number;
  } | null>(null);
  const detailTriggerSelectorRef = useRef<string | null>(null);
  const restoreDetailFocusRef = useRef(false);
  const [detailTransitionPhase, setDetailTransitionPhase] =
    useState<DetailTransitionPhase>("idle");
  const [suppressRouteEntryAnimation, setSuppressRouteEntryAnimation] =
    useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const sections = useMemo(() => visible(tenant?.sections), [tenant?.sections]);
  const detailHeroUrls = useMemo(() => {
    const urls = new Set<string>();
    sections.forEach((section: any) => {
      visible(section.categories).forEach((category: any) => {
        [...normalizeGuestMedia(category.media), ...visible(category.items).flatMap((item: any) => normalizeGuestMedia(item.media))]
          .forEach((entry: any) => {
            const source = mediaImgSrc(entry, HERO_IMAGE_WIDTH);
            if (source) urls.add(source);
          });
      });
    });
    return [...urls];
  }, [sections]);
  const preloadedDetailImagesRef = useRef<HTMLImageElement[]>([]);

  useEffect(() => {
    onReady?.();
  }, [onReady]);
  const allCategories = useMemo(
    () =>
      sections.flatMap((section: any) =>
        visible(section.categories).map((category: any) => ({
          category,
          section,
        })),
      ),
    [sections],
  );
  const staySection =
    sections.find((section: any) => section.key === "stay") ?? sections[0] ?? null;

  const pathParts = location.split("/").filter(Boolean);
  const routeSectionKey = pathParts[1] === "s" ? decodeURIComponent(pathParts[2] ?? "") : null;
  const routeCategoryId = pathParts[1] === "c" ? decodeURIComponent(pathParts[2] ?? "") : null;
  const routeItemId = pathParts[3] === "i" ? decodeURIComponent(pathParts[4] ?? "") : null;

  const categoryContext = routeCategoryId ? allCategories.find((entry: any) => entry.category.id === routeCategoryId) ?? null : null;
  const currentSection = categoryContext?.section ?? (routeSectionKey ? sections.find((section: any) => section.key === routeSectionKey) ?? null : staySection);

  let screen: ScreenName = "cover";
  if (pathParts[1] === "home") screen = "home";
  else if (pathParts[1] === "messages") screen = "messages";
  else if (pathParts[1] === "site-map") screen = "site-map";
  else if (pathParts[1] === "more") screen = "more";
  else if (categoryContext) screen = "detail";
  else if (routeSectionKey === "explore") screen = "explore";
  else if (routeSectionKey) screen = "grid";

  const validFeatures = useMemo(
    () => getLivingGuideAvailableFeatures(sections),
    [sections],
  );

  const sitePlanImages = visible(tenant?.sitePlanImages);
  
  const navState = useMemo(() => {
    return resolveLivingGuideNav(tenant?.livingGuideNav, validFeatures, sitePlanImages.length > 0);
  }, [tenant?.livingGuideNav, validFeatures, sitePlanImages]);
  const unavailableGuestSubroute =
    (screen === "site-map" && !navState.hasSiteMap) ||
    (screen === "more" && navState.omitted.length === 0);
  if (unavailableGuestSubroute) screen = "home";
  const detailPresentationRequested =
    window.history.state?.livingGuidePresentation === "detail";
  const canRenderDetailSheet =
    (screen === "detail" && Boolean(categoryContext)) ||
    screen === "messages" ||
    screen === "explore";
  const isDetailPresentation =
    detailPresentationRequested && canRenderDetailSheet;
  const [baseScreen, setBaseScreen] = useState<ScreenName>(() =>
    screen === "detail" ? "home" : screen,
  );
  const [baseSectionKey, setBaseSectionKey] = useState<string | null>(
    currentSection?.key ?? null,
  );
  const baseSection =
    sections.find((section: any) => section.key === baseSectionKey) ??
    currentSection;
  useLayoutEffect(() => {
    if (isDetailPresentation) return;
    setBaseScreen(screen);
    setBaseSectionKey(currentSection?.key ?? null);
    detailSourceLocationRef.current = location;
  }, [currentSection?.key, isDetailPresentation, location, screen]);
  const detailHeroHeightLockRef = useRef<{
    location: string;
    height: number;
  } | null>(null);
  if (
    screen === "detail" &&
    categoryContext &&
    detailHeroHeightLockRef.current?.location !== location
  ) {
    detailHeroHeightLockRef.current = {
      location,
      height: detailHeroHeight(
        detailHeroMedia(categoryContext.category, routeItemId),
      ),
    };
  }
  const detailRouteStyle =
    screen === "detail" &&
    detailHeroHeightLockRef.current?.location === location
      ? ({
          "--lg2-detail-hero-height": `${detailHeroHeightLockRef.current.height}px`,
        } as CSSProperties)
      : undefined;
  const detailSheetActive =
    isDetailPresentation &&
    (detailTransitionPhase === "open" ||
      (detailTransitionPhase === "restoring" &&
        closeSourceLocationRef.current !== location));

  const [guest, setGuest] = useState<GuestRecord | null>(() =>
    getRememberedGuestIdentity(slug),
  );
  const [messagePassword, setMessagePassword] = useState(() =>
    tenant.orderPasswordConfigured ? getRememberedOrderPassword(slug) : "",
  );
  const [showSignIn, setShowSignIn] = useState(false);
  const [messageAccessError, setMessageAccessError] = useState<string | null>(
    null,
  );
  const [credentialsRevision, setCredentialsRevision] = useState(0);
  const [credentialsCancelRevision, setCredentialsCancelRevision] = useState(0);
  const [pendingOrderItemId, setPendingOrderItemId] = useState<string | null>(null);
  const [showNotices, setShowNotices] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
    const [showLanguages, setShowLanguages] = useState(false);
  const [orderItemId, setOrderItemId] = useState<string | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const messagePasswordRequired = Boolean(tenant.orderPasswordConfigured);

  // Reload safety for the stale-bundle check (mounted in GuestHost): never
  // reload while an order flow or the sign-in sheet is open.
  useEffect(() => {
    const busy = Boolean(orderItemId || pendingOrderItemId || showSignIn);
    if (busy) beginGuestActivity("order-flow");
    else endGuestActivity("order-flow");
    return () => endGuestActivity("order-flow");
  }, [orderItemId, pendingOrderItemId, showSignIn]);
  const guestSignedIn = Boolean(guest?.unit.trim() && guest?.name.trim());
  const guestIdentityComplete = Boolean(
    guestSignedIn &&
    guest?.phone.trim() &&
    (guest.phone.match(/\d/g)?.length ?? 0) >= 6,
  );
  const messageAccessReady =
    guestIdentityComplete &&
    (!messagePasswordRequired || Boolean(messagePassword.trim()));

  useEffect(() => {
    // The prototype keeps every detail view in the document, so its hero
    // requests begin before a tap. Mirror that behavior while retaining React
    // routes: warm the exact detail-size sources as soon as the payload lands.
    preloadedDetailImagesRef.current = detailHeroUrls.map((source) => {
      const image = new Image();
      image.decoding = "async";
      image.src = source;
      return image;
    });
    return () => {
      preloadedDetailImagesRef.current = [];
    };
  }, [detailHeroUrls]);
  const deviceToken = useMemo(() => getDeviceToken(slug), [slug]);
  const { data: deviceOrders } = useListDeviceOrders(slug, {
    query: {
      refetchInterval: 15000,
      queryKey: getListDeviceOrdersQueryKey(slug),
    },
    request: { headers: { "x-device-token": deviceToken } },
  });
  const orderSummary = useMemo(() => {
    if (!deviceOrders?.length) return null;
    return {
      totalCount: deviceOrders.length,
      openCount: deviceOrders.filter(
        (order) => order.status === "novo" || order.status === "potrjeno",
      ).length,
    };
  }, [deviceOrders]);

  useEffect(() => {
    const previousTheme = document.documentElement.getAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme");
    document.body.setAttribute("data-t", theme);
    return () => {
      document.body.removeAttribute("data-t");
      if (previousTheme) {
        document.documentElement.setAttribute("data-theme", previousTheme);
      }
    };
  }, [theme]);

  const resetNavigationState = useCallback(() => {
    const routeView = rootRef.current?.querySelector<HTMLElement>(
      ".lg2-route-layer > .lg2-view",
    );
    if (!routeView) return;
    selfAndDescendants(routeView, "[data-lg-scroll]").forEach((element) => {
      element.scrollTop = 0;
    });
    selfAndDescendants(
      routeView,
      "[data-lg-gallery],[data-lg-scroll-x]",
    ).forEach((element) => {
      element.scrollLeft = 0;
    });
    setGalleryIndex(0);
  }, []);

  const captureRouteScroll = useCallback(() => {
    const routeView = rootRef.current?.querySelector<HTMLElement>(
      ".lg2-route-layer > .lg2-view",
    );
    if (!routeView) return;
    routeScrollSnapshotsRef.current.set(location, {
      scrollTops: selfAndDescendants(routeView, "[data-lg-scroll]").map(
        (element) => element.scrollTop,
      ),
      galleryScrollLefts: selfAndDescendants(
        routeView,
        "[data-lg-gallery],[data-lg-scroll-x]",
      ).map((element) => element.scrollLeft),
      galleryIndex,
    });
  }, [galleryIndex, location]);

  useLayoutEffect(() => {
    if (isDetailPresentation) return;
    if (detailSourceScrollRef.current?.element.isConnected) {
      return;
    }
    const routeView = rootRef.current?.querySelector<HTMLElement>(
      ".lg2-route-layer > .lg2-view",
    );
    const snapshot = routeScrollSnapshotsRef.current.get(location);
    if (!routeView || !snapshot) {
      resetNavigationState();
      return;
    }
    selfAndDescendants(routeView, "[data-lg-scroll]").forEach(
      (element, index) => {
        element.scrollTop = snapshot.scrollTops[index] ?? 0;
      },
    );
    selfAndDescendants(
      routeView,
      "[data-lg-gallery],[data-lg-scroll-x]",
    ).forEach(
      (element, index) => {
        element.scrollLeft = snapshot.galleryScrollLefts[index] ?? 0;
      },
    );
    setGalleryIndex(snapshot.galleryIndex);
  }, [isDetailPresentation, location, resetNavigationState]);

  useLayoutEffect(() => {
    if (!detailSheetActive) return;
    if (!rootRef.current?.querySelector(".lg2-route-layer.v--det.on"))
      setDetailTransitionPhase("idle");
  }, [detailSheetActive, location]);

  const captureHeldView = useCallback((resetStack: boolean) => {
    try {
      const source = rootRef.current?.querySelector<HTMLElement>(
        ".lg2-route-layer > .lg2-view",
      );
      if (!source) {
        if (resetStack) heldViewStackRef.current = [];
        console.warn("[living-guide] Held background unavailable: source view missing");
        return;
      }

      const clone = source.cloneNode(true) as HTMLElement;
      if (!sanitizeHeldClone(source, clone)) {
        if (resetStack) heldViewStackRef.current = [];
        console.warn(
          "[living-guide] Held background refused because the source owns live form/media state; navigation continues with the real view",
        );
        return;
      }
      const sourceBottomNav =
        rootRef.current?.querySelector<HTMLElement>(":scope > .lg2-bottom-nav");
      const bottomNavClone = sourceBottomNav?.cloneNode(true) as
        | HTMLElement
        | undefined;
      if (
        sourceBottomNav &&
        bottomNavClone &&
        !sanitizeHeldClone(sourceBottomNav, bottomNavClone)
      ) {
        if (resetStack) heldViewStackRef.current = [];
        console.warn(
          "[living-guide] Held bottom navigation refused; route navigation continues",
        );
        return;
      }
      const sourceScrollers = selfAndDescendants(source, "[data-lg-scroll]");
      const cloneScrollers = selfAndDescendants(clone, "[data-lg-scroll]");
      sourceScrollers.forEach((scroller, index) => {
      if (cloneScrollers[index]) {
        cloneScrollers[index]!.dataset.lgHeldScrollTop = String(
          scroller.scrollTop,
        );
      }
      });
      const sourceGalleries = selfAndDescendants(
      source,
      "[data-lg-gallery],[data-lg-scroll-x]",
    );
      const cloneGalleries = selfAndDescendants(
      clone,
      "[data-lg-gallery],[data-lg-scroll-x]",
    );
      sourceGalleries.forEach((gallery, index) => {
      if (cloneGalleries[index]) {
        cloneGalleries[index]!.dataset.lgHeldScrollLeft = String(
          gallery.scrollLeft,
        );
      }
      });
      const surface = document.createElement("div");
      surface.className = "lg2-held-surface";
      surface.dataset.lgHeldCompleteRoute = "true";
      surface.dataset.lgHeldDetail = String(
      source.parentElement?.classList.contains("v--det") === true,
    );
      surface.setAttribute("aria-hidden", "true");
      surface.setAttribute("inert", "");
      surface.append(clone);
      heldViewStackRef.current = [
      ...(resetStack ? [] : heldViewStackRef.current),
      { surface, bottomNav: bottomNavClone ?? null },
      ].slice(-MAX_HELD_VIEW_DEPTH);
    } catch (error) {
      if (resetStack) heldViewStackRef.current = [];
      console.warn(
        "[living-guide] Held background capture failed; navigation continues with the real view",
        error,
      );
    }
  }, []);

  const syncHeldViewStack = useCallback((holdImmediate = true) => {
    const heldLayer = heldLayerRef.current;
    if (!heldLayer) return;
    const lastIndex = heldViewStackRef.current.length - 1;
    const stateForIndex = (index: number) =>
      index === lastIndex
        ? holdImmediate
          ? "hold"
          : "closing"
        : "deep";
    const applyWrapperState = (
      wrapper: HTMLElement,
      index: number,
    ) => {
      const state = stateForIndex(index);
      wrapper.className =
        state === "hold"
          ? "lg2-held-view v on hold"
          : state === "closing"
            ? "lg2-held-view lg2-held-view--closing v on"
            : "lg2-held-view lg2-held-view--deep v on";
      wrapper.dataset.lgHeldDepth = String(index);
      wrapper.style.zIndex = String(index * 2 + 1);
    };
    const applyBottomNavState = (
      bottomNav: HTMLElement,
      index: number,
    ) => {
      const state = stateForIndex(index);
      bottomNav.classList.add("lg2-held-bottom-nav");
      bottomNav.classList.toggle(
        "lg2-held-bottom-nav--hold",
        state === "hold",
      );
      bottomNav.classList.toggle(
        "lg2-held-bottom-nav--closing",
        state === "closing",
      );
      bottomNav.classList.toggle(
        "lg2-held-bottom-nav--deep",
        state === "deep",
      );
      bottomNav.dataset.lgHeldDepth = String(index);
      bottomNav.style.zIndex = String(index * 2 + 2);
    };
    const existingWrappers = Array.from(
      heldLayer.querySelectorAll<HTMLElement>(":scope > .lg2-held-view"),
    );
    const expectedBottomNavs = heldViewStackRef.current.flatMap(
      ({ bottomNav }, index) => (bottomNav ? [{ bottomNav, index }] : []),
    );
    const existingBottomNavs = Array.from(
      heldLayer.querySelectorAll<HTMLElement>(
        ":scope > .lg2-held-bottom-nav",
      ),
    );
    const canReuseExisting =
      !holdImmediate &&
      existingWrappers.length === heldViewStackRef.current.length &&
      existingWrappers.every(
        (wrapper, index) =>
          wrapper.firstElementChild ===
          heldViewStackRef.current[index]?.surface,
      ) &&
      existingBottomNavs.length === expectedBottomNavs.length &&
      existingBottomNavs.every(
        (bottomNav, index) =>
          bottomNav === expectedBottomNavs[index]?.bottomNav,
      );
    if (canReuseExisting) {
      existingWrappers.forEach(applyWrapperState);
      expectedBottomNavs.forEach(({ bottomNav, index }) =>
        applyBottomNavState(bottomNav, index),
      );
      return;
    }

    const wrappers = heldViewStackRef.current.map(({ surface }, index) => {
      const wrapper = document.createElement("div");
      applyWrapperState(wrapper, index);
      wrapper.setAttribute("aria-hidden", "true");
      wrapper.setAttribute("inert", "");
      wrapper.append(surface);
      return wrapper;
    });
    const bottomNavs = expectedBottomNavs.map(({ bottomNav, index }) => {
      applyBottomNavState(bottomNav, index);
      return bottomNav;
    });
    heldLayer.replaceChildren(...wrappers, ...bottomNavs);
    // Detached overflow elements clamp scrollTop/scrollLeft to zero. Restore
    // them only after the clone participates in layout.
    void heldLayer.offsetHeight;
    heldLayer
      .querySelectorAll<HTMLElement>("[data-lg-held-scroll-top]")
      .forEach((element) => {
        element.scrollTop = Number(element.dataset.lgHeldScrollTop ?? 0);
      });
    heldLayer
      .querySelectorAll<HTMLElement>("[data-lg-held-scroll-left]")
      .forEach((element) => {
        element.scrollLeft = Number(element.dataset.lgHeldScrollLeft ?? 0);
      });
  }, []);

  const cancelPendingDetailClose = useCallback(() => {
    closeTransitionCleanupRef.current?.();
    closeTransitionCleanupRef.current = null;
    closeSourceLocationRef.current = null;
  }, []);

  const beginDetailCloseTransition = useCallback(
    (afterAnimation: () => void) => {
      if (closeTransitionCleanupRef.current) return;

      const sheet = rootRef.current?.querySelector<HTMLElement>(
        ".lg2-route-layer.v--det",
      );
      closeSourceLocationRef.current = location;
      performance.clearMarks("lg2-detail-close-animation-end");
      performance.clearMarks("lg2-detail-close-swap");
      performance.clearMeasures("lg2-detail-close-end-to-swap");

      let zeroDurationFrame = 0;
      let completed = false;
      const cleanup = () => {
        sheet?.removeEventListener("transitionend", onTransitionFinished);
        sheet?.removeEventListener("transitioncancel", onTransitionFinished);
        if (zeroDurationFrame) window.cancelAnimationFrame(zeroDurationFrame);
        if (closeTransitionCleanupRef.current === cleanup) {
          closeTransitionCleanupRef.current = null;
        }
      };
      const complete = () => {
        if (completed) return;
        completed = true;
        cleanup();
        performance.mark("lg2-detail-close-animation-end");
        window.dispatchEvent(new CustomEvent("lg2:detail-close-animation-end"));
        flushSync(() => setDetailTransitionPhase("restoring"));
        afterAnimation();
      };
      function onTransitionFinished(event: TransitionEvent) {
        if (
          event.target === sheet &&
          (event.propertyName === "transform" ||
            event.propertyName === "opacity")
        ) {
          complete();
        }
      }

      sheet?.addEventListener("transitionend", onTransitionFinished);
      sheet?.addEventListener("transitioncancel", onTransitionFinished);
      closeTransitionCleanupRef.current = cleanup;
      syncHeldViewStack(false);
      flushSync(() => setDetailTransitionPhase("closing"));

      // A zero-duration transition has no transitionend event. Resolve that
      // accessibility/test case on the next frame, never with a close timer.
      zeroDurationFrame = window.requestAnimationFrame(() => {
        if (!sheet) {
          complete();
          return;
        }
        const style = window.getComputedStyle(sheet);
        const durations = style.transitionDuration
          .split(",")
          .map((value) =>
            value.trim().endsWith("ms")
              ? Number.parseFloat(value)
              : Number.parseFloat(value) * 1000,
          );
        if (durations.every((duration) => !Number.isFinite(duration) || duration <= 0)) {
          complete();
        }
      });
    },
    [location, syncHeldViewStack],
  );

  const scheduleClosePaintHandoff = useCallback(
    (targetHeldDepth: number, targetIsDetail: boolean) => {
      syncHeldViewStack(false);
      if (!targetIsDetail) {
        // The destination's real fixed nav is already mounted above the held
        // route. Retire only its clone now so backdrop-filter samples the same
        // pixels before and after the route surface swap.
        heldLayerRef.current
          ?.querySelectorAll<HTMLElement>(
            ":scope > .lg2-held-bottom-nav",
          )
          .forEach((bottomNav) => {
            bottomNav.style.visibility = "hidden";
          });
      }
      let secondFrame = 0;
      let firstScrollRestoreFrame = 0;
      let secondScrollRestoreFrame = 0;
      let releaseTestGate: (() => void) | null = null;
      const swapToRealRoute = () => {
        performance.mark("lg2-detail-close-swap");
        performance.measure(
          "lg2-detail-close-end-to-swap",
          "lg2-detail-close-animation-end",
          "lg2-detail-close-swap",
        );
        const delay = performance
          .getEntriesByName("lg2-detail-close-end-to-swap", "measure")
          .at(-1)?.duration;
        if (delay !== undefined && rootRef.current) {
          rootRef.current.dataset.closeSwapDelayMs = delay.toFixed(1);
        }
        window.dispatchEvent(
          new CustomEvent("lg2:detail-close-swap", {
            detail: { delayMs: delay ?? null },
          }),
        );

        heldViewStackRef.current = heldViewStackRef.current.slice(
          0,
          Math.max(0, targetHeldDepth),
        );
        syncHeldViewStack();
        closeSourceLocationRef.current = null;

        if (restoreDetailFocusRef.current) {
          restoreDetailFocusRef.current = false;
          const selector = detailTriggerSelectorRef.current;
          const trigger = selector
            ? rootRef.current?.querySelector<HTMLElement>(selector)
            : null;
          trigger?.focus({ preventScroll: true });
        }
        flushSync(() =>
          setDetailTransitionPhase(targetIsDetail ? "open" : "idle"),
        );
        if (!targetIsDetail && detailSourceScrollRef.current) {
          const sourceScroll = detailSourceScrollRef.current;
          const restoreSourceScroll = () => {
            if (sourceScroll.element.isConnected) {
              sourceScroll.element.scrollTop = sourceScroll.scrollTop;
            }
          };
          restoreSourceScroll();
          firstScrollRestoreFrame = window.requestAnimationFrame(() => {
            restoreSourceScroll();
            secondScrollRestoreFrame = window.requestAnimationFrame(() => {
              restoreSourceScroll();
              if (detailSourceScrollRef.current === sourceScroll) {
                detailSourceScrollRef.current = null;
              }
            });
          });
        }
      };
      const scheduleSwap = () => {
        secondFrame = window.requestAnimationFrame(swapToRealRoute);
      };
      const firstFrame = window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent("lg2:detail-close-handoff-frame"));
        const testWindow = window as Window & {
          __LG2_TEST_HOLD_CLOSE_SWAP__?: boolean;
        };
        if (import.meta.env.DEV && testWindow.__LG2_TEST_HOLD_CLOSE_SWAP__) {
          releaseTestGate = () => {
            releaseTestGate = null;
            scheduleSwap();
          };
          window.addEventListener(
            "lg2:test-release-close-swap",
            releaseTestGate,
            { once: true },
          );
          return;
        }
        scheduleSwap();
      });
      return () => {
        window.cancelAnimationFrame(firstFrame);
        if (secondFrame) window.cancelAnimationFrame(secondFrame);
        if (firstScrollRestoreFrame) {
          window.cancelAnimationFrame(firstScrollRestoreFrame);
        }
        if (secondScrollRestoreFrame) {
          window.cancelAnimationFrame(secondScrollRestoreFrame);
        }
        if (releaseTestGate) {
          window.removeEventListener(
            "lg2:test-release-close-swap",
            releaseTestGate,
          );
        }
      };
    },
    [syncHeldViewStack],
  );

  const navigate = useCallback(
    (
      path: string,
      replace = false,
      presentation: LivingGuidePresentation = "standard",
    ) => {
      cancelPendingDetailClose();
      if (presentation === "detail") {
        if (!isDetailPresentation) {
          detailSourceLocationRef.current = location;
          const sourceScroller =
            rootRef.current?.querySelector<HTMLElement>(
              ".lg2-base-route-layer [data-lg-scroll]",
            ) ?? null;
          detailSourceScrollRef.current = sourceScroller
            ? { element: sourceScroller, scrollTop: sourceScroller.scrollTop }
            : null;
        }
        captureRouteScroll();
        const trigger = document.activeElement;
        if (trigger instanceof HTMLElement) {
          const testId = trigger.getAttribute("data-testid");
          const cardId = trigger.getAttribute("data-lg-card");
          const ariaLabel = trigger.getAttribute("aria-label");
          detailTriggerSelectorRef.current = testId
            ? `[data-testid="${CSS.escape(testId)}"]`
            : cardId
              ? `[data-lg-card="${CSS.escape(cardId)}"]`
              : ariaLabel
                ? `[aria-label="${CSS.escape(ariaLabel)}"]`
                : null;
        }
        // The standard source route remains mounted beneath the first detail.
        // Only nested detail navigation still needs a held detail surface.
        if (isDetailPresentation) captureHeldView(false);
        else heldViewStackRef.current = [];
        performance.clearMarks("lg2-detail-tap");
        performance.clearMarks("lg2-detail-title-painted");
        performance.clearMeasures("lg2-detail-tap-to-title-paint");
        performance.mark("lg2-detail-tap");
        setDetailTransitionPhase("preparing");
      } else {
        heldViewStackRef.current = [];
        setSuppressRouteEntryAnimation(false);
        setDetailTransitionPhase("idle");
      }
      // buildGuestPath keeps the authenticated draft preview, language and
      // development Living Guide override across in-shell routes.
      setLocation(buildGuestPath(path), {
        replace: presentation === "detail" ? true : replace,
        state: {
          livingGuide: true,
          from: location,
          livingGuidePresentation: presentation,
          livingGuideFromPresentation: isDetailPresentation
            ? "detail"
            : "standard",
          livingGuideHeldDepth:
            presentation === "detail" ? heldViewStackRef.current.length : 0,
        },
      });
    },
    [
      captureHeldView,
      captureRouteScroll,
      cancelPendingDetailClose,
      isDetailPresentation,
      location,
      setLocation,
    ],
  );

  const navigateDetail = useCallback(
    (path: string) => navigate(path, false, "detail"),
    [navigate],
  );

  useLayoutEffect(() => {
    if (isDetailPresentation) return;
    const state = window.history.state ?? {};

    if (compactHistoryAfterCloseRef.current) {
      compactHistoryAfterCloseRef.current = false;
      window.history.pushState(
        {
          ...state,
          livingGuideRestingBase: false,
          livingGuideRestingGuard: true,
          livingGuideCloseGuard: false,
        },
        "",
        window.location.href,
      );
      return;
    }

    if (state.livingGuideRestingGuard || state.livingGuideRestingBase) return;
    const baseState = {
      ...state,
      livingGuideRestingBase: true,
      livingGuideRestingGuard: false,
      livingGuideCloseGuard: false,
    };
    window.history.replaceState(baseState, "", window.location.href);
    window.history.pushState(
      {
        ...baseState,
        livingGuideRestingBase: false,
        livingGuideRestingGuard: true,
      },
      "",
      window.location.href,
    );
  }, [isDetailPresentation, location]);

  useLayoutEffect(() => {
    if (!isDetailPresentation) {
      if (
        detailTransitionPhase === "restoring" &&
        closeSourceLocationRef.current !== location
      ) {
        setSuppressRouteEntryAnimation(true);
        return scheduleClosePaintHandoff(0, false);
      }
      cancelPendingDetailClose();
      heldViewStackRef.current = [];
      syncHeldViewStack();
      if (detailTransitionPhase !== "idle") setDetailTransitionPhase("idle");
      if (restoreDetailFocusRef.current) {
        restoreDetailFocusRef.current = false;
        window.requestAnimationFrame(() => {
          const selector = detailTriggerSelectorRef.current;
          const trigger = selector
            ? rootRef.current?.querySelector<HTMLElement>(selector)
            : null;
          trigger?.focus({ preventScroll: true });
        });
      }
      return;
    }

    if (!window.history.state?.livingGuideCloseGuard) {
      window.history.pushState(
        { ...window.history.state, livingGuideCloseGuard: true },
        "",
        window.location.href,
      );
    }

    const expectedHeldDepth = Number(
      window.history.state?.livingGuideHeldDepth,
    );
    if (
      detailTransitionPhase === "restoring" &&
      closeSourceLocationRef.current !== location
    ) {
      const targetHeldDepth =
        Number.isInteger(expectedHeldDepth) && expectedHeldDepth >= 0
          ? expectedHeldDepth
          : Math.max(0, heldViewStackRef.current.length - 1);
      return scheduleClosePaintHandoff(targetHeldDepth, true);
    }
    if (
      Number.isInteger(expectedHeldDepth) &&
      expectedHeldDepth >= 0 &&
      heldViewStackRef.current.length > expectedHeldDepth
    ) {
      heldViewStackRef.current = heldViewStackRef.current.slice(
        0,
        expectedHeldDepth,
      );
    }
    syncHeldViewStack();

    // The sheet remains at translateY(100%) until its complete first screenful
    // is decoded, composed, and geometrically stable for consecutive paints.
    // Only then may the opening transform begin.
    let cancelled = false;
    let armedSheet: HTMLElement | null = null;
    let removeTransitionEndListener: (() => void) | null = null;
    const prepareAndOpen = async () => {
      const sheet = rootRef.current?.querySelector<HTMLElement>(
        ".lg2-route-layer.v--det",
      );
      if (!sheet) return;
      const ready =
        screen === "messages" ||
        screen === "explore" ||
        (screen === "detail" &&
          categoryContext?.category.layout === "apartments")
          ? await (async () => {
              await document.fonts.ready;
              await nextPaintFrame();
              await nextPaintFrame();
              return !cancelled && sheet.isConnected;
            })()
          : await waitForDetailVisualReadiness(sheet, () => cancelled);
      if (!ready || cancelled) return;

      const tap = performance.getEntriesByName("lg2-detail-tap", "mark").at(-1);
      const tapToReadyMs = tap ? performance.now() - tap.startTime : 0;
      sheet.dataset.tapToTitlePaintMs = tapToReadyMs.toFixed(1);
      sheet.dataset.tapToVisualReadyMs = tapToReadyMs.toFixed(1);
      performance.mark("lg2-detail-title-painted");
      performance.mark("lg2-detail-visual-ready");
      if (tap) {
        performance.measure(
          "lg2-detail-tap-to-title-paint",
          "lg2-detail-tap",
          "lg2-detail-title-painted",
        );
        performance.measure(
          "lg2-detail-tap-to-visual-ready",
          "lg2-detail-tap",
          "lg2-detail-visual-ready",
        );
      }
      window.dispatchEvent(
        new CustomEvent("lg2:detail-open-visual-ready", {
          detail: { delayMs: tapToReadyMs },
        }),
      );

      flushSync(() => setDetailTransitionPhase("armed"));
      armedSheet = rootRef.current?.querySelector<HTMLElement>(
        ".lg2-route-layer.v--det",
      ) ?? null;
      if (!armedSheet || cancelled) return;
      const transitionSheet = armedSheet;

      // Re-enable the transition while the complete sheet is still at 100%,
      // then force that state to layout before `.on` is committed.
      void transitionSheet.offsetHeight;
      const onTransitionEnd = (event: TransitionEvent) => {
        if (
          event.target !== transitionSheet ||
          event.propertyName !== "transform"
        ) {
          return;
        }
        performance.mark("lg2-detail-open-transition-end");
        transitionSheet.dataset.openTransitionEndMs =
          performance.now().toFixed(1);
        window.dispatchEvent(
          new CustomEvent("lg2:detail-open-transition-end", {
            detail: { endTimeMs: performance.now() },
          }),
        );
      };
      transitionSheet.addEventListener("transitionend", onTransitionEnd, {
        once: true,
      });
      removeTransitionEndListener = () =>
        transitionSheet.removeEventListener("transitionend", onTransitionEnd);

      flushSync(() => setDetailTransitionPhase("open"));
      const openStartTimeMs = performance.now();
      performance.mark("lg2-detail-open-transition-start");
      window.dispatchEvent(
        new CustomEvent("lg2:detail-open-transition-start", {
          detail: {
            startTimeMs: openStartTimeMs,
            durationMs: 550,
          },
        }),
      );
      window.requestAnimationFrame(() => {
        rootRef.current
          ?.querySelector<HTMLElement>(".lg2-route-layer.v--det .lg2-detail-back")
          ?.focus({ preventScroll: true });
      });
    };
    void prepareAndOpen();

    return () => {
      cancelled = true;
      removeTransitionEndListener?.();
    };
    // The destination location starts one transition. Phase changes must not
    // restart the two-frame paint gate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cancelPendingDetailClose,
    isDetailPresentation,
    location,
    scheduleClosePaintHandoff,
    syncHeldViewStack,
  ]);

  useEffect(() => {
    return () => {
      closeTransitionCleanupRef.current?.();
      heldViewStackRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (unavailableGuestSubroute) {
      navigate(`/${slug}/home`, true);
    }
  }, [navigate, slug, unavailableGuestSubroute]);

  const gridPath = (section = currentSection) =>
    `/${slug}/s/${encodeURIComponent(section?.key ?? "stay")}`;

  const closePresentedView = useCallback(
    (fallbackPath: string) => {
      const navigateAfterAnimation = () => {
        restoreDetailFocusRef.current = true;
        const returnsToDetail =
          window.history.state?.livingGuideFromPresentation === "detail";
        if (!returnsToDetail) {
          compactHistoryAfterCloseRef.current = false;
          setLocation(buildGuestPath(fallbackPath), {
            replace: true,
            state: {
              livingGuide: true,
              from: location,
              livingGuidePresentation: "standard",
              livingGuideFromPresentation: "standard",
              livingGuideHeldDepth: 0,
            },
          });
          return;
        }
        if (window.history.state?.livingGuideCloseGuard) {
          compactHistoryAfterCloseRef.current = false;
          window.history.go(-2);
        } else if (window.history.length > 1 && window.history.state?.livingGuide) {
          compactHistoryAfterCloseRef.current = false;
          window.history.back();
        } else {
          setLocation(buildGuestPath(fallbackPath), {
            replace: true,
            state: {
              livingGuide: true,
              from: location,
              livingGuidePresentation: "standard",
              livingGuideFromPresentation: "standard",
              livingGuideHeldDepth: 0,
            },
          });
        }
      };

      if (!isDetailPresentation) {
        navigateAfterAnimation();
        return;
      }
      if (
        detailTransitionPhase === "closing" ||
        detailTransitionPhase === "restoring"
      ) {
        return;
      }
      beginDetailCloseTransition(navigateAfterAnimation);
    },
    [
      beginDetailCloseTransition,
      detailTransitionPhase,
      isDetailPresentation,
      location,
      setLocation,
    ],
  );

  useEffect(() => {
    const onPopState = () => {
      if (
        !isDetailPresentation &&
        window.history.state?.livingGuideRestingBase &&
        !compactHistoryAfterCloseRef.current
      ) {
        // One phone-Back action skips the invisible resting duplicate.
        window.history.back();
        return;
      }
      const compactAfterClose =
        window.history.state?.livingGuideFromPresentation !== "detail";
      if (
        !isDetailPresentation ||
        compactHistoryAfterCloseRef.current ||
        window.history.state?.livingGuideCloseGuard ||
        closeTransitionCleanupRef.current !== null ||
        detailTransitionPhase === "restoring"
      ) {
        return;
      }
      beginDetailCloseTransition(() => {
        restoreDetailFocusRef.current = true;
        compactHistoryAfterCloseRef.current = compactAfterClose;
        window.history.back();
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [
    beginDetailCloseTransition,
    detailTransitionPhase,
    isDetailPresentation,
  ]);

  const goBack = useCallback(() => {
    if (screen !== "detail") return;
    const returnsToDetail =
      window.history.state?.livingGuideFromPresentation === "detail";
    const fallbackPath =
      !returnsToDetail && detailSourceLocationRef.current
        ? detailSourceLocationRef.current
        : routeItemId
          ? `/${slug}/c/${routeCategoryId}`
          : gridPath(categoryContext?.section ?? staySection);
    closePresentedView(fallbackPath);
  }, [
    categoryContext?.section,
    closePresentedView,
    routeCategoryId,
    routeItemId,
    screen,
    slug,
    staySection,
  ]);

  const cancelSignIn = useCallback(() => {
    setShowSignIn(false);
    setPendingOrderItemId(null);
    setCredentialsCancelRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (screen !== "detail" && !showLanguages && !showNotices && !showSearch && !showSignIn) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showSignIn) cancelSignIn();
        else if (showNotices) setShowNotices(false);
        else if (showSearch) setShowSearch(false);
        else if (showLanguages) setShowLanguages(false);
        else if (orderItemId) setOrderItemId(null);
        else if (showOrders) setShowOrders(false);
        else if (isDetailPresentation) closePresentedView(`/${slug}/home`);
        else goBack();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    cancelSignIn,
    closePresentedView,
    goBack,
    isDetailPresentation,
    orderItemId,
    screen,
    showLanguages,
    showNotices,
    showOrders,
    showSearch,
    showSignIn,
  ]);

  const saveGuest = (record: GuestRecord & { password?: string }) => {
    const clean = {
      unit: record.unit.trim(),
      name: record.name.trim(),
      phone: record.phone.trim(),
    };
    if (
      !clean.unit ||
      !clean.name ||
      !clean.phone ||
      (clean.phone.match(/\d/g)?.length ?? 0) < 6
    ) {
      return;
    }
    const nextPassword = record.password?.trim() ?? "";
    if (messagePasswordRequired && !nextPassword) return;
    setGuest(clean);
    if (messagePasswordRequired) {
      setMessagePassword(nextPassword);
      rememberOrderPassword(slug, nextPassword);
    } else {
      setMessagePassword("");
    }
    rememberGuestIdentity(slug, clean);
    setMessageAccessError(null);
    setShowSignIn(false);
    setCredentialsRevision((value) => value + 1);
    if (pendingOrderItemId) {
      setOrderItemId(pendingOrderItemId);
      setPendingOrderItemId(null);
    }
    if (screen === "cover") {
      navigate(`/${slug}/home`);
    }
  };

  const requestCredentials = () => {
    setMessageAccessError(null);
    setShowSignIn(true);
  };

  const requestOrder = (itemId: string) => {
    if (messageAccessReady) {
      setOrderItemId(itemId);
      return;
    }
    setPendingOrderItemId(itemId);
    requestCredentials();
  };

  const openCategory = (id: string) => navigateDetail(`/${slug}/c/${id}`);
  const openItem = (categoryId: string, itemId: string) =>
    navigateDetail(`/${slug}/c/${categoryId}/i/${itemId}`);

  const helpCategory = allCategories.find((c: any) => c.category.layout === "help")?.category;

  const exploreCategories = useMemo(() => {
    const exploreSec = sections.find((s: any) => s.key === "explore");
    const servicesSec = sections.find((s: any) => s.key === "services");
    return [
      ...(exploreSec ? visible(exploreSec.categories) : []),
      ...(servicesSec ? visible(servicesSec.categories) : [])
    ];
  }, [sections]);

  const notices = visible(tenant?.notices);

  return (
    <div
      ref={rootRef}
      className="lg2-app notranslate"
      data-living-guide
      data-living-guide-app
      data-screen={screen}
      data-detail-open={
        isDetailPresentation || screen === "detail" ? "true" : undefined
      }
      translate="no"
    >
      <style>{`@font-face{font-family:"Inter";src:url("${livingGuideInterWoff2}") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}`}</style>
      <LivingGuideSprite />
      <Starfield theme={theme} />

      <main className="lg2-stage">
        {heldViewStackRef.current.length > 0 && (
          <div
            ref={heldLayerRef}
            className="lg2-held-stack"
            aria-hidden="true"
          />
        )}
        <div
          className={`lg2-route-layer lg2-base-route-layer${
            detailSheetActive ? " lg2-base-route-layer--held" : ""
          }`}
          data-suppress-entry-animation={
            suppressRouteEntryAnimation ? "true" : undefined
          }
        >
        {baseScreen === "cover" && (
          <CoverView tenant={tenant} lang={lang} t={t} onOpen={() => {
            if (guest) navigate(`/${slug}/home`);
            else setShowSignIn(true);
          }} onSearch={() => setShowSearch(true)} onLanguage={() => setShowLanguages(true)} />
        )}

        {baseScreen === "home" && (
          <HomeView
            tenant={tenant}
            sections={sections}
            lang={lang}
            t={t}
            onOpenCategory={openCategory}
            onOpenItem={openItem}
            onOpenNotices={() => setShowNotices(true)}
            notices={notices}
            navigate={navigate}
            navigateDetail={navigateDetail}
            slug={slug}
            onSearch={() => setShowSearch(true)}
            navState={navState}
          />
        )}

        {baseScreen === "site-map" && navState.hasSiteMap && (
          <SiteMapGuestView
            images={sitePlanImages}
            t={t}
            onBack={() => closePresentedView(`/${slug}/home`)}
          />
        )}

        {baseScreen === "more" && navState.omitted.length > 0 && (
          <MoreGuestView
            omitted={navState.omitted}
            t={t}
            onBack={() => closePresentedView(`/${slug}/home`)}
            onNavigate={navigateDetail}
            sections={sections}
            slug={slug}
          />
        )}

        {baseScreen === "grid" && baseSection && baseSection.key === "offer" && (
          <ShopView
            tenant={tenant}
            section={baseSection}
            t={t}
            orderSummary={orderSummary}
            onOpenOrders={() => setShowOrders(true)}
            onOpenItem={openItem}
            onOpenCategory={openCategory}
          />
        )}

        {baseScreen === "grid" && baseSection && baseSection.key === "stay" && (
          <StayView
            tenant={tenant}
            section={baseSection}
            t={t}
            guest={guest}
            onEditGuest={requestCredentials}
            onOpenCategory={openCategory}
            onOpenNotices={() => setShowNotices(true)}
            notices={notices}
            helpCategoryId={helpCategory?.id}
          />
        )}

        {baseScreen === "grid" && baseSection && baseSection.key !== "offer" && baseSection.key !== "stay" && (
          <GridView
            tenant={tenant}
            section={baseSection}
            lang={lang}
            t={t}
            guest={null}
            onEditGuest={requestCredentials}
            onOpenCategory={openCategory}
            onOpenNotices={() => setShowNotices(true)}
            helpCategoryId={null}
            notices={[]}
            orderSummary={orderSummary}
            onOpenOrders={() => setShowOrders(true)}
          />
        )}

        {baseScreen === "explore" && (
          <ExploreView
            tenant={tenant}
            categories={exploreCategories}
            lang={lang}
            t={t}
            onOpenCategory={openCategory}
            onOpenItem={openItem}
          />
        )}

        {baseScreen === "messages" && (
          <MessagesView
            tenant={tenant}
            slug={slug}
            guest={guest}
            canSend={messageAccessReady}
            password={messagePasswordRequired ? messagePassword : undefined}
            credentialsRevision={credentialsRevision}
            credentialsCancelRevision={credentialsCancelRevision}
            lang={lang}
            t={t}
            onBack={() => closePresentedView(`/${slug}/home`)}
            onCredentialsRequired={requestCredentials}
            onCredentialsRejected={(message) => {
              setMessagePassword("");
              forgetRememberedOrderPassword(slug);
              setMessageAccessError(message);
              setShowSignIn(true);
            }}
            draft={messageDraft}
            onDraftChange={setMessageDraft}
          />
        )}

        </div>

        {isDetailPresentation && canRenderDetailSheet && (
          <div
            key={location}
            className={`lg2-route-layer v v--det${
              detailSheetActive ? " on" : ""
            }`}
            data-detail-transition={detailTransitionPhase}
            style={detailRouteStyle}
          >
          {screen === "detail" && categoryContext ? (
          <DetailView
            category={categoryContext.category}
            itemId={routeItemId}
            lang={lang}
            t={t}
            galleryIndex={galleryIndex}
            onGalleryIndex={setGalleryIndex}
            onBack={goBack}
            slug={slug}
            setLocation={setLocation}
            tenant={tenant}
            onOpenItem={(id: string) => openItem(categoryContext.category.id, id)}
            showHostContacts={
              categoryContext.section?.key === "stay" &&
              categoryContext.category.id ===
                visible(categoryContext.section?.categories)[0]?.id
            }
            onOrderClick={requestOrder}
          />
          ) : screen === "explore" ? (
            <ExploreView
              tenant={tenant}
              categories={exploreCategories}
              lang={lang}
              t={t}
              onOpenCategory={openCategory}
              onOpenItem={openItem}
              onBack={() => closePresentedView(`/${slug}/home`)}
            />
          ) : (
            <MessagesView
              tenant={tenant}
              slug={slug}
              guest={guest}
              canSend={messageAccessReady}
              password={messagePasswordRequired ? messagePassword : undefined}
              credentialsRevision={credentialsRevision}
              credentialsCancelRevision={credentialsCancelRevision}
              lang={lang}
              t={t}
              onBack={() => closePresentedView(`/${slug}/home`)}
              onCredentialsRequired={requestCredentials}
              onCredentialsRejected={(message) => {
                setMessagePassword("");
                forgetRememberedOrderPassword(slug);
                setMessageAccessError(message);
                setShowSignIn(true);
              }}
              draft={messageDraft}
              onDraftChange={setMessageDraft}
            />
          )}
          </div>
        )}
      </main>

      {shouldShowLivingGuideBottomNav(baseScreen) && (
        <BottomNav
          resolvedNav={navState.resolved}
          sections={sections}
          slug={slug}
          t={t}
          activeSectionKey={baseSection?.key ?? null}
          activeCategoryId={categoryContext?.category?.id ?? null}
          onNavigate={(path: string) => navigate(path, false, "tab")}
          screen={baseScreen}
        />
      )}



      {showNotices && notices.length > 0 && (
        <NoticesSheet notices={notices} onClose={() => setShowNotices(false)} t={t} />
      )}

      {showSearch && (
        <LivingGuideSearchSheet
          sections={sections}
          t={t}
          onClose={() => setShowSearch(false)}
          onOpenCategory={(categoryId) => {
            setShowSearch(false);
            openCategory(categoryId);
          }}
          onOpenItem={(categoryId, itemId) => {
            setShowSearch(false);
            openItem(categoryId, itemId);
          }}
        />
      )}

      {orderItemId && (() => {
        const item = allCategories.flatMap((c: any) => visible(c.category.items)).find((i: any) => i.id === orderItemId);
        if (!item) return null;
        return (
          <OrderSheet
            item={item}
            slug={slug}
            lang={lang as UiLanguage}
            t={t}
            guest={guest}
            password={messagePasswordRequired ? messagePassword : undefined}
            passwordRequired={Boolean(tenant.orderPasswordConfigured)}
            canSubmitWithCredentials={messageAccessReady}
            credentialsRevision={credentialsRevision}
            credentialsCancelRevision={credentialsCancelRevision}
            onClose={() => setOrderItemId(null)}
            onOpenOrders={() => {
              setOrderItemId(null);
              setShowOrders(true);
            }}
            onCredentialsAccepted={(nextGuest) => {
              setGuest(nextGuest);
              rememberGuestIdentity(slug, nextGuest);
            }}
            onCredentialsRejected={(nextGuest, message) => {
              setGuest(nextGuest);
              rememberGuestIdentity(slug, nextGuest);
              setMessagePassword("");
              forgetRememberedOrderPassword(slug);
              setMessageAccessError(message);
              setShowSignIn(true);
            }}
          />
        );
      })()}

      {showOrders && (
        <MyOrdersSheet slug={slug} lang={lang as UiLanguage} t={t} onClose={() => setShowOrders(false)} />
      )}
      {showSignIn && (
        <SignInSheet
          tenantName={tenant.name}
          t={t}
          initialGuest={guest}
          initialPassword={messagePassword}
          passwordRequired={messagePasswordRequired}
          serverError={messageAccessError}
          allowLater
          onClose={cancelSignIn}
          onLater={() => {
            cancelSignIn();
            if (screen === "cover") navigate(`/${slug}/home`);
          }}
          onSave={saveGuest}
        />
      )}
      {showLanguages && (
        <LivingGuideLanguageSheet
          languages={enabledLanguageCodes(tenant)}
          currentLanguage={lang}
          t={t}
          onClose={() => setShowLanguages(false)}
          onSelect={(nextLang) => {
            setShowLanguages(false);
            onLanguageChange(nextLang);
          }}
        />
      )}
    </div>
  );
}

function Starfield({ theme }: { theme: LivingTheme }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 90 }, (_, index) => {
        const pseudo = (index * 47 + 19) % 101;
        const pseudo2 = (index * 71 + 7) % 103;
        return {
          left: `${pseudo}%`,
          top: `${pseudo2}%`,
          width: `${1 + (index % 3) * 0.65}px`,
          height: `${1 + (index % 3) * 0.65}px`,
          "--d": `${2.4 + (index % 8) * 0.31}s`,
          "--dl": `${(index % 11) * -0.19}s`,
          "--o": `${0.35 + (index % 6) * 0.1}`,
        } as CSSProperties;
      }),
    [],
  );
  if (theme !== "noc") return null;
  return (
    <div className="lg-stars lg2-stars" aria-hidden="true">
      {stars.map((style, index) => (
        <i key={index} style={style} />
      ))}
    </div>
  );
}

function CoverView({ tenant, lang, t, onOpen, onSearch, onLanguage }: { tenant: any; lang: string; t: UiTranslator; onOpen: () => void; onSearch: () => void; onLanguage: () => void; }) {
  const title = tenant.coverTitle || tenant.name;
  const tourUrl = virtualTourEmbedUrl(tenant.tourUrl);

  return (
    <section className="lg2-view lg2-cover is-on" aria-label={title} data-testid="screen-cover">
      <div className={tourUrl ? "lg2-cover-tour" : "lg2-cover-photo"} aria-hidden={tourUrl ? undefined : true}>
        {tourUrl ? (
          <iframe
            src={tourUrl}
            scrolling="no"
            loading="eager"
            title={title}
          />
        ) : (
          tenant.heroUrl && <img src={tenant.heroUrl} alt="" fetchPriority="high" decoding="async" style={imageStyle(tenant.heroMedia, tenant)} />
        )}
      </div>
      <div className={tourUrl ? "lg2-cover-veil lg2-cover-veil--tour" : "lg2-cover-veil"} aria-hidden="true" />
      {tourUrl && <div className="lg2-hint360">{t("UI.lg.tour.hint")}</div>}
      <div className="lg2-cover-mast">
        <p className="lg2-cover-kicker">{t("UI.lg.guide")}</p>
        {title && <h1>{title}</h1>}
        {tenant.coverSubtitle && <p className="lg2-cover-subtitle">{tenant.coverSubtitle}</p>}
        {tenant.address && <p className="lg2-cover-address">{tenant.address}</p>}
      </div>
      <div className="lg2-cbar">
        <button className="lg2-fab lg2-cover-search" type="button" onClick={onSearch} aria-label={t("UI.lg.search.title")} data-testid="button-cover-search">
          <svg aria-hidden="true"><use href="#lg-i-srch" /></svg>
        </button>
        <button className="lg2-open-guide" type="button" onClick={onOpen} data-testid="button-open-guide">
          <svg aria-hidden="true"><use href="#lg-i-down" /></svg>
          {t("UI.lg.openGuide")}
        </button>
        <button className="lg2-fab lg2-language" type="button" onClick={onLanguage} aria-label={t("UI.lg.language", { lang: lang.toUpperCase() })} data-lg-language-trigger data-testid="button-cover-language">
          {lang.toUpperCase()}
        </button>
      </div>
    </section>
  );
}

function SignInSheet({
  tenantName,
  t,
  initialGuest,
  initialPassword,
  passwordRequired,
  serverError,
  allowLater,
  onClose,
  onLater,
  onSave,
}: any) {
  const [unit, setUnit] = useState(initialGuest?.unit ?? "");
  const [name, setName] = useState(initialGuest?.name ?? "");
  const [phone, setPhone] = useState(initialGuest?.phone ?? "");
  const [password, setPassword] = useState(initialPassword ?? "");
  const [phoneError, setPhoneError] = useState("");
  const unitInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const phoneInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!unit.trim()) unitInput.current?.focus();
      else if (!name.trim()) nameInput.current?.focus();
      else if ((phone.match(/\d/g)?.length ?? 0) < 6) phoneInput.current?.focus();
      else if (passwordRequired && (!password.trim() || serverError)) {
        passwordInput.current?.focus();
      } else {
        unitInput.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if ((phone.match(/\d/g)?.length ?? 0) < 6) {
      setPhoneError(t("UI.lg.order.validation.phoneDigits"));
      phoneInput.current?.focus();
      return;
    }
    setPhoneError("");
    onSave({ unit, name, phone, password });
  };

  return (
    <div className="lg2-sheet-overlay" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="lg2-welcome-sheet" role="dialog" aria-modal="true" aria-labelledby="lg2-welcome-title" onSubmit={submit}>
        <div className="lg2-grabber" aria-hidden="true" />
        <div className="lg2-welcome-heading">
          <p>{tenantName}</p>
          <h2 id="lg2-welcome-title">{t("UI.lg.welcome.title")}</h2>
          <span>{t("UI.lg.welcome.description")}</span>
        </div>
        {serverError && (
          <p
            className="lg2-msg-send-error"
            role="alert"
            data-testid="messages-signin-error"
          >
            {serverError}
          </p>
        )}
        <label className="lg2-field lg2-field--required">
          <span>{t("UI.lg.welcome.unit")}</span>
          <input ref={unitInput} required autoComplete="off" value={unit} placeholder={t("UI.lg.welcome.unitPlaceholder")} onChange={(event) => setUnit(event.target.value)} />
        </label>
        <label className="lg2-field lg2-field--required">
          <span>{t("UI.lg.welcome.name")}</span>
          <input ref={nameInput} required autoComplete="name" value={name} placeholder={t("UI.lg.welcome.namePlaceholder")} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="lg2-field lg2-field--required">
          <span>{t("UI.lg.welcome.phone")}</span>
          <input
            ref={phoneInput}
            required
            type="tel"
            maxLength={50}
            autoComplete="tel"
            value={phone}
            placeholder={t("UI.lg.welcome.phonePlaceholder")}
            onChange={(event) => {
              setPhone(event.target.value);
              if (phoneError) setPhoneError("");
            }}
            data-testid="guest-phone"
          />
        </label>
        {phoneError && <p className="lg2-msg-send-error" role="alert">{phoneError}</p>}
        {passwordRequired && (
          <label className="lg2-field lg2-field--required">
            <span>{t("UI.lg.welcome.password")}</span>
            <input
              ref={passwordInput}
              type="password"
              required
              maxLength={200}
              autoComplete="current-password"
              value={password}
              placeholder={t("UI.lg.welcome.passwordPlaceholder")}
              onChange={(event) => setPassword(event.target.value)}
              data-testid="messages-password"
            />
          </label>
        )}
        <button
          className="lg2-primary-button"
          type="submit"
          disabled={
            !unit.trim() ||
            !name.trim() ||
            (phone.match(/\d/g)?.length ?? 0) < 6 ||
            (passwordRequired && !password.trim())
          }
        >
          {t("UI.lg.welcome.save")}
        </button>
        {allowLater && (
          <button className="lg2-later" type="button" onClick={onLater}>
            {t("UI.lg.welcome.later")}
          </button>
        )}
      </form>
    </div>
  );
}

function NoticesSheet({ notices, onClose, t }: any) {
  const grouped = useMemo(() => {
    const today: any[] = [];
    const yesterday: any[] = [];
    const older: any[] = [];
    for (const notice of notices) {
      const row = { ...notice, isNew: isNewNotice(notice) };
      const group = noticeDayGroup(notice);
      if (group === "today") today.push(row);
      else if (group === "yesterday") yesterday.push(row);
      else older.push(row);
    }
    return { today, yesterday, older };
  }, [notices]);

  return (
    <div className="lg2-sheet-overlay" role="presentation" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lg2-welcome-sheet" role="dialog" aria-modal="true" aria-labelledby="notices-title">
        <div className="lg2-grabber" aria-hidden="true" />
        <h2 className="lg2-notices-title" id="notices-title">{t("UI.lg.notices.title")}</h2>
        <div className="lg2-subs">
          {grouped.today.length > 0 && <div className="lg2-notice-group">{t("UI.lg.notices.today")}</div>}
          {grouped.today.map(n => <NoticeRow key={n.id} n={n} t={t} />)}

          {grouped.yesterday.length > 0 && <div className="lg2-notice-group">{t("UI.lg.notices.yesterday")}</div>}
          {grouped.yesterday.map(n => <NoticeRow key={n.id} n={n} t={t} />)}

          {grouped.older.map(n => <NoticeRow key={n.id} n={n} t={t} />)}

          {notices.length === 0 && <p className="lg2-notices-empty">{t("UI.lg.notices.empty")}</p>}
        </div>
      </div>
    </div>
  );
}

function NoticeRow({ n, t }: { n: any, t: UiTranslator }) {
  return (
    <div className="lg2-notice-row">
      {n.media?.[0] && <img src={mediaImgSrc(n.media[0], 620)} alt="" className="lg2-notice-thumb" style={imageStyle(n.media[0])} />}
      <div>
        <b>{n.title}</b>
        <small>{n.body ? sanitizeHtml(n.body).replace(/<[^>]+>/g, '') : ""}</small>
      </div>
      {n.isNew && <span className="lg2-new">{t("UI.lg.notices.new")}</span>}
    </div>
  );
}

function GridView({ tenant, section, lang, t, guest, onEditGuest, onOpenCategory, onOpenNotices, helpCategoryId, notices, orderSummary, onOpenOrders, onOpenOffer }: any) {
  const categories = visible(section.categories);
  const featuredCategory = categories.find(isOperationalRulesCategory) ??
    categories.find((c: any) => { const firstItem = visible(c.items)[0]; return !firstItem?.tint && !!firstMedia(c); });
  const orderedCategories = featuredCategory ? [featuredCategory, ...categories.filter((c: any) => c.id !== featuredCategory.id)] : categories;

  const hasNew = notices.some(isNewNotice);

  return (
    <section className="lg2-view lg2-grid-view">
      <header className="lg2-grid-header">
        <div>
          <p>{tenant.name}</p>
          <h1>{section.title}</h1>
        </div>
        {notices.length > 0 && (
          <button className={`lg2-bell${hasNew ? " lg2-bell--dot" : ""}`} type="button" onClick={onOpenNotices} aria-label={t("UI.lg.notices.title")}>
            <svg aria-hidden="true"><use href="#lg-i-bell"/></svg>
          </button>
        )}
      </header>
      <div className="lg2-screen-scroll" data-lg-scroll>
        {guest && (
          <div style={{ margin: "0 16px 12px" }}>
            <button className="lg2-greeting" style={{ margin: 0, width: "100%" }} type="button" onClick={onEditGuest}>
              <span className="lg2-greeting-icon" aria-hidden="true"><svg><use href="#lg-i-usr" /></svg></span>
              <span>
                <b>{guest.name ? t("UI.lg.greeting.named", { name: guest.name }) : t("UI.lg.greeting.generic")}</b>
                <small>{t("UI.lg.greeting.ordersTo")} {guest.unit}</small>
              </span>
              <em>{t("UI.lg.greeting.change")}</em>
            </button>
          </div>
        )}
        {orderSummary && (
          <button
            className="lg2-orders-entry"
            type="button"
            onClick={onOpenOrders}
            data-testid="my-orders-entry"
          >
            <span className="lg2-orders-entry-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
                <path d="M3 6h18"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </span>
            <span>
              <b>{t("UI.lg.order.myOrders")}</b>
              <small>
                {orderSummary.openCount > 0
                  ? t("UI.lg.order.entryOpen", { count: orderSummary.openCount })
                  : t("UI.lg.order.entryClosed", { count: orderSummary.totalCount })}
              </small>
            </span>
            <span className="lg2-orders-entry-arrow" aria-hidden="true">›</span>
          </button>
        )}
        <div className="lg2-grid lg2-stagger">
          {orderedCategories.map((category: any, index: number) => {
            const item = visible(category.items)[0];
            const media = firstMedia(category);
            const isPhotoCard = !!media || (!!item?.title && !item?.tint);
            const isWide = category.id === featuredCategory?.id;
            const supporting = distinctSubtitle(category.label, category.subtitle);
            const staggerStyle = { "--lg2-delay": `${0.05 + Math.min(index, 6) * 0.06}s` } as CSSProperties;

            if (isPhotoCard) {
              return (
                <button key={category.id} data-lg-card={category.label} className={`lg2-photo-card${isWide ? " lg2-photo-card--wide" : ""}`} style={staggerStyle} type="button" onClick={() => onOpenCategory(category.id)}>
                  {media ? (
                    <img data-lg-card-image src={mediaImgSrc(media, CARD_IMAGE_WIDTH)} alt="" loading={index < 2 ? "eager" : "lazy"} decoding="async" style={imageStyle(media)} />
                  ) : (
                    <div className="lg2-photo-card-media lg2-card-ambient" data-lg-card-ambient aria-hidden="true" />
                  )}
                  <span>
                    <b>{category.label}</b>
                    {adminCategoryNote(category) && <small>{adminCategoryNote(category)}</small>}
                    {!adminCategoryNote(category) && supporting && <small>{supporting}</small>}
                  </span>
                </button>
              );
            }
            return (
              <button key={category.id} className={`lg2-utility-card${isWide ? " lg2-utility-card--wide" : ""}`} style={staggerStyle} type="button" onClick={() => onOpenCategory(category.id)}>
                <span className="lg2-utility-icon" aria-hidden="true"><svg><use href={`#lg-i-${categoryIcon(category)}`} /></svg></span>
                <span>
                  <b>{category.label}</b>
                  {adminCategoryNote(category) && <small>{adminCategoryNote(category)}</small>}
                </span>
              </button>
            );
          })}
          {onOpenOffer && (
            <button
              className="lg2-utility-card"
              type="button"
              onClick={onOpenOffer}
              data-testid="button-stay-offer"
            >
              <span className="lg2-utility-icon" aria-hidden="true">
                <svg><use href="#lg-i-bag" /></svg>
              </span>
              <span><b>{t("UI.lg.nav.offer")}</b></span>
            </button>
          )}
        </div>
        {helpCategoryId && (
          <div className="lg2-help-entry">
            <button type="button" onClick={() => onOpenCategory(helpCategoryId)}>{t("UI.lg.helpEmergency")}</button>
          </div>
        )}
      </div>
    </section>
  );
}

// Shared Okolica building blocks (prototype .gtabs / .pcard), reused verbatim
// by the Okolica, Ponudba and Nastanitev screens — never re-implemented.
function GroupTabs({ groups, selectedKey, onSelect, label }: any) {
  return (
    <div
      className="lg2-gtabs"
      role="tablist"
      aria-label={label}
      data-lg-scroll-x
    >
      {groups.map((group: any) => (
        <button
          type="button"
          role="tab"
          aria-selected={group.key === selectedKey}
          className={group.key === selectedKey ? "is-active" : undefined}
          key={group.key}
          onClick={() => onSelect(group.key)}
        >
          {group.label}
        </button>
      ))}
    </div>
  );
}

function PCard({ ariaLabel, onOpen, media, meta, title, description, categoryIcon: icon = "doc", adminNote }: any) {
  return (
    <article
      className={`lg2-pcard${adminNote?.startsWith("Neaktivna") ? " lg2-pcard--inactive" : ""}`}
      data-admin-state={adminNote || undefined}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className={`lg2-pcard-photo${media ? "" : " lg2-card-ambient"}`}>
        {media && (
          <img
            src={mediaImgSrc(media, CARD_IMAGE_WIDTH)}
            alt=""
            loading="lazy"
            decoding="async"
            style={imageStyle(media)}
          />
        )}
        {!media && (
          <span className="lg2-card-missing-photo" aria-label="fotografija manjka">
            <svg aria-hidden="true"><use href={`#lg-i-${icon}`} /></svg>
            <span>fotografija manjka</span>
          </span>
        )}
      </div>
      <div className="lg2-pcard-body">
        <div className="lg2-pcard-meta">{meta}</div>
        <h3><RichInline value={title} /></h3>
        {adminNote && <p className="lg2-admin-category-note">{adminNote}</p>}
        {description && <p>{description}</p>}
      </div>
    </article>
  );
}

function useGroupTabsState(groups: any[]) {
  const [activeGroup, setActiveGroup] = useState<string | null>(
    groups[0]?.key ?? null,
  );
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!groups.some((group) => group.key === activeGroup)) {
      setActiveGroup(groups[0]?.key ?? null);
    }
  }, [activeGroup, groups]);

  const selectedGroup =
    groups.find((group) => group.key === activeGroup) ?? groups[0];

  const selectGroup = (groupKey: string) => {
    setActiveGroup(groupKey);
    listRef.current?.scrollTo({ top: 0, behavior: "auto" });
    navigator.vibrate?.(6);
  };

  return { listRef, selectedGroup, selectGroup };
}

function ExploreView({
  tenant,
  categories,
  lang,
  t,
  onOpenCategory,
  onOpenItem,
  onBack,
}: any) {
  const activeCategories = useMemo(
    () => activeExploreCategories(categories),
    [categories],
  );
  const categoryChips = useMemo(
    () => [
      { key: EXPLORE_ALL_CATEGORY_KEY, label: t("UI.lg.categoryFilter.all") },
      ...activeCategories.map((category: any) => ({
        key: category.id,
        label: category.label,
      })),
    ],
    [activeCategories, t],
  );
  const {
    listRef,
    selectedGroup: selectedCategoryChip,
    selectGroup: selectCategoryChip,
  } = useGroupTabsState(categoryChips);
  const filteredItems = useMemo(
    () =>
      exploreItemsForCategory(
        activeCategories,
        selectedCategoryChip?.key ?? EXPLORE_ALL_CATEGORY_KEY,
      ),
    [activeCategories, selectedCategoryChip?.key],
  );
  const distanceSections = useMemo(
    () => groupExploreItemsByDistance(filteredItems),
    [filteredItems],
  );
  const emptyCategories = useMemo(() => {
    const selectedCategories =
      selectedCategoryChip?.key === EXPLORE_ALL_CATEGORY_KEY
        ? activeCategories
        : activeCategories.filter(
            (category: any) => category.id === selectedCategoryChip?.key,
          );
    return selectedCategories.filter(
      (category: any) => visible(category.items).length === 0,
    );
  }, [activeCategories, selectedCategoryChip?.key]);

  const openPlace = (categoryId: string, itemId: string) => {
    navigator.vibrate?.(6);
    onOpenItem(categoryId, itemId);
  };

  return (
    <section className="lg2-view lg2-explore-view" data-testid="screen-explore">
      {onBack && (
        <button
          className="lg2-detail-back"
          type="button"
          onClick={onBack}
          aria-label={t("UI.lg.action.back")}
          data-testid="explore-sheet-back"
        >
          <svg aria-hidden="true"><use href="#lg-i-bk" /></svg>
        </button>
      )}
      <header className="lg2-explore-header">
        <p>{tenant.name}</p>
        <h1>{t("UI.lg.exploreTitle")}</h1>
      </header>
      <GroupTabs
        groups={categoryChips}
        selectedKey={selectedCategoryChip?.key}
        onSelect={selectCategoryChip}
        label={t("UI.lg.exploreTitle")}
      />
      <div
        className="lg2-screen-scroll lg2-explore-list"
        data-lg-scroll
        ref={listRef}
      >
        {distanceSections.map((section) => (
          <section className="lg2-distance-section" key={section.key}>
            {section.labelKey && (
              <h2 className="lg2-distance-section-heading">{t(section.labelKey)}</h2>
            )}
            {section.items.map(({ item, category }: any) => {
              const distance = itemDistanceText(item);
              const status = itemOpenStatus(item, t);
              return (
                <PCard
                  key={item.id}
                  ariaLabel={item.title || category.label}
                  onOpen={() => openPlace(category.id, item.id)}
                  media={normalizeGuestMedia(item.media)[0]}
                  categoryIcon={categoryIcon(category)}
                  meta={
                    <>
                      {distance && <span className="lg2-pcard-distance">{distance}</span>}
                      {distance && <i aria-hidden="true" />}
                      {status ? (
                        <span className={`lg2-pcard-status${status.isOpen ? " is-open" : ""}`}>
                          {status.text}
                        </span>
                      ) : (
                        <span className="lg2-pcard-category">{category.label}</span>
                      )}
                    </>
                  }
                  title={item.title || category.label}
                  description={exploreItemDescription(item, category)}
                  adminNote={adminCategoryNote(category)}
                />
              );
            })}
          </section>
        ))}
        {emptyCategories.map((category: any) => (
            <PCard
              key={category.id}
              ariaLabel={category.label}
              onOpen={() => onOpenCategory(category.id)}
              categoryIcon={categoryIcon(category)}
              meta={<span className="lg2-pcard-category">{category.label}</span>}
              title={category.label}
              adminNote={adminCategoryNote(category)}
            />
          ))}
      </div>
    </section>
  );
}

// Ponudba (prototype #v-shop): one card per ITEM, meta = authored price
// text · CATEGORY; "Moja naročila" row on top when this device has orders.
function ShopView({ tenant, section, t, orderSummary, onOpenOrders, onOpenItem, onOpenCategory }: any) {
  const groups = useMemo(
    () =>
      populatedSectionGroups(section.categories, OFFER_GROUPS),
    [section.categories],
  );
  const { listRef, selectedGroup, selectGroup } = useGroupTabsState(groups);

  const openOffer = (categoryId: string, itemId: string) => {
    navigator.vibrate?.(6);
    onOpenItem(categoryId, itemId);
  };

  return (
    <section className="lg2-view lg2-explore-view" data-testid="screen-offer">
      <header className="lg2-grid-header">
        <div>
          <p>{tenant.name}</p>
          <h1>{section.title}</h1>
        </div>
      </header>
      <GroupTabs
        groups={groups.map((group) => ({ key: group.key, label: t(group.labelKey) }))}
        selectedKey={selectedGroup?.key}
        onSelect={selectGroup}
        label={section.title}
      />
      <div
        className="lg2-screen-scroll lg2-explore-list"
        data-lg-scroll
        ref={listRef}
      >
        {orderSummary && (
          <button
            className="lg2-orders-entry"
            type="button"
            onClick={onOpenOrders}
            data-testid="my-orders-entry"
          >
            <span className="lg2-orders-entry-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
                <path d="M3 6h18"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </span>
            <span>
              <b>{t("UI.lg.order.myOrders")}</b>
              <small>
                {orderSummary.openCount > 0
                  ? t("UI.lg.order.entryOpen", { count: orderSummary.openCount })
                  : t("UI.lg.order.entryClosed", { count: orderSummary.totalCount })}
              </small>
            </span>
            <span className="lg2-orders-entry-arrow" aria-hidden="true">›</span>
          </button>
        )}
        {selectedGroup?.items.map(({ item, category }: any) => {
          const price = itemPriceText(item, t);
          return (
            <PCard
              key={item.id}
              ariaLabel={item.title || category.label}
              onOpen={() => openOffer(category.id, item.id)}
              media={normalizeGuestMedia(item.media)[0] ?? firstMedia(category)}
              categoryIcon={categoryIcon(category)}
              meta={
                <>
                  {price && <span>{price}</span>}
                  {price && <i aria-hidden="true" />}
                  <span className="lg2-pcard-category">{category.label}</span>
                </>
              }
              title={item.title || category.label}
              description={exploreItemDescription(item, category)}
              adminNote={adminCategoryNote(category)}
            />
          );
        })}
        {selectedGroup?.categories
          .filter((category: any) => visible(category.items).length === 0)
          .map((category: any) => (
            <PCard
              key={category.id}
              ariaLabel={category.label}
              onOpen={() => onOpenCategory(category.id)}
              categoryIcon={categoryIcon(category)}
              meta={<span className="lg2-pcard-category">{category.label}</span>}
              title={category.label}
              adminNote={adminCategoryNote(category)}
            />
          ))}
      </div>
    </section>
  );
}

// Nastanitev (prototype #v-grid): one card per CATEGORY, meta = optional live
// status · category label; greeting strip directly under the tabs, quiet help
// link at the bottom of the list.
function StayView({ tenant, section, t, guest, onEditGuest, onOpenCategory, onOpenNotices, notices, helpCategoryId }: any) {
  const groups = useMemo(
    () =>
      populatedSectionGroups(section.categories, STAY_GROUPS),
    [section.categories],
  );
  const { listRef, selectedGroup, selectGroup } = useGroupTabsState(groups);
  const hasNew = notices.some(isNewNotice);

  const openStayCategory = (categoryId: string) => {
    navigator.vibrate?.(6);
    onOpenCategory(categoryId);
  };

  return (
    <section className="lg2-view lg2-explore-view" data-testid="screen-stay">
      <header className="lg2-grid-header">
        <div>
          <p>{tenant.name}</p>
          <h1>{section.title}</h1>
        </div>
        {notices.length > 0 && (
          <button className={`lg2-bell${hasNew ? " lg2-bell--dot" : ""}`} type="button" onClick={onOpenNotices} aria-label={t("UI.lg.notices.title")}>
            <svg aria-hidden="true"><use href="#lg-i-bell"/></svg>
          </button>
        )}
      </header>
      <GroupTabs
        groups={groups.map((group) => ({ key: group.key, label: t(group.labelKey) }))}
        selectedKey={selectedGroup?.key}
        onSelect={selectGroup}
        label={section.title}
      />
      <div
        className="lg2-screen-scroll lg2-explore-list"
        data-lg-scroll
        ref={listRef}
      >
        {guest && (
          <button className="lg2-greeting" type="button" onClick={onEditGuest}>
            <span className="lg2-greeting-icon" aria-hidden="true"><svg><use href="#lg-i-usr" /></svg></span>
            <span>
              <b>{guest.name ? t("UI.lg.greeting.named", { name: guest.name }) : t("UI.lg.greeting.generic")}</b>
              <small>{t("UI.lg.greeting.ordersTo")} {guest.unit}</small>
            </span>
            <em>{t("UI.lg.greeting.change")}</em>
          </button>
        )}
        {selectedGroup?.categories.map((category: any) => {
          const item = visible(category.items)[0];
          const status = item ? itemOpenStatus(item, t) : null;
          return (
            <PCard
              key={category.id}
              ariaLabel={category.label}
              onOpen={() => openStayCategory(category.id)}
              media={firstMedia(category)}
              categoryIcon={categoryIcon(category)}
              meta={
                <>
                  {status && (
                    <span className={`lg2-pcard-status${status.isOpen ? " is-open" : ""}`}>
                      {status.text}
                    </span>
                  )}
                  {status && <i aria-hidden="true" />}
                  <span className="lg2-pcard-category">{category.label}</span>
                </>
              }
              title={item?.title || category.label}
              description={item ? exploreItemDescription(item, category) : null}
              adminNote={adminCategoryNote(category)}
            />
          );
        })}
        {helpCategoryId && (
          <div className="lg2-help-entry">
            <button type="button" onClick={() => onOpenCategory(helpCategoryId)}>{t("UI.lg.helpEmergency")}</button>
          </div>
        )}
        {groups.length === 0 && (
          <div className="lg2-empty">{t("UI.lg.search.empty")}</div>
        )}
      </div>
    </section>
  );
}

function HeroGallery({ media, onBack, galleryIndex, onGalleryIndex, singleOnly, t }: any) {
  const galleryTrackRef = useRef<HTMLDivElement>(null);
  const settleTimeoutRef = useRef<number | null>(null);
  const suppressGalleryClickRef = useRef(false);
  const galleryDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startScrollLeft: number;
    axis: "horizontal" | "vertical" | null;
  } | null>(null);
  const frameWidth =
    typeof window === "undefined"
      ? 390
      : Math.min(window.innerWidth, DETAIL_SHELL_MAX_WIDTH);
  const viewportHeight =
    typeof window === "undefined" ? 844 : window.innerHeight;
  const activeIndex = singleOnly
    ? 0
    : Math.max(0, Math.min((media?.length ?? 1) - 1, galleryIndex ?? 0));
  const isUniformGallery = !singleOnly && (media?.length ?? 0) > 1;
  const isSingleHero = !isUniformGallery;
  const activeEntry = media?.[activeIndex] ?? media?.[0];
  const activeStableAspect = stableMediaAspect(
    activeEntry?.width,
    activeEntry?.height,
  );
  const galleryStableAspects: ReturnType<typeof stableMediaAspect>[] = (
    media ?? []
  ).map((entry: any) => stableMediaAspect(entry.width, entry.height));
  const galleryAspects = galleryStableAspects.map(({ aspect }) => aspect);
  const galleryUsesFallback = galleryStableAspects.some(
    ({ source }) => source === "fallback",
  );
  const uniformGalleryLayout = isUniformGallery
    ? calculateLivingGuideUniformGalleryLayout({
        containerWidth: frameWidth,
        imageAspects: galleryAspects,
        viewportHeight,
      })
    : null;
  const singleHeroLayout = isSingleHero
    ? calculateLivingGuideHeroLayout({
        containerWidth: frameWidth,
        imageAspect: activeStableAspect.aspect,
        viewportHeight,
      })
    : null;
  const activeAspectSource = isUniformGallery
    ? galleryUsesFallback
      ? "fallback"
      : "payload"
    : activeStableAspect.source;
  const heroLayout = singleHeroLayout;
  const heroHeight =
    uniformGalleryLayout?.heroHeight ?? singleHeroLayout?.heroHeight ?? 0;
  const sideBlur = singleHeroLayout?.branch === "side-blur";
  const layoutReady =
    uniformGalleryLayout !== null || singleHeroLayout !== null;
  const activeNaturalHeight = isUniformGallery
    ? uniformGalleryLayout?.naturalHeights[activeIndex]
    : singleHeroLayout?.naturalHeight;

  const mediaKey = (media ?? [])
    .map((entry: any, index: number) => entry.id ?? entry.url ?? index)
    .join("|");
  const previousMediaKeyRef = useRef(mediaKey);
  useEffect(() => {
    if (previousMediaKeyRef.current === mediaKey) return;
    previousMediaKeyRef.current = mediaKey;
    onGalleryIndex?.(0);
  }, [mediaKey, onGalleryIndex]);

  const settleGallery = useCallback(
    (track: HTMLDivElement) => {
      const nextIndex = nearestGalleryIndex(
        track.scrollLeft,
        track.clientWidth,
        media?.length ?? 0,
      );
      const targetLeft = nextIndex * track.clientWidth;
      if (Math.abs(track.scrollLeft - targetLeft) > 0.5) {
        track.scrollTo({ left: targetLeft, behavior: "auto" });
      }
      onGalleryIndex(nextIndex);
    },
    [media?.length, onGalleryIndex],
  );

  const scheduleGallerySettle = useCallback(
    (track: HTMLDivElement) => {
      if (settleTimeoutRef.current !== null) {
        window.clearTimeout(settleTimeoutRef.current);
      }
      settleTimeoutRef.current = window.setTimeout(() => {
        settleTimeoutRef.current = null;
        settleGallery(track);
      }, 120);
    },
    [settleGallery],
  );

  const beginGalleryDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (
        !isUniformGallery ||
        !event.isPrimary ||
        event.button !== 0 ||
        galleryDragRef.current
      ) {
        return;
      }
      galleryDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: event.currentTarget.scrollLeft,
        axis: null,
      };
      suppressGalleryClickRef.current = false;
      event.currentTarget.dataset.lgGalleryDragging = "true";
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [isUniformGallery],
  );

  const moveGalleryDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = galleryDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= 6) {
        drag.axis =
          Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
        event.currentTarget.dataset.lgGalleryAxis = drag.axis;
      }
      if (drag.axis !== "horizontal") return;
      suppressGalleryClickRef.current = true;
      event.currentTarget.scrollLeft = drag.startScrollLeft - dx;
      event.preventDefault();
    },
    [],
  );

  const finishGalleryDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = galleryDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      galleryDragRef.current = null;
      delete event.currentTarget.dataset.lgGalleryDragging;
      delete event.currentTarget.dataset.lgGalleryAxis;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (drag.axis === "horizontal") {
        settleGallery(event.currentTarget);
      }
    },
    [settleGallery],
  );

  useEffect(() => {
    const track = galleryTrackRef.current;
    if (!track || !isUniformGallery || !media?.length) return;

    const handleScrollEnd = () => {
      if (settleTimeoutRef.current !== null) {
        window.clearTimeout(settleTimeoutRef.current);
        settleTimeoutRef.current = null;
      }
      settleGallery(track);
    };

    track.addEventListener("scrollend", handleScrollEnd);
    return () => {
      track.removeEventListener("scrollend", handleScrollEnd);
      if (settleTimeoutRef.current !== null) {
        window.clearTimeout(settleTimeoutRef.current);
        settleTimeoutRef.current = null;
      }
    };
  }, [isUniformGallery, media?.length, mediaKey, settleGallery]);

  useLayoutEffect(() => {
    const track = galleryTrackRef.current;
    if (!track || !isUniformGallery || !track.clientWidth) return;
    const targetLeft = activeIndex * track.clientWidth;
    if (Math.abs(track.scrollLeft - targetLeft) > 0.5) {
      track.scrollTo({ left: targetLeft, behavior: "auto" });
    }
  }, [activeIndex, frameWidth, isUniformGallery, mediaKey]);

  if (!media?.length) return (
    <div
      className="lg2-detail-hero lg2-detail-hero--ambient"
      data-lg-ambient-hero
      onClick={(event) => {
        event.stopPropagation();
        onBack();
      }}
    />
  );
  if (isSingleHero) {
    const entry = media[0];
    const expected = stableMediaAspect(entry.width, entry.height);
    return (
      <div
        className={`lg2-detail-hero lg2-detail-hero--photo${layoutReady ? " is-layout-ready" : " is-awaiting-dimensions"}`}
        data-lg-hero-height={Math.round(heroHeight)}
        data-lg-hero-natural-height={heroLayout?.naturalHeight}
        data-lg-hero-branch={heroLayout?.branch}
        data-lg-hero-aspect-source={activeAspectSource}
        data-lg-hero-layout-ready={layoutReady}
      >
        <div className="lg2-gallery-track">
          <div className="lg2-gallery-slide">
            <AspectAwareHeroImage
              entry={entry}
              loading="eager"
              sideBlur={sideBlur}
              aspectReady
              expectedAspect={expected.aspect}
              aspectSource={expected.source}
            />
          </div>
        </div>
        {entry?.provisional &&
          entry?.attributionAuthor &&
          entry?.attributionLicense &&
          entry?.attributionSourceUrl && (
            <p className="lg2-media-attribution">
              {entry.attributionAuthor} · {entry.attributionLicense} ·{" "}
              <a href={entry.attributionSourceUrl} target="_blank" rel="noreferrer">Wikimedia Commons</a>
            </p>
          )}
      </div>
    );
  }
  return (
    <div
      className={`lg2-detail-hero lg2-detail-hero--photo${layoutReady ? " is-layout-ready" : " is-awaiting-dimensions"} is-uniform-gallery`}
      data-lg-active-slide={activeIndex}
      data-lg-hero-height={Math.round(heroHeight)}
      data-lg-hero-natural-height={activeNaturalHeight}
      data-lg-hero-branch="gallery-cover"
      data-lg-hero-aspect-source={activeAspectSource}
      data-lg-hero-layout-ready={layoutReady}
      data-lg-hero-mode="uniform-gallery"
      data-lg-gallery-uniform-height={Math.round(heroHeight)}
      data-lg-gallery-median-height={uniformGalleryLayout?.medianHeight}
      data-lg-gallery-natural-heights={uniformGalleryLayout ? JSON.stringify(uniformGalleryLayout.naturalHeights) : undefined}
      data-lg-gallery-min-height={uniformGalleryLayout?.minHeight}
      data-lg-gallery-max-height={uniformGalleryLayout?.maxHeight}
    >
      <div
        ref={galleryTrackRef}
        className="lg2-gallery-track"
        data-lg-gallery
        onScroll={(event) => scheduleGallerySettle(event.currentTarget)}
        onPointerDown={beginGalleryDrag}
        onPointerMove={moveGalleryDrag}
        onPointerUp={finishGalleryDrag}
        onPointerCancel={finishGalleryDrag}
        onDragStart={(event) => event.preventDefault()}
        onClick={(event) => {
          if (!suppressGalleryClickRef.current) return;
          suppressGalleryClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {media.map((entry: any, index: number) => {
          const entryKey = String(entry.id ?? entry.url ?? index);
          const expected = stableMediaAspect(entry.width, entry.height);
          return (
            <div className="lg2-gallery-slide" key={entryKey}>
              <AspectAwareHeroImage
                entry={entry}
                loading={index === 0 || !layoutReady ? "eager" : "lazy"}
                sideBlur={false}
                galleryCover
                aspectReady
                expectedAspect={expected.aspect}
                aspectSource={expected.source}
              />
            </div>
          );
        })}
      </div>
      {media.length > 1 && (
        <div className="lg2-gallery-dots" aria-hidden="true">
          {media.map((_: any, index: number) => <i key={index} className={index === activeIndex ? "is-active" : undefined} />)}
        </div>
      )}
      {media[activeIndex]?.provisional &&
        media[activeIndex]?.attributionAuthor &&
        media[activeIndex]?.attributionLicense &&
        media[activeIndex]?.attributionSourceUrl && (
          <p className="lg2-media-attribution">
            {media[activeIndex].attributionAuthor} · {media[activeIndex].attributionLicense} ·{" "}
            <a href={media[activeIndex].attributionSourceUrl} target="_blank" rel="noreferrer">Wikimedia Commons</a>
          </p>
        )}
    </div>
  );
}

function AspectAwareHeroImage({
  entry,
  loading,
  sideBlur,
  galleryCover = false,
  aspectReady,
  expectedAspect,
  aspectSource,
}: {
  entry: any;
  loading: "eager" | "lazy";
  sideBlur: boolean;
  galleryCover?: boolean;
  aspectReady: boolean;
  expectedAspect: number;
  aspectSource: "payload" | "fallback";
}) {
  const source = mediaImgSrc(entry, HERO_IMAGE_WIDTH);

  return (
    <div
      className={`lg2-hero-image-frame${sideBlur ? " is-side-blur" : galleryCover ? " is-gallery-cover" : " is-full-bleed"}`}
      data-lg-hero-fit={sideBlur ? "side-blur" : galleryCover ? "gallery-cover" : "full-bleed"}
    >
      {sideBlur && (
        <img
          className="lg2-hero-image-blur"
          src={source}
          alt=""
          aria-hidden="true"
          draggable={false}
          decoding="async"
        />
      )}
      <img
        className={`lg2-hero-image-main${aspectReady ? " is-ready" : ""}`}
        data-lg-hero-image
        data-lg-aspect-source={aspectSource}
        src={source}
        alt=""
        draggable={false}
        loading={loading}
        decoding="async"
        style={galleryCover ? imageStyle(entry) : undefined}
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth > 0 && image.naturalHeight > 0) {
            const naturalAspect = image.naturalWidth / image.naturalHeight;
            const relativeError =
              Math.abs(naturalAspect - expectedAspect) / expectedAspect;
            image.dataset.lgDimensionsConfirmed =
              relativeError <= 0.01 ? "true" : "mismatch";
          }
        }}
      />
    </div>
  );
}

const DETAIL_SHEET_CLOSE_DISTANCE = 72;
const DETAIL_SHEET_CLOSE_VELOCITY = 0.55;
const DETAIL_SHEET_MOMENTUM_MS = 180;
const DETAIL_SHEET_MAX_MOMENTUM = 54;

function useDraggableDetailSheet(
  rootRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const sheet = root?.querySelector<HTMLElement>(".lg2-detail-sheet");
    const sheetRoot = root?.querySelector<HTMLElement>(".lg2-detail-sheet-root");
    if (!root || !sheet || !sheetRoot) return;

    let activePointerId: number | null = null;
    let startClientY = 0;
    let startOffset = 0;
    let currentOffset = 0;
    let lastClientY = 0;
    let lastMoveAt = 0;
    let velocity = 0;
    let minOffset = 0;
    let initialTop = 0;
    let closeTimer: number | null = null;
    let resizeFrame: number | null = null;

    const writeOffset = (
      offset: number,
      phase: "idle" | "dragging" | "settling" | "closing" = "idle",
    ) => {
      currentOffset = offset;
      sheet.style.setProperty("--lg2-sheet-translate-y", `${offset}px`);
      sheet.dataset.lgSheetPhase = phase;
      sheet.dataset.lgSheetOffset = String(Math.round(offset));
    };

    const measure = () => {
      const startsAtTop =
        sheet.classList.contains("lg2-detail-sheet--full-height") ||
        sheet.classList.contains("lg2-detail-sheet--solo");
      sheet.toggleAttribute("data-lg-sheet-starts-at-top", startsAtTop);
      sheetRoot.toggleAttribute("data-lg-sheet-starts-at-top", startsAtTop);
      sheet.style.top = startsAtTop ? "0px" : "";
      initialTop = sheet.offsetTop;
      const viewportHeight = sheetRoot.clientHeight;
      minOffset = Math.min(
        0,
        viewportHeight - initialTop - sheet.scrollHeight,
      );
      sheet.dataset.lgSheetInitialTop = String(Math.round(initialTop));
      sheet.dataset.lgSheetMinOffset = String(Math.round(minOffset));
      writeOffset(Math.max(minOffset, Math.min(0, currentOffset)));
    };

    const scheduleMeasure = () => {
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        measure();
      });
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(sheet);
    resizeObserver?.observe(sheetRoot);
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("orientationchange", scheduleMeasure);
    void document.fonts?.ready.then(scheduleMeasure);
    measure();

    const ignoredDragTarget = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(
        target.closest(
          ".lg2-gallery-track,.lg2-detail-back,.lg2-order-dock,button,a,input,textarea,select,[contenteditable='true']",
        ),
      );

    const onPointerDown = (event: PointerEvent) => {
      if (
        activePointerId !== null ||
        event.button !== 0 ||
        !event.isPrimary ||
        ignoredDragTarget(event.target)
      ) {
        return;
      }
      activePointerId = event.pointerId;
      startClientY = event.clientY;
      startOffset = currentOffset;
      lastClientY = event.clientY;
      lastMoveAt = event.timeStamp;
      velocity = 0;
      sheet.setPointerCapture(event.pointerId);
      writeOffset(currentOffset, "dragging");
    };

    const onPointerMove = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) return;
      const elapsed = Math.max(1, event.timeStamp - lastMoveAt);
      velocity = (event.clientY - lastClientY) / elapsed;
      lastClientY = event.clientY;
      lastMoveAt = event.timeStamp;
      const rawOffset = startOffset + event.clientY - startClientY;
      const resistedOffset =
        rawOffset < minOffset
          ? minOffset + (rawOffset - minOffset) * 0.16
          : rawOffset;
      writeOffset(resistedOffset, "dragging");
      event.preventDefault();
    };

    const finishPointer = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) return;
      activePointerId = null;
      if (sheet.hasPointerCapture(event.pointerId)) {
        sheet.releasePointerCapture(event.pointerId);
      }

      const shouldClose =
        currentOffset >= DETAIL_SHEET_CLOSE_DISTANCE ||
        (currentOffset > 0 && velocity >= DETAIL_SHEET_CLOSE_VELOCITY);
      if (shouldClose) {
        writeOffset(sheetRoot.clientHeight + 32, "closing");
        closeTimer = window.setTimeout(
          () => onCloseRef.current(),
          DETAIL_SHEET_MOMENTUM_MS,
        );
        return;
      }

      if (currentOffset > 0) {
        writeOffset(0, "settling");
        return;
      }

      const momentum = Math.max(
        -DETAIL_SHEET_MAX_MOMENTUM,
        Math.min(
          DETAIL_SHEET_MAX_MOMENTUM,
          velocity * DETAIL_SHEET_MOMENTUM_MS,
        ),
      );
      const projected = currentOffset + momentum;
      writeOffset(Math.max(minOffset, Math.min(0, projected)), "settling");
    };

    sheet.addEventListener("pointerdown", onPointerDown);
    sheet.addEventListener("pointermove", onPointerMove, { passive: false });
    sheet.addEventListener("pointerup", finishPointer);
    sheet.addEventListener("pointercancel", finishPointer);

    return () => {
      if (closeTimer !== null) window.clearTimeout(closeTimer);
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("orientationchange", scheduleMeasure);
      sheet.removeEventListener("pointerdown", onPointerDown);
      sheet.removeEventListener("pointermove", onPointerMove);
      sheet.removeEventListener("pointerup", finishPointer);
      sheet.removeEventListener("pointercancel", finishPointer);
    };
  }, [rootRef]);
}

function DetailView({ category, itemId, lang, t, galleryIndex, onGalleryIndex, onBack, tenant, onOpenItem, showHostContacts, onOrderClick }: any) {
  const detailViewRef = useRef<HTMLElement>(null);
  useDraggableDetailSheet(detailViewRef, onBack);
  const items = visible(category.items);
  const activeItem = itemId ? items.find((i: any) => i.id === itemId) : null;

  const layout = category.layout || "";

  let content = null;
  if (activeItem) {
    if (layout === "poi") {
      content = <TemplateF item={activeItem} category={category} lang={lang} t={t} onBack={onBack} onOrderClick={onOrderClick} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
    } else if (layout === "routes") {
      content = <TemplateG item={activeItem} category={category} t={t} onBack={onBack} onOrderClick={onOrderClick} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
    } else if (layout === "tabs") {
      content = <TemplateB2 key={activeItem.id} items={items} initialItemId={activeItem.id} onOrderClick={onOrderClick} category={category} t={t} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
    } else {
        content = <TemplateA category={category} items={[activeItem]} onOrderClick={onOrderClick} mediaOverride={normalizeGuestMedia(activeItem.media)} titleOverride={activeItem.title} tenant={tenant} lang={lang} t={t} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
    }
  } else {
    if (layout === "wifi") {
      content = <TemplateE category={category} items={items} tenant={tenant} t={t} onBack={onBack} />;
    } else if (layout === "tabs" && items.length === 2) {
      content = <TemplateD category={category} items={items} t={t} onBack={onBack} onOrderClick={onOrderClick} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
    } else if (layout === "tabs" || layout === "apartments" || layout === "products" || layout === "poi" || layout === "routes" || layout === "events") {
      content = <TemplateB category={category} items={items} t={t} onBack={onBack} onOpenItem={onOpenItem} onOrderClick={onOrderClick} fullHeight={layout === "apartments"} />;
    } else if (layout === "rules") {
      if (isOperationalRulesCategory(category)) {
        content = <TemplateA category={category} items={items} tenant={tenant} onOrderClick={onOrderClick} showHostContacts={showHostContacts} lang={lang} t={t} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
      } else {
        content = <TemplateC category={category} items={items} t={t} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
      }
    } else {
      content = <TemplateA category={category} items={items} tenant={tenant} onOrderClick={onOrderClick} showHostContacts={showHostContacts} lang={lang} t={t} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
    }
  }

  return (
    <section
      ref={detailViewRef}
      className={`lg2-view lg2-detail-view${activeItem?.orderEnabled && layout !== "tabs" ? " has-order-dock" : ""}`}
      onClick={(event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          !target.closest(".lg2-detail-sheet,.lg2-order-dock,a,button,input,textarea,select")
        ) {
          onBack();
        }
      }}
    >
      {content}
      {activeItem?.orderEnabled && layout !== "tabs" && (
        <OrderDock item={activeItem} t={t} onOrderClick={onOrderClick} />
      )}
    </section>
  );
}

function OrderDock({ item, t, onOrderClick }: { item: any; t: UiTranslator; onOrderClick: (itemId: string) => void }) {
  return (
    <div className="lg2-order-dock" data-testid="order-dock">
      <div className="lg2-order-dock-inner">
        {(item.producerName || item.producerNote) && (
          <div className="lg2-order-producer">
            {item.producerName && <b>{item.producerName}</b>}
            {item.producerNote && <small>{item.producerNote}</small>}
          </div>
        )}
        {item.soldOut ? (
          <button className="lg2-primary-button lg2-primary-button--disabled" type="button" disabled>
            {t("UI.lg.order.soldOut")}
          </button>
        ) : (
          <button className="lg2-primary-button" type="button" onClick={() => onOrderClick(item.id)} data-testid={`order-cta-${item.id}`}>
            {t("UI.lg.order.title")}
          </button>
        )}
      </div>
    </div>
  );
}

// Template A: Content page (Bazen)
function TenantContactRows({ tenant, t }: { tenant: any; t: UiTranslator }) {
  const tenantMapsUrl = resolveTenantMapsUrl(tenant, "search");
  const viber = viberHref(tenant?.viber);
  const instagram = instagramLink(tenant?.instagram);
  const contacts = [
    tenant?.phone
      ? { key: "phone", icon: "phone", label: t("UI.contact.call"), value: tenant.phone, href: `tel:${tenant.phone}` }
      : null,
    tenant?.whatsapp
      /* wa.me prestreže aplikacija — brez target="_blank", da ne ostane prazen zavihek */
      ? { key: "whatsapp", icon: "chat", label: "WhatsApp", value: tenant.whatsapp, href: `https://wa.me/${String(tenant.whatsapp).replace(/\D/g, "")}` }
      : null,
    viber
      ? { key: "viber", icon: "viber", label: "Viber", value: tenant.viber, href: viber }
      : null,
    instagram
      ? { key: "instagram", icon: "instagram", label: "Instagram", value: instagram.label, href: instagram.href, external: true }
      : null,
    tenant?.email
      ? { key: "email", icon: "mail", label: t("UI.contact.email"), value: tenant.email, href: `mailto:${tenant.email}` }
      : null,
    tenant?.address && tenantMapsUrl
      ? { key: "address", icon: "pin", label: t("UI.contact.address"), value: tenant.address, href: tenantMapsUrl }
      : null,
  ].filter(Boolean) as Array<{ key: string; icon: string; label: string; value: string; href: string; external?: boolean }>;

  if (contacts.length === 0) return null;
  return (
    <div className="lg2-contact-list" data-lg-host-contacts>
      {contacts.map((contact) => (
        <a
          className="lg2-sub2"
          href={contact.href}
          key={contact.key}
          target={contact.external ? "_blank" : undefined}
          rel={contact.external ? "noopener noreferrer" : undefined}
        >
          <span className="lg2-sub-icon" aria-hidden="true"><svg><use href={`#lg-i-${contact.icon}`} /></svg></span>
          <span><b>{contact.label}</b><small>{contact.value}</small></span>
          <span className="lg2-chevron" aria-hidden="true">›</span>
        </a>
      ))}
    </div>
  );
}

function TemplateA({ category, items, mediaOverride, titleOverride, tenant, showHostContacts, t, onBack, galleryIndex, onGalleryIndex, onOrderClick }: any) {
  const firstItem = items[0] ?? null;
  const media = mediaOverride ?? categoryMedia(category);
  const heading = titleOverride || category.label;
  const introTitle = distinctSubtitle(
    heading,
    titleOverride ? firstItem?.subtitle : category?.subtitle,
  );
  const openStatus = itemOpenStatus(firstItem, t);
  const introBody = itemBodyHtml(firstItem, category);
  const firstItemBullets = itemBullets(firstItem, category);
  const price = itemPriceText(firstItem, t);
  const detailRows = items.slice(1).filter((i: any) => i.title || i.body || i.bullets?.length);

  return (
    <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
      <div className="lg2-detail-sheet-root">
        <HeroGallery media={media} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} t={t} />
        <article className="lg2-detail-sheet">
          <div className="lg2-grabber" aria-hidden="true" />
          {price ? (
            <div className="lg2-detail-title-row">
              <h1><RichInline value={heading} /></h1>
              <span className="lg2-price">{price}</span>
            </div>
          ) : (
            <h1><RichInline value={heading} /></h1>
          )}
          {openStatus && (
            <div className="lg2-chips">
              <span className={`lg2-chip${openStatus.isOpen ? " lg2-chip--open" : ""}`}>{openStatus.text}</span>
            </div>
          )}
          {introTitle && <p className="lg2-detail-lead">{introTitle}</p>}
          {introBody && <div className={`lg2-detail-prose${category?.layout === "products" && titleOverride ? " lg2-product-prose" : ""}`} dangerouslySetInnerHTML={{ __html: introBody }} />}
          <StructuredBulletRows bullets={firstItemBullets} />
          {detailRows.length > 0 && (
            <div className="lg2-rule-list">
              {detailRows.map((item: any) => (
                <div className={`lg2-rule-row${item.tint ? " lg2-rule-row--warning" : ""}`} key={item.id}>
                  <span className="lg2-rule-icon" aria-hidden="true"><svg><use href={`#lg-i-${item.tint ? "sos" : "doc"}`} /></svg></span>
                  <div>
                    {item.title && <b><RichInline value={item.title} /></b>}
                    {itemBodyHtml(item, category) && <span dangerouslySetInnerHTML={{ __html: itemBodyHtml(item, category) }} />}
                    <StructuredBulletRows bullets={itemBullets(item, category)} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {(itemMapsHref(firstItem) || firstItem?.phone || firstItem?.website) && (
            <div className="lg2-actions">
              {itemMapsHref(firstItem) && <a className="lg2-primary-button" href={itemMapsHref(firstItem) ?? undefined}><svg aria-hidden="true"><use href="#lg-i-nav2"/></svg>{t("UI.lg.action.maps")}</a>}
              {firstItem?.phone && <a className="lg2-primary-button lg2-secondary-button" href={`tel:${firstItem.phone}`}><svg aria-hidden="true"><use href="#lg-i-phone"/></svg>{t("UI.lg.action.call")}</a>}
              {firstItem?.website && <a className="lg2-primary-button lg2-secondary-button" href={externalUrl(firstItem.website)} target="_blank" rel="noopener noreferrer"><svg aria-hidden="true"><use href="#lg-i-comp"/></svg>{t("UI.lg.action.website")}</a>}
            </div>
          )}
          {showHostContacts && <TenantContactRows tenant={tenant} t={t} />}
        </article>
      </div>
    </div>
  );
}

// Template B: List page
function TemplateB({ category, items, t, onBack, onOpenItem, onOrderClick, fullHeight = false }: any) {
  const media = firstMedia(category) ? [firstMedia(category)] : [];
  return (
    <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
      <div className="lg2-detail-sheet-root">
        {!fullHeight && (
          <HeroGallery media={media} onBack={onBack} singleOnly={true} t={t} />
        )}
        <article className={`lg2-detail-sheet${fullHeight ? " lg2-detail-sheet--full-height" : ""}`}>
           <div className="lg2-grabber" aria-hidden="true" />
           <h1>{category.label}</h1>
           <div className="lg2-subs">
              {items.map((item: any) => {
                const subtitle = distinctSubtitle(item.title, item.subtitle);
                const status = itemOpenStatus(item, t);
                 const price = itemPriceText(item, t);
                 const supporting = itemSupportingText(
                   item,
                   subtitle,
                   status?.text,
                 );
                return (
                  <button type="button" className="lg2-sub2" key={item.id} onClick={() => onOpenItem(item.id)}>
                    <span className="lg2-sub-icon" aria-hidden="true">
                      {normalizeGuestMedia(item.media)[0] ? <img src={mediaImgSrc(normalizeGuestMedia(item.media)[0], CARD_IMAGE_WIDTH)} alt="" style={imageStyle(normalizeGuestMedia(item.media)[0])} className="lg2-sub-img" /> : <svg><use href={`#lg-i-${categoryIcon(category)}`}/></svg>}
                    </span>
                     <div className="lg2-sub-content">
                       <span className="lg2-row-title">
                         <b><RichInline value={item.title} /></b>
                         {price && <span className="lg2-price">{price}</span>}
                       </span>
                       {supporting && <small>{supporting}</small>}
                     </div>
                    <span className="lg2-chevron" aria-hidden="true">›</span>
                  </button>
                );
              })}
           </div>
        </article>
      </div>
    </div>
  );
}

// Template B2: Direct route into a tabbed detail
function TemplateB2({ items, initialItemId, category, ...props }: any) {
  return (
    <TabbedDetail
      {...props}
      category={category}
      items={items}
      initialItemId={initialItemId}
      numbered
    />
  );
}

// Template C: Rules
function TemplateC({ category, items, t, onBack, galleryIndex, onGalleryIndex }: any) {
  const media = categoryMedia(category);
  return (
    <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
      <div className="lg2-detail-sheet-root">
        <HeroGallery media={media} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} t={t} />
        <article className="lg2-detail-sheet">
          <div className="lg2-grabber" aria-hidden="true" />
          <h1>{category.label}</h1>
          <div className="lg2-rule-list">
             {items.map((item: any) => {
               const isWarning = !!item.tint;
               return (
                 <div className={`lg2-rule-row${isWarning ? " lg2-rule-row--warning" : ""}`} key={item.id}>
                   <span className="lg2-rule-icon" aria-hidden="true"><svg><use href={`#lg-i-${isWarning ? "sos" : "doc"}`}/></svg></span>
                   <div>
                     {item.title && <b><RichInline value={item.title} /></b>}
                     {itemBodyHtml(item, category) && <div dangerouslySetInnerHTML={{ __html: itemBodyHtml(item, category) }} />}
                     <StructuredBulletRows bullets={itemBullets(item, category)} />
                   </div>
                 </div>
               );
             })}
          </div>
        </article>
      </div>
    </div>
  );
}

function useEqualPanelHeight(panelCount: number) {
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const measurementFrameRef = useRef<number | null>(null);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);

  const measure = useCallback(() => {
    if (measurementFrameRef.current !== null) return;
    measurementFrameRef.current = window.requestAnimationFrame(() => {
      measurementFrameRef.current = null;
      const measured = panelRefs.current
        .slice(0, panelCount)
        .map((panel) => (panel?.isConnected ? panel.scrollHeight : 0));
      const tallest = Math.max(0, ...measured);
      if (tallest > 0) {
        const stableHeight = tallest + 1;
        setLockedHeight((current) =>
          current === stableHeight ? current : stableHeight,
        );
      }
    });
  }, [panelCount]);

  useLayoutEffect(() => {
    measure();
    return () => {
      if (measurementFrameRef.current !== null) {
        window.cancelAnimationFrame(measurementFrameRef.current);
        measurementFrameRef.current = null;
      }
    };
  }, [measure]);

  useEffect(() => {
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    panelRefs.current.slice(0, panelCount).forEach((panel) => {
      if (panel) observer?.observe(panel);
    });
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    let cancelled = false;
    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!cancelled) measure();
      });
    }
    document.fonts?.addEventListener?.("loadingdone", measure);
    return () => {
      cancelled = true;
      observer?.disconnect();
      if (measurementFrameRef.current !== null) {
        window.cancelAnimationFrame(measurementFrameRef.current);
        measurementFrameRef.current = null;
      }
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      document.fonts?.removeEventListener?.("loadingdone", measure);
    };
  }, [measure, panelCount]);

  return { panelRefs, lockedHeight };
}

function TabbedDetail({
  category,
  items,
  initialItemId,
  numbered = false,
  t,
  onBack,
  galleryIndex,
  onGalleryIndex,
  onOrderClick,
}: any) {
  const initialSegment = Math.max(
    0,
    items.findIndex((item: any) => item.id === initialItemId),
  );
  const [segment, setSegment] = useState(initialSegment);
  const { panelRefs, lockedHeight } = useEqualPanelHeight(items.length);
  const activeItem = items[segment] || items[0];

  useEffect(() => {
    setSegment(initialSegment);
  }, [initialSegment]);

  if (!activeItem) return null;
  const media = normalizeGuestMedia(activeItem.media);
  const panelBaseId = `lg2-segment-${category.id}`;

  return (
    <div className={`lg2-screen-scroll lg2-detail-scroll${activeItem.orderEnabled ? " lg2-detail-scroll--orderable" : ""}`} data-lg-scroll>
      <div className="lg2-detail-sheet-root">
        <HeroGallery media={media} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} t={t} />
        <article className="lg2-detail-sheet">
          <div className="lg2-grabber" aria-hidden="true" />
          <h1>{category.label}</h1>
          <div className="lg2-seg" role="tablist">
             {items.map((item: any, i: number) => (
                <button
                   id={`${panelBaseId}-tab-${item.id}`}
                  type="button"
                  role="tab"
                   aria-controls={`${panelBaseId}-panel-${item.id}`}
                  aria-selected={i === segment}
                  tabIndex={i === segment ? 0 : -1}
                  key={item.id}
                  className={i === segment ? "is-active" : ""}
                  onClick={() => { setSegment(i); onGalleryIndex(0); }}
                >
                  <RichInline value={item.title || item.label} />
                </button>
             ))}
          </div>
           <div
             className="lg2-segment-panels"
             data-lg-panel-locked-height={lockedHeight ?? undefined}
             style={lockedHeight === null ? undefined : { height: lockedHeight }}
           >
             {items.map((item: any, index: number) => (
               <div
                 id={`${panelBaseId}-panel-${item.id}`}
                 ref={(node) => { panelRefs.current[index] = node; }}
                 role="tabpanel"
                 aria-labelledby={`${panelBaseId}-tab-${item.id}`}
                 aria-hidden={index !== segment}
                 className={`lg2-segment-panel${index === segment ? " is-active" : ""}`}
                 key={item.id}
               >
                 {itemBodyHtml(item, category) && <div className="lg2-detail-prose" dangerouslySetInnerHTML={{ __html: itemBodyHtml(item, category) }} />}
                 <StructuredBulletRows bullets={itemBullets(item, category)} numbered={numbered} />
                 {item?.phone && (
                   <div className="lg2-actions lg2-actions--spaced">
                     <a className="lg2-primary-button" href={`tel:${item.phone}`}><svg aria-hidden="true"><use href="#lg-i-phone"/></svg>{t("UI.lg.action.call")}</a>
                   </div>
                 )}
               </div>
             ))}
          </div>
        </article>
      </div>
      {activeItem.orderEnabled && (
        <OrderDock item={activeItem} t={t} onOrderClick={onOrderClick} />
      )}
    </div>
  );
}

// Template D: Segmented
function TemplateD(props: any) {
  return <TabbedDetail {...props} />;
}

// Template E: WiFi
function TemplateE({ category, items, tenant, t, onBack }: any) {
  const ssid = tenant?.wifiSsid;
  const pass = tenant?.wifiPass;
  const qrSvg = tenant?.wifiQrSvg
    ? sanitizeHtml(tenant.wifiQrSvg)
    : null;
  const wifiItem = items[0] || {};
  const media = categoryMedia(category);
  const wifiBullets = itemBullets(wifiItem, category);

  return (
    <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
      <div className="lg2-detail-sheet-root">
        <HeroGallery media={media} onBack={onBack} singleOnly={true} t={t} />
        <article className="lg2-detail-sheet">
           <div className="lg2-grabber" aria-hidden="true" />
           <h1>{category.label}</h1>

           {qrSvg && (
             <div
               className="lg2-qr"
               aria-label={t("UI.lg.wifi.scan")}
               dangerouslySetInnerHTML={{ __html: qrSvg }}
             />
           )}

           {ssid && (
               <div className="lg2-wifi-row">
                 <div><b>{ssid}</b><small>{t("UI.lg.wifi.network")}</small></div>
                 <button type="button" className="lg2-wifi-copy" onClick={() => navigator.clipboard.writeText(ssid)}>{t("UI.lg.action.copy")}</button>
               </div>
           )}

           {pass && (
             <div className="lg2-wifi-row">
               <div><b>{pass}</b><small>{t("UI.lg.wifi.password")}</small></div>
               <button type="button" className="lg2-wifi-copy" onClick={() => navigator.clipboard.writeText(pass)}>{t("UI.lg.action.copy")}</button>
             </div>
           )}

           {itemBodyHtml(wifiItem, category) && <div className="lg2-detail-prose lg2-wifi-note" dangerouslySetInnerHTML={{ __html: itemBodyHtml(wifiItem, category) }} />}
           <StructuredBulletRows bullets={wifiBullets} />
        </article>
      </div>
    </div>
  );
}

// Template F: Place
function TemplateF({ item, category, lang, t, onBack, galleryIndex, onGalleryIndex, onOrderClick }: any) {
  const media = normalizeGuestMedia(item?.media);
  const heading = item?.title || category?.label;
  const subtitle = distinctSubtitle(heading, item?.subtitle);
  const bullets = itemBullets(item, category);
  const openStatus = itemOpenStatus(item, t);
  const price = itemPriceText(item, t);

  return (
    <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
      <div className="lg2-detail-sheet-root">
        <HeroGallery media={media} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} t={t} />
        <article className="lg2-detail-sheet">
           <div className="lg2-grabber" aria-hidden="true" />
           {price ? (
             <div className="lg2-detail-title-row">
               <h1><RichInline value={heading} /></h1>
               <span className="lg2-price">{price}</span>
             </div>
           ) : (
             <h1><RichInline value={heading} /></h1>
           )}
           {(openStatus || subtitle) && (
             <div className="lg2-chips">
                {openStatus && <span className={`lg2-chip${openStatus.isOpen ? " lg2-chip--open" : ""}`}>{openStatus.text}</span>}
                {subtitle && <span className="lg2-chip">{subtitle}</span>}
             </div>
           )}
           {itemBodyHtml(item, category) && <div className="lg2-detail-prose" dangerouslySetInnerHTML={{ __html: itemBodyHtml(item, category) }} />}
           <StructuredBulletRows bullets={bullets} />

           {(itemMapsHref(item) || item?.phone || item?.website) && (
             <div className="lg2-actions lg2-actions--spaced">
               {itemMapsHref(item) && <a className="lg2-primary-button" href={itemMapsHref(item) ?? undefined}><svg aria-hidden="true"><use href="#lg-i-nav2"/></svg>{t("UI.lg.action.maps")}</a>}
               {item?.phone && <a className="lg2-primary-button lg2-secondary-button" href={`tel:${item.phone}`}><svg aria-hidden="true"><use href="#lg-i-phone"/></svg>{t("UI.lg.action.call")}</a>}
                {item?.website && <a className="lg2-primary-button lg2-secondary-button" href={externalUrl(item.website)} target="_blank" rel="noopener noreferrer"><svg aria-hidden="true"><use href="#lg-i-comp"/></svg>{t("UI.lg.action.website")}</a>}
             </div>
           )}
        </article>
      </div>
    </div>
  );
}

// Template G: Trail
function TemplateG({ item, category, t, onBack, galleryIndex, onGalleryIndex, onOrderClick }: any) {
  const media = normalizeGuestMedia(item?.media);
  const heading = item?.title || category?.label;
  const subtitle = distinctSubtitle(heading, item?.subtitle);
  const bullets = itemBullets(item, category);
  const routeFacts = [item?.difficulty, item?.duration, item?.distance].filter(Boolean);
  return (
    <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
      <div className="lg2-detail-sheet-root">
        <HeroGallery media={media} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} t={t} />
        <article className="lg2-detail-sheet">
           <div className="lg2-grabber" aria-hidden="true" />
           <h1><RichInline value={heading} /></h1>
           {(subtitle || routeFacts.length > 0) && (
             <div className="lg2-chips">
                {subtitle && <span className="lg2-chip">{subtitle}</span>}
               {routeFacts.map((fact: string) => <span className="lg2-chip" key={fact}>{fact}</span>)}
             </div>
           )}
           {itemBodyHtml(item, category) && <div className="lg2-detail-prose" dangerouslySetInnerHTML={{ __html: itemBodyHtml(item, category) }} />}
           <StructuredBulletRows bullets={bullets} />
        </article>
      </div>
    </div>
  );
}

function BottomNav({
  resolvedNav,
  sections,
  slug,
  t,
  activeSectionKey,
  activeCategoryId,
  onNavigate,
  screen,
}: any) {
  const sectionFor = (key: string) =>
    sections.find((section: any) => section.key === key);
  const eventDestination = datedEventDestination(sections);
  const normalizedActive =
    activeSectionKey === "services" ? "explore" : activeSectionKey;

  const home = {
    key: "home",
    label: t("UI.lg.nav.home"),
    icon: "home",
    path: `/${slug}/home`,
  };
  const stay = {
    key: "stay",
    label: t("UI.lg.nav.stay"),
    icon: "tent",
    path: `/${slug}/s/stay`,
  };
  const offer = {
    key: "offer",
    label: t("UI.lg.nav.offer"),
    icon: "bag",
    path: `/${slug}/s/offer`,
  };
  const explore = {
    key: "explore",
    label: t("UI.lg.nav.area"),
    icon: "comp",
    path: `/${slug}/s/explore`, // onClick overrides if only services exists
  };
  const program = eventDestination
    ? {
        key: "program",
        label: t("UI.lg.nav.program"),
        icon: "cal",
        path: `/${slug}/c/${eventDestination.category.id}`,
        categoryId: eventDestination.category.id,
      }
    : {
        key: "program",
        label: t("UI.lg.nav.program"),
        icon: "cal",
        path: `/${slug}/home`, // fallback
      };
  const messages = {
    key: "messages",
    label: t("UI.lg.nav.messages"),
    icon: "chat",
    path: `/${slug}/messages`,
  };

  const getTab = (key: string) => {
    switch (key) {
      case "home": return home;
      case "stay": return stay;
      case "offer": return offer;
      case "explore": return explore;
      case "program": return program;
      case "messages": return messages;
      default: return null;
    }
  };

  const tabs = (resolvedNav || [])
    .map(getTab)
    .filter(Boolean)
    .slice(0, 5); // ensure max 5

  return (
    <nav
      className="lg2-bottom-nav"
      aria-label={t("UI.lg.nav.primary")}
      data-testid="nav-primary"
    >
      {tabs.map((tab: any) => {
        const isActive =
          screen === "messages"
            ? tab.key === "messages"
            : (tab.key === "home" && screen === "home") ||
              (screen !== "home" &&
                tab.categoryId &&
                activeCategoryId === tab.categoryId) ||
              (screen !== "home" &&
                tab.key !== "home" &&
                tab.key !== "program" &&
                normalizedActive === tab.key);
        
        return (
          <button
            key={tab.key}
            className={`${isActive ? "is-active" : ""}${tab.disabled ? " is-disabled" : ""}`.trim() || undefined}
            type="button"
            disabled={tab.disabled}
            aria-disabled={tab.disabled || undefined}
            aria-label={
              tab.disabled
                ? `${tab.label} — ${t("UI.lg.nav.messagesUnavailable")}`
                : tab.label
            }
            onClick={tab.disabled ? undefined : () => {
              if (tab.key === "explore" && !sectionFor("explore") && sectionFor("services")) {
                onNavigate(`/${slug}/s/services`);
              } else {
                onNavigate(tab.path);
              }
            }}
            data-testid={`nav-${tab.key}`}
          >
            <svg aria-hidden="true"><use href={`#lg-i-${tab.icon}`} /></svg>
            <b>{tab.label}</b>
          </button>
        );
      })}
    </nav>
  );
}

function HomeView({
  tenant,
  sections,
  t,
  onOpenCategory,
  onOpenItem,
  onOpenNotices,
  notices,
  navigate,
  navigateDetail,
  slug,
  onSearch,
  navState,
}: any) {
  const now = new Date();
  const eventDestination = datedEventDestination(sections);
  const staySection = sections.find((section: any) => section.key === "stay");
  const wifiCategory = sections
    .flatMap((section: any) => visible(section.categories))
    .find((category: any) => category.layout === "wifi");
  const helpCategory = sections
    .flatMap((section: any) => visible(section.categories))
    .find((category: any) => category.layout === "help");
  const hasWifi =
    !!tenant.wifiSsid ||
    !!tenant.wifiNetwork ||
    !!tenant.wifiPassword ||
    !!wifiCategory;
  const newNoticesCount = notices.filter(isNewNotice).length;

  const heroMedia = resolveHomeHeroMedia(
    tenant.livingGuideHeroUrl,
    sections,
  );
  const { entries: todayEntries } = selectHomeTodayEntries(sections, now);
  const visibleDanesItems = todayEntries.slice(0, 6);
  const tenantMapsUrl = resolveTenantMapsUrl(tenant, "search");
  const mapAvailable = Boolean(tenantMapsUrl);

  // Pas Danes se ob prihodu sam pomakne do konca (vrednosti iz prototipa).
  const danesTrackRef = useRef<HTMLDivElement | null>(null);
  const danesCount = visibleDanesItems.length;
  useEffect(() => nudgeTodayStrip(danesTrackRef.current), [danesCount]);

  return (
    <section className="lg2-view lg2-home-view" data-testid="screen-home">
      <div className="lg2-screen-scroll lg2-home-scroll-container" data-lg-scroll>
        <div className="lg2-hhero lg2-hhero-ambient">
          {heroMedia && (
            <img
              src={mediaImgSrc(heroMedia, HERO_IMAGE_WIDTH)}
              alt=""
              className="lg2-hhero-pic"
              style={imageStyle(heroMedia, tenant)}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="lg2-hhero-vg" aria-hidden="true" />
          <div className="lg2-hhero-top">
            <button
              className="lg2-hhero-fab"
              type="button"
              onClick={() => navigate(`/${slug}`)}
              aria-label={t("UI.lg.tour.view")}
            >
              <span aria-hidden="true">360</span>
            </button>
            <button
              className="lg2-hhero-fab"
              type="button"
              onClick={onSearch}
              aria-label={t("UI.lg.search.title")}
            >
              <svg aria-hidden="true"><use href="#lg-i-srch" /></svg>
            </button>
          </div>
        </div>

        <div className="lg2-hsheet">
          <div className="lg2-home-identity">
            <div>
              <p className="lg2-k3">{tenant.name}</p>
              {tenant.address && <p className="lg2-home-address">{tenant.address}</p>}
            </div>
          </div>
          <div className="lg2-home-welcome">
            <h1>{t("UI.lg.welcome.title")}</h1>
            {tenant.logoUrl && (
              <img
                className="lg2-home-logo"
                src={imgSrc(tenant.logoUrl, CARD_IMAGE_WIDTH)}
                alt=""
              />
            )}
          </div>

        <div className="lg2-hqbar">
          <button
            className="lg2-q lg2-q--w"
            type="button"
            disabled={!hasWifi || (!wifiCategory && !staySection)}
            onClick={() => {
              if (wifiCategory) onOpenCategory(wifiCategory.id);
              else if (staySection) navigateDetail(`/${slug}/s/stay`);
            }}
            data-testid="button-home-wifi"
          >
            <svg aria-hidden="true"><use href="#lg-i-wifi" /></svg>
            <b>WiFi</b>
          </button>
          <button
            className="lg2-q"
            type="button"
            onClick={onOpenNotices}
          >
            <svg aria-hidden="true"><use href="#lg-i-bell" /></svg>
            <b>{t("UI.lg.notices.title", "Obvestila")}</b>
            {newNoticesCount > 0 && <span className="lg2-qd" />}
          </button>
          <button
            className="lg2-q"
            type="button"
            onClick={() => navigateDetail(`/${slug}/messages`)}
          >
            <svg aria-hidden="true"><use href="#lg-i-chat" /></svg>
            <b>{t("UI.lg.nav.messages", "Sporočila")}</b>
          </button>
          {/* Navaden <a> brez target="_blank": window.open je na iOS pustil
              prazen zavihek, ko je povezavo prestregla aplikacija Zemljevidi. */}
          {mapAvailable ? (
            <a className="lg2-q" href={tenantMapsUrl ?? undefined}>
              <svg aria-hidden="true"><use href="#lg-i-pin" /></svg>
              <b>{t("UI.lg.home.map")}</b>
            </a>
          ) : (
            <button className="lg2-q" type="button" disabled>
              <svg aria-hidden="true"><use href="#lg-i-pin" /></svg>
              <b>{t("UI.lg.home.map")}</b>
            </button>
          )}
        </div>

        {visibleDanesItems.length > 0 && (
          <>
            <div className="lg2-hsect">
              <h3>{t("UI.lg.home.today")}</h3>
              {eventDestination ? (
                <button
                  type="button"
                  onClick={() =>
                    navigateDetail(`/${slug}/c/${eventDestination.category.id}`)
                  }
                >
                  {t("UI.lg.home.allProgram")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateDetail(`/${slug}/s/explore`)}
                >
                  {t("UI.lg.home.more")}
                </button>
              )}
            </div>
            <div className="lg2-hcards" ref={danesTrackRef}>
              {visibleDanesItems.map((item) => (
                <button
                  key={item.id}
                  className="lg2-hcard"
                  type="button"
                  onClick={() => onOpenItem(item.categoryId, item.item.id)}
                >
                  {item.media && (
                    <img
                      src={mediaImgSrc(item.media, CARD_IMAGE_WIDTH)}
                      alt=""
                      className="pic"
                      style={imageStyle(item.media)}
                    />
                  )}
                  {!item.media && (
                    <span className="lg2-card-missing-photo" aria-label="fotografija manjka">
                      <svg aria-hidden="true"><use href="#lg-i-pin" /></svg>
                      <span>fotografija manjka</span>
                    </span>
                  )}
                  <div className="vg" aria-hidden="true" />
                  <div className="tx">
                    <em>{item.categoryLabel}</em>
                    <b>{item.item.title}</b>
                      {item.detail && <small>{item.detail}</small>}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="lg2-hhelp">
          <button
            type="button"
            disabled={!helpCategory}
            onClick={() => helpCategory && onOpenCategory(helpCategory.id)}
          >
            {t("UI.lg.helpEmergency", "Pomoč in nujni primeri")}
          </button>
        </div>
        <div className="lg2-made">
          <img
            src={`${import.meta.env.BASE_URL}brand/smart360-kolobar-temno.svg`}
            alt=""
            aria-hidden="true"
          />
          <span>Vodnik ustvarja Smart360</span>
        </div>
      </div>
    </div>
    </section>
  );
}
