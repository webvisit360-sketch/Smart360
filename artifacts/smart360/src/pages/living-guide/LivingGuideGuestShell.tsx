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
import {
  getListDeviceOrdersQueryKey,
  useListDeviceOrders,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { getOpenStatus } from "@/lib/hours";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  CARD_IMAGE_WIDTH,
  HERO_IMAGE_WIDTH,
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
  itemPriceText,
  itemSupportingText,
} from "./living-guide-formatters";
import {
  calculateLivingGuideHeroLayout,
  calculateLivingGuideUniformGalleryLayout,
  mediaAspectFromDimensions,
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
import { parseVirtualTourInput } from "@/lib/virtual-tour";

type GuestRecord = {
  unit: string;
  name: string;
  phone: string;
};

type ScreenName = "cover" | "home" | "grid" | "detail" | "explore" | "messages";

function visible(rows: any[] | null | undefined): any[] {
  return (rows ?? []).filter((row) => row.isVisible !== false);
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

function itemBullets(item: any): string[] {
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

function itemBodyHtml(item: any): string {
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
    const media = item.media?.[0];
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
    for (const media of item.media ?? []) {
      const key = `${media.kind ?? "image"}:${media.url ?? media.posterUrl ?? ""}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(media);
    }
  }
  return result;
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

function itemEventTimestamp(item: any): number | null {
  const value =
    item?.eventStart ??
    item?.startsAt ??
    item?.startAt ??
    item?.startDate ??
    null;
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function datedEventDestination(
  sections: any[],
): { section: any; category: any } | null {
  for (const section of sections) {
    for (const category of visible(section.categories)) {
      const isEventSurface =
        category.layout === "events" ||
        section.key === "events" ||
        section.key === "program";
      if (
        isEventSurface &&
        visible(category.items).some(
          (item: any) => itemEventTimestamp(item) !== null,
        )
      ) {
        return { section, category };
      }
    }
  }
  return null;
}

function isToday(timestamp: number, now = new Date()): boolean {
  const date = new Date(timestamp);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
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
  onLanguageChange,
}: {
  tenant: any;
  slug: string;
  lang: string;
  onLanguageChange: (lang: string) => void;
}) {
  const [location, setLocation] = useLocation();
  const requestedTheme = new URLSearchParams(window.location.search).get("theme");
  const themeOverride: LivingTheme | undefined =
    import.meta.env.DEV && isLivingTheme(requestedTheme)
      ? requestedTheme
      : undefined;
  const theme = useLivingTheme(themeOverride);
  const t = makeT(tenant, lang);
  const rootRef = useRef<HTMLDivElement>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const sections = useMemo(() => visible(tenant?.sections), [tenant?.sections]);
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
  else if (categoryContext) screen = "detail";
  else if (routeSectionKey === "explore") screen = "explore";
  else if (routeSectionKey) screen = "grid";

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
  const messagePasswordRequired = Boolean(tenant.orderPasswordConfigured);
  const guestSignedIn = Boolean(guest?.unit.trim() && guest?.name.trim());
  const guestIdentityComplete = Boolean(
    guestSignedIn &&
    guest?.phone.trim() &&
    (guest.phone.match(/\d/g)?.length ?? 0) >= 6,
  );
  const messageAccessReady =
    guestIdentityComplete &&
    (!messagePasswordRequired || Boolean(messagePassword.trim()));
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
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-lg-scroll]").forEach((element) => {
      element.scrollTop = 0;
    });
    root.querySelectorAll<HTMLElement>("[data-lg-gallery]").forEach((element) => {
      element.scrollLeft = 0;
    });
    setGalleryIndex(0);
  }, []);

  useLayoutEffect(() => {
    resetNavigationState();
  }, [location, resetNavigationState]);

  const navigate = useCallback(
    (path: string, replace = false) => {
      resetNavigationState();
      setLocation(buildGuestPath(path), {
        replace,
        state: { livingGuide: true, from: location },
      });
    },
    [location, resetNavigationState, setLocation],
  );

  const gridPath = (section = currentSection) =>
    `/${slug}/s/${encodeURIComponent(section?.key ?? "stay")}`;

  const goBack = useCallback(() => {
    if (screen !== "detail") return;
    if (window.history.length > 1 && window.history.state?.livingGuide) {
      window.history.back();
      return;
    }
    if (routeItemId) {
      navigate(`/${slug}/c/${routeCategoryId}`, true);
    } else {
      navigate(gridPath(categoryContext?.section ?? staySection), true);
    }
  }, [categoryContext?.section, navigate, screen, slug, staySection, routeItemId, routeCategoryId]);

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
        else goBack();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    cancelSignIn,
    goBack,
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

  const openCategory = (id: string) => navigate(`/${slug}/c/${id}`);
  const openItem = (categoryId: string, itemId: string) => navigate(`/${slug}/c/${categoryId}/i/${itemId}`);

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
      translate="no"
    >
      <style>{`@font-face{font-family:"Inter";src:url("${livingGuideInterWoff2}") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}`}</style>
      <LivingGuideSprite />
      <Starfield theme={theme} />

      <main className="lg2-stage">
        {screen === "cover" && (
          <CoverView tenant={tenant} lang={lang} t={t} onOpen={() => {
            if (guest) navigate(`/${slug}/home`);
            else setShowSignIn(true);
          }} onSearch={() => setShowSearch(true)} onLanguage={() => setShowLanguages(true)} />
        )}

        {screen === "home" && (
          <HomeView
            tenant={tenant}
            sections={sections}
            lang={lang}
            t={t}
            guest={guest}
            onEditGuest={requestCredentials}
            onOpenCategory={openCategory}
            onOpenItem={openItem}
            onOpenNotices={() => setShowNotices(true)}
            notices={notices}
            navigate={navigate}
            slug={slug}
            onSearch={() => setShowSearch(true)}
          />
        )}

        {screen === "grid" && currentSection && (
          <GridView
            tenant={tenant}
            section={currentSection}
            lang={lang}
            t={t}
            guest={currentSection.key === "stay" ? guest : null}
            onEditGuest={requestCredentials}
            onOpenCategory={openCategory}
            onOpenNotices={() => setShowNotices(true)}
            helpCategoryId={currentSection.key === "stay" ? helpCategory?.id : null}
            notices={currentSection.key === "stay" ? notices : []}
            orderSummary={orderSummary}
            onOpenOrders={() => setShowOrders(true)}
            onOpenOffer={
              currentSection.key === "stay" &&
              datedEventDestination(sections) &&
              sections.some((section: any) => section.key === "offer")
                ? () => navigate(`/${slug}/s/offer`)
                : undefined
            }
          />
        )}

        {screen === "explore" && (
          <ExploreView
            tenant={tenant}
            categories={exploreCategories}
            lang={lang}
            t={t}
            onOpenCategory={openCategory}
            onOpenItem={openItem}
          />
        )}

        {screen === "messages" && (
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
            onBack={() => navigate(`/${slug}/home`)}
            onCredentialsRequired={requestCredentials}
            onCredentialsRejected={(message) => {
              setMessagePassword("");
              forgetRememberedOrderPassword(slug);
              setMessageAccessError(message);
              setShowSignIn(true);
            }}
          />
        )}

        {screen === "detail" && categoryContext && (
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
        )}
      </main>

      {screen !== "cover" && (
        <BottomNav
          sections={sections}
          slug={slug}
          t={t}
          activeSectionKey={currentSection?.key ?? null}
          activeCategoryId={categoryContext?.category?.id ?? null}
          onNavigate={navigate}
          screen={screen}
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
  const tourUrl = parseVirtualTourInput(tenant.tourUrl).url;

  return (
    <section className="lg2-view lg2-cover is-on" aria-label={title} data-testid="screen-cover">
      <div className={tourUrl ? "lg2-cover-tour" : "lg2-cover-photo"} aria-hidden={tourUrl ? undefined : true}>
        {tourUrl ? (
          <iframe
            src={tourUrl}
            allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen"
            allowFullScreen
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
                  <span><b>{category.label}</b>{supporting && <small>{supporting}</small>}</span>
                </button>
              );
            }
            return (
              <button key={category.id} className={`lg2-utility-card${isWide ? " lg2-utility-card--wide" : ""}`} style={staggerStyle} type="button" onClick={() => onOpenCategory(category.id)}>
                <span className="lg2-utility-icon" aria-hidden="true"><svg><use href={`#lg-i-${categoryIcon(category)}`} /></svg></span>
                <span><b>{category.label}</b></span>
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

function ExploreView({ tenant, categories, lang, t, onOpenCategory, onOpenItem }: any) {
  const allItems = categories.flatMap((c: any) => visible(c.items).map((i: any) => ({ ...i, categoryId: c.id })));

  return (
    <section className="lg2-view lg2-explore-view">
      <header className="lg2-grid-header">
        <div>
          <p>{tenant.name}</p>
          <h1>{t("UI.lg.exploreTitle")}</h1>
        </div>
      </header>
      <div className="lg2-screen-scroll" data-lg-scroll>
        <div className="lg2-chips lg2-explore-chips">
          {categories.map((c: any) => (
             <button type="button" key={c.id} className="lg2-chip" onClick={() => onOpenCategory(c.id)}>{c.label}</button>
          ))}
        </div>
        <div className="lg2-ngrp">{t("UI.lg.nearby")}</div>
        <div className="lg2-subs lg2-nearby-list">
          {allItems.map((item: any) => {
            const status = itemOpenStatus(item, t);
            const supporting = itemSupportingText(
              item,
              distinctSubtitle(item.title, item.subtitle),
              status?.text,
            );
            return (
              <button type="button" className="lg2-sub2 lg2-nrow" key={item.id} onClick={() => onOpenItem(item.categoryId, item.id)}>
                {item.media?.[0] ? <img className="lg2-list-thumb" src={mediaImgSrc(item.media[0], CARD_IMAGE_WIDTH)} alt="" style={imageStyle(item.media[0])} /> : <span className="lg2-sub-icon"><svg><use href="#lg-i-pin"/></svg></span>}
                <div><b>{item.title}</b>{supporting && <small>{supporting}</small>}</div>
                <span className="lg2-chevron">›</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HeroGallery({ media, onBack, galleryIndex, onGalleryIndex, singleOnly, t }: any) {
  const heroRef = useRef<HTMLDivElement>(null);
  const galleryTrackRef = useRef<HTMLDivElement>(null);
  const settleTimeoutRef = useRef<number | null>(null);
  const [frameWidth, setFrameWidth] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  );
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined" ? 844 : window.innerHeight,
  );
  const [imageAspects, setImageAspects] = useState<Record<string, number>>({});
  const activeIndex = singleOnly
    ? 0
    : Math.max(0, Math.min((media?.length ?? 1) - 1, galleryIndex ?? 0));
  const isUniformGallery = !singleOnly && (media?.length ?? 0) > 1;
  const isSingleHero = !isUniformGallery;
  const activeEntry = media?.[activeIndex] ?? media?.[0];
  const activeKey = activeEntry
    ? String(activeEntry.id ?? activeEntry.url ?? activeIndex)
    : "";
  const activeMetadataAspect = mediaAspectFromDimensions(
    activeEntry?.width,
    activeEntry?.height,
  );
  const activeMeasuredAspect = imageAspects[activeKey];
  const activeAspect = activeMetadataAspect ?? activeMeasuredAspect;
  const galleryAspects = (media ?? []).map((entry: any, index: number) => {
    const entryKey = String(entry.id ?? entry.url ?? index);
    return (
      mediaAspectFromDimensions(entry.width, entry.height) ??
      imageAspects[entryKey] ??
      null
    );
  });
  const galleryHasOnlyPayloadAspects = (media ?? []).every(
    (entry: any) => mediaAspectFromDimensions(entry.width, entry.height) !== null,
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
        imageAspect: activeAspect,
        viewportHeight,
      })
    : null;
  const activeAspectSource = isUniformGallery
    ? uniformGalleryLayout
      ? galleryHasOnlyPayloadAspects
        ? "payload"
        : "measured"
      : "pending"
    : activeMetadataAspect
      ? "payload"
      : activeMeasuredAspect
        ? "measured"
        : "pending";
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

  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!hero || !media?.length) return;
    const measure = () => {
      if (!hero.isConnected) return;
      const nextFrameWidth = hero.clientWidth;
      const nextViewportHeight = window.innerHeight;
      setFrameWidth((current) =>
        current === nextFrameWidth ? current : nextFrameWidth,
      );
      setViewportHeight((current) =>
        current === nextViewportHeight ? current : nextViewportHeight,
      );
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(hero);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    measure();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [mediaKey, media?.length]);

  const rememberAspect = useCallback((key: string, aspect: number) => {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    setImageAspects((current) =>
      current[key] === aspect ? current : { ...current, [key]: aspect },
    );
  }, []);

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
    <div className="lg2-detail-hero lg2-detail-hero--ambient" data-lg-ambient-hero>
      <button className="lg2-detail-back" type="button" onClick={onBack} aria-label={t("UI.lg.action.back")}><svg aria-hidden="true"><use href="#lg-i-bk"/></svg></button>
    </div>
  );
  if (isSingleHero) {
    const entry = media[0];
    const entryKey = String(entry.id ?? entry.url ?? 0);
    const entryAspectReady =
      mediaAspectFromDimensions(entry.width, entry.height) !== null ||
      Boolean(imageAspects[entryKey]);
    return (
      <div
        ref={heroRef}
        className={`lg2-detail-hero lg2-detail-hero--photo${layoutReady ? " is-layout-ready" : " is-awaiting-dimensions"}${activeAspectSource === "measured" ? " is-measured-fallback" : ""}`}
        data-lg-hero-height={Math.round(heroHeight)}
        data-lg-hero-natural-height={heroLayout?.naturalHeight}
        data-lg-hero-branch={heroLayout?.branch}
        data-lg-hero-aspect-source={activeAspectSource}
        data-lg-hero-layout-ready={layoutReady}
        style={{ height: heroHeight }}
      >
        <div className="lg2-gallery-track">
          <div className="lg2-gallery-slide">
            <AspectAwareHeroImage
              entry={entry}
              entryKey={entryKey}
              loading="eager"
              sideBlur={sideBlur}
              aspectReady={entryAspectReady}
              expectedAspect={mediaAspectFromDimensions(entry.width, entry.height)}
              onAspect={rememberAspect}
            />
          </div>
        </div>
        <button className="lg2-detail-back" type="button" onClick={onBack} aria-label={t("UI.lg.action.back")}><svg aria-hidden="true"><use href="#lg-i-bk" /></svg></button>
      </div>
    );
  }
  return (
    <div
      ref={heroRef}
      className={`lg2-detail-hero lg2-detail-hero--photo${layoutReady ? " is-layout-ready" : " is-awaiting-dimensions"}${activeAspectSource === "measured" ? " is-measured-fallback" : ""} is-uniform-gallery`}
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
      style={{ height: heroHeight }}
    >
      <div
        ref={galleryTrackRef}
        className="lg2-gallery-track"
        data-lg-gallery
        onScroll={(event) => scheduleGallerySettle(event.currentTarget)}
      >
        {media.map((entry: any, index: number) => {
          const entryKey = String(entry.id ?? entry.url ?? index);
          const expectedAspect = mediaAspectFromDimensions(
            entry.width,
            entry.height,
          );
          const aspectReady =
            expectedAspect !== null || Boolean(imageAspects[entryKey]);
          return (
            <div className="lg2-gallery-slide" key={entryKey}>
              <AspectAwareHeroImage
                entry={entry}
                entryKey={entryKey}
                loading={index === 0 || !layoutReady ? "eager" : "lazy"}
                sideBlur={false}
                galleryCover
                aspectReady={aspectReady}
                expectedAspect={expectedAspect}
                onAspect={rememberAspect}
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
      <button className="lg2-detail-back" type="button" onClick={onBack} aria-label={t("UI.lg.action.back")}><svg aria-hidden="true"><use href="#lg-i-bk" /></svg></button>
    </div>
  );
}

function AspectAwareHeroImage({
  entry,
  entryKey,
  loading,
  sideBlur,
  galleryCover = false,
  aspectReady,
  expectedAspect,
  onAspect,
}: {
  entry: any;
  entryKey: string;
  loading: "eager" | "lazy";
  sideBlur: boolean;
  galleryCover?: boolean;
  aspectReady: boolean;
  expectedAspect: number | null;
  onAspect: (key: string, aspect: number) => void;
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
          decoding="async"
        />
      )}
      <img
        className={`lg2-hero-image-main${aspectReady ? " is-ready" : ""}`}
        data-lg-hero-image
        data-lg-aspect-source={expectedAspect === null ? "measured" : "payload"}
        src={source}
        alt=""
        loading={loading}
        decoding="async"
        style={galleryCover ? imageStyle(entry) : undefined}
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth > 0 && image.naturalHeight > 0) {
            const naturalAspect = image.naturalWidth / image.naturalHeight;
            if (expectedAspect === null) {
              image.dataset.lgDimensionsConfirmed = "measured";
              onAspect(entryKey, naturalAspect);
            } else {
              const relativeError =
                Math.abs(naturalAspect - expectedAspect) / expectedAspect;
              image.dataset.lgDimensionsConfirmed =
                relativeError <= 0.01 ? "true" : "mismatch";
            }
          }
        }}
      />
    </div>
  );
}

function DetailView({ category, itemId, lang, t, galleryIndex, onGalleryIndex, onBack, tenant, onOpenItem, showHostContacts, onOrderClick }: any) {
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
        content = <TemplateA category={category} items={[activeItem]} onOrderClick={onOrderClick} mediaOverride={visible(activeItem.media)} titleOverride={activeItem.title} tenant={tenant} lang={lang} t={t} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
    }
  } else {
    if (layout === "wifi") {
      content = <TemplateE category={category} items={items} tenant={tenant} t={t} onBack={onBack} />;
    } else if (layout === "tabs" && items.length === 2) {
      content = <TemplateD category={category} items={items} t={t} onBack={onBack} onOrderClick={onOrderClick} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
    } else if (layout === "tabs" || layout === "apartments" || layout === "products" || layout === "poi" || layout === "routes" || layout === "events") {
      content = <TemplateB category={category} items={items} t={t} onBack={onBack} onOpenItem={onOpenItem} onOrderClick={onOrderClick} />;
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
    <section className={`lg2-view lg2-detail-view${activeItem?.orderEnabled && layout !== "tabs" ? " has-order-dock" : ""}`}>
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
  const contacts = [
    tenant?.phone
      ? { key: "phone", icon: "phone", label: t("UI.contact.call"), value: tenant.phone, href: `tel:${tenant.phone}` }
      : null,
    tenant?.whatsapp
      ? { key: "whatsapp", icon: "chat", label: "WhatsApp", value: tenant.whatsapp, href: `https://wa.me/${String(tenant.whatsapp).replace(/\D/g, "")}`, external: true }
      : null,
    tenant?.email
      ? { key: "email", icon: "mail", label: t("UI.contact.email"), value: tenant.email, href: `mailto:${tenant.email}` }
      : null,
    tenant?.address
      ? { key: "address", icon: "pin", label: t("UI.contact.address"), value: tenant.address, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.mapQuery || tenant.address)}`, external: true }
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
  const introBody = itemBodyHtml(firstItem);
  const firstItemBullets = itemBullets(firstItem);
  const price = itemPriceText(firstItem);
  const detailRows = items.slice(1).filter((i: any) => i.title || i.body || i.bullets?.length);

  return (
    <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
      <div className="lg2-detail-layout">
        <HeroGallery media={media} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} t={t} />
        <article className="lg2-detail-sheet">
          <div className="lg2-grabber" aria-hidden="true" />
          {price ? (
            <div className="lg2-detail-title-row">
              <h1>{heading}</h1>
              <span className="lg2-price">{price}</span>
            </div>
          ) : (
            <h1>{heading}</h1>
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
                    {item.title && <b>{item.title}</b>}
                    {itemBodyHtml(item) && <span dangerouslySetInnerHTML={{ __html: itemBodyHtml(item) }} />}
                    <StructuredBulletRows bullets={itemBullets(item)} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {(firstItem?.mapQuery || firstItem?.phone || firstItem?.website) && (
            <div className="lg2-actions">
              {firstItem?.mapQuery && <a className="lg2-primary-button" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(firstItem.mapQuery)}`} target="_blank" rel="noopener noreferrer"><svg aria-hidden="true"><use href="#lg-i-nav2"/></svg>{t("UI.lg.action.maps")}</a>}
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
function TemplateB({ category, items, t, onBack, onOpenItem, onOrderClick }: any) {
  const media = firstMedia(category) ? [firstMedia(category)] : [];
  return (
    <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
      <div className="lg2-detail-layout">
        <HeroGallery media={media} onBack={onBack} singleOnly={true} t={t} />
        <article className="lg2-detail-sheet">
           <div className="lg2-grabber" aria-hidden="true" />
           <h1>{category.label}</h1>
           <div className="lg2-subs">
              {items.map((item: any) => {
                const subtitle = distinctSubtitle(item.title, item.subtitle);
                const status = itemOpenStatus(item, t);
                 const price = itemPriceText(item);
                 const supporting = itemSupportingText(
                   item,
                   subtitle,
                   status?.text,
                 );
                return (
                  <button type="button" className="lg2-sub2" key={item.id} onClick={() => onOpenItem(item.id)}>
                    <span className="lg2-sub-icon" aria-hidden="true">
                      {item.media?.[0] ? <img src={mediaImgSrc(item.media[0], CARD_IMAGE_WIDTH)} alt="" style={imageStyle(item.media[0])} className="lg2-sub-img" /> : <svg><use href={`#lg-i-${categoryIcon(category)}`}/></svg>}
                    </span>
                     <div className="lg2-sub-content">
                       <span className="lg2-row-title">
                         <b>{item.title}</b>
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
      <div className="lg2-detail-layout">
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
                     {item.title && <b>{item.title}</b>}
                     {itemBodyHtml(item) && <div dangerouslySetInnerHTML={{ __html: itemBodyHtml(item) }} />}
                     <StructuredBulletRows bullets={itemBullets(item)} />
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
  const media = visible(activeItem.media);
  const panelBaseId = `lg2-segment-${category.id}`;

  return (
    <div className={`lg2-screen-scroll lg2-detail-scroll${activeItem.orderEnabled ? " lg2-detail-scroll--orderable" : ""}`} data-lg-scroll>
      <div className="lg2-detail-layout">
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
                  {item.title || item.label}
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
                 {itemBodyHtml(item) && <div className="lg2-detail-prose" dangerouslySetInnerHTML={{ __html: itemBodyHtml(item) }} />}
                 <StructuredBulletRows bullets={itemBullets(item)} numbered={numbered} />
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
  const wifiBullets = itemBullets(wifiItem);

  return (
    <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
      <div className="lg2-detail-layout">
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

           {itemBodyHtml(wifiItem) && <div className="lg2-detail-prose lg2-wifi-note" dangerouslySetInnerHTML={{ __html: itemBodyHtml(wifiItem) }} />}
           <StructuredBulletRows bullets={wifiBullets} />
        </article>
      </div>
    </div>
  );
}

// Template F: Place
function TemplateF({ item, category, lang, t, onBack, galleryIndex, onGalleryIndex, onOrderClick }: any) {
  const media = visible(item?.media);
  const heading = item?.title || category?.label;
  const subtitle = distinctSubtitle(heading, item?.subtitle);
  const bullets = itemBullets(item);
  const openStatus = itemOpenStatus(item, t);
  const price = itemPriceText(item);

  return (
    <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
      <div className="lg2-detail-layout">
        <HeroGallery media={media} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} t={t} />
        <article className="lg2-detail-sheet">
           <div className="lg2-grabber" aria-hidden="true" />
           {price ? (
             <div className="lg2-detail-title-row">
               <h1>{heading}</h1>
               <span className="lg2-price">{price}</span>
             </div>
           ) : (
             <h1>{heading}</h1>
           )}
           {(openStatus || subtitle) && (
             <div className="lg2-chips">
                {openStatus && <span className={`lg2-chip${openStatus.isOpen ? " lg2-chip--open" : ""}`}>{openStatus.text}</span>}
                {subtitle && <span className="lg2-chip">{subtitle}</span>}
             </div>
           )}
           {itemBodyHtml(item) && <div className="lg2-detail-prose" dangerouslySetInnerHTML={{ __html: itemBodyHtml(item) }} />}
           <StructuredBulletRows bullets={bullets} />

           {(item?.mapQuery || item?.phone || item?.website) && (
             <div className="lg2-actions lg2-actions--spaced">
               {item?.mapQuery && <a className="lg2-primary-button" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.mapQuery)}`} target="_blank" rel="noopener noreferrer"><svg aria-hidden="true"><use href="#lg-i-nav2"/></svg>{t("UI.lg.action.maps")}</a>}
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
  const media = visible(item?.media);
  const heading = item?.title || category?.label;
  const subtitle = distinctSubtitle(heading, item?.subtitle);
  const bullets = itemBullets(item);
  const routeFacts = [item?.difficulty, item?.duration, item?.distance].filter(Boolean);
  return (
    <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
      <div className="lg2-detail-layout">
        <HeroGallery media={media} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} t={t} />
        <article className="lg2-detail-sheet">
           <div className="lg2-grabber" aria-hidden="true" />
           <h1>{heading}</h1>
           {(subtitle || routeFacts.length > 0) && (
             <div className="lg2-chips">
                {subtitle && <span className="lg2-chip">{subtitle}</span>}
               {routeFacts.map((fact: string) => <span className="lg2-chip" key={fact}>{fact}</span>)}
             </div>
           )}
           {itemBodyHtml(item) && <div className="lg2-detail-prose" dangerouslySetInnerHTML={{ __html: itemBodyHtml(item) }} />}
           <StructuredBulletRows bullets={bullets} />
        </article>
      </div>
    </div>
  );
}

function BottomNav({
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
    section: sectionFor("stay"),
  };
  const offer = {
    key: "offer",
    label: t("UI.lg.nav.offer"),
    icon: "bag",
    section: sectionFor("offer"),
  };
  const explore = {
    key: "explore",
    label: t("UI.lg.nav.area"),
    icon: "comp",
    section: sectionFor("explore"),
  };
  const program = eventDestination
    ? {
        key: "program",
        label: t("UI.lg.nav.program"),
        icon: "cal",
        path: `/${slug}/c/${eventDestination.category.id}`,
        categoryId: eventDestination.category.id,
      }
    : null;
  const messages = {
    key: "messages",
    label: t("UI.lg.nav.messages"),
    icon: "chat",
    path: `/${slug}/messages`,
  };

  const candidates = program
    ? [home, stay, explore, program, messages]
    : [home, stay, offer, explore, messages];
  const tabs = candidates.filter(
    (tab: any) =>
      tab &&
      (tab.key === "home" ||
        tab.key === "messages" ||
        tab.section ||
        tab.path),
  );

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
        const path =
          tab.path ??
          (tab.section
            ? `/${slug}/s/${encodeURIComponent(tab.section.key)}`
            : "");
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
            onClick={tab.disabled ? undefined : () => onNavigate(path)}
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
  lang,
  t,
  guest,
  onEditGuest,
  onOpenCategory,
  onOpenItem,
  onOpenNotices,
  notices,
  navigate,
  slug,
  onSearch,
}: any) {
  const tourUrl = parseVirtualTourInput(tenant.tourUrl).url;
  const now = new Date();
  const eventDestination = datedEventDestination(sections);
  const staySection = sections.find((section: any) => section.key === "stay");
  const offerSection = sections.find((section: any) => section.key === "offer");
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

  const danesItems: any[] = [];
  for (const section of sections) {
    for (const category of visible(section.categories)) {
      for (const item of visible(category.items)) {
        const eventTimestamp = itemEventTimestamp(item);
        if (
          eventTimestamp !== null &&
          isToday(eventTimestamp, now) &&
          eventTimestamp >= now.getTime() - 60 * 60 * 1000
        ) {
          danesItems.push({
            id: `event-${item.id}`,
            badge: new Intl.DateTimeFormat(lang, {
              hour: "2-digit",
              minute: "2-digit",
            }).format(eventTimestamp),
            title: item.title,
            subtitle: distinctSubtitle(item.title, item.subtitle),
            media: item.media?.[0],
            onClick: () => onOpenItem(category.id, item.id),
            immediacy: Math.max(
              0,
              (eventTimestamp - now.getTime()) / 60_000,
            ),
          });
          continue;
        }
        if (item.hoursJson && !item.open24) {
          const status = getOpenStatus(item.hoursJson, now);
          if (status?.isOpen && status.closesAt) {
            danesItems.push({
              id: `facility-${item.id}`,
              badge: `${t("UI.lg.hours.openUntil")} ${status.closesAt}`,
              title: item.title,
              subtitle: distinctSubtitle(item.title, item.subtitle),
              media: item.media?.[0],
              onClick: () => onOpenItem(category.id, item.id),
              immediacy: 180 + minutesUntilClock(status.closesAt, now),
            });
          }
        }
      }
    }
  }

  for (const notice of notices) {
    const timestamp = noticeTimestamp(notice);
    if (isNewNotice(notice) && timestamp !== null) {
      danesItems.push({
        id: `notice-${notice.id}`,
        badge: t("UI.lg.notices.new"),
        title: notice.title,
        subtitle: notice.body
          ? sanitizeHtml(notice.body).replace(/<[^>]+>/g, "")
          : "",
        media: notice.media?.[0],
        onClick: onOpenNotices,
        immediacy: 360 + (now.getTime() - timestamp) / 3_600_000,
      });
    }
  }

  const zaVasItems = ["offer", "explore", "stay"].flatMap(
    (sectionKey, index) => {
      const section = sections.find((row: any) => row.key === sectionKey);
      if (!section) return [];
      const categories = visible(section.categories);
      const category =
        categories.find((row: any) => categoryMedia(row).length > 0) ??
        categories.find((row: any) => visible(row.items).length > 0);
      if (!category) return [];
      const item = visible(category.items)[0];
      const media = firstMedia(category);
      return [
        {
          id: section.key,
          title: section.title,
          subtitle:
            distinctSubtitle(section.title, category.label) ||
            distinctSubtitle(section.title, item?.title),
          media,
          path: `/${slug}/s/${encodeURIComponent(section.key)}`,
          isWide: index === 0,
        },
      ];
    },
  );

  if (danesItems.length === 0 && offerSection) {
    const offerCategory = visible(offerSection.categories).find(
      (category: any) => visible(category.items).length > 0,
    );
    const offerItem = offerCategory
      ? visible(offerCategory.items)[0]
      : null;
    if (offerCategory && offerItem) {
      danesItems.push({
        id: `offer-${offerItem.id}`,
        badge: t("UI.lg.nav.offer"),
        title: offerItem.title,
        subtitle:
          distinctSubtitle(offerItem.title, offerItem.subtitle) ||
          offerCategory.label,
        media: offerItem.media?.[0] ?? firstMedia(offerCategory),
        onClick: () => onOpenItem(offerCategory.id, offerItem.id),
        immediacy: 10_000,
      });
    }
  }

  danesItems.sort((a, b) => a.immediacy - b.immediacy);
  const visibleDanesItems = danesItems.slice(0, 6);
  const firstName = guest?.name?.trim().split(/\s+/)[0] ?? "";

  return (
    <section
      className="lg2-view lg2-home-view"
      data-testid="screen-home"
    >
      <header className="lg2-hd">
        <div className="lg2-tt">
          <small>{tenant.name}</small>
          <h1>{t("UI.lg.welcome.title")}</h1>
        </div>
        {tourUrl && (
          <button
            className="lg2-fab"
            type="button"
            onClick={() => navigate(`/${slug}`)}
            aria-label={t("UI.lg.tour.view")}
            data-testid="button-home-tour"
          >
            <span aria-hidden="true">360°</span>
          </button>
        )}
        <button
          className="lg2-fab"
          type="button"
          onClick={onSearch}
          aria-label={t("UI.lg.search.title")}
          data-testid="button-home-search"
        >
          <svg aria-hidden="true"><use href="#lg-i-srch" /></svg>
        </button>
      </header>

      <div className="lg2-screen-scroll" data-lg-scroll>
        {guest && (
          <button
            className="lg2-hello"
            type="button"
            onClick={onEditGuest}
            data-testid="button-edit-guest"
          >
            <span className="lg2-hd2" aria-hidden="true">
              <svg><use href="#lg-i-usr" /></svg>
            </span>
            <span>
              <b>
                {firstName
                  ? t("UI.lg.greeting.named", { name: firstName })
                  : t("UI.lg.greeting.generic")}
              </b>
              <small>{t("UI.lg.greeting.ordersTo")} {guest.unit}</small>
            </span>
            <span className="lg2-chg">{t("UI.lg.greeting.change")}</span>
          </button>
        )}

        <div className="lg2-qbar">
          {hasWifi && (
            <button
              className="lg2-q lg2-q--w"
              type="button"
              onClick={() => {
                if (wifiCategory) onOpenCategory(wifiCategory.id);
                else if (staySection) navigate(`/${slug}/s/stay`);
              }}
              data-testid="button-home-wifi"
            >
              <svg aria-hidden="true"><use href="#lg-i-wifi" /></svg>
              <b>WiFi</b>
            </button>
          )}
          {notices.length > 0 && (
            <button
              className="lg2-q"
              type="button"
              onClick={onOpenNotices}
              data-testid="button-home-notices"
            >
              <svg aria-hidden="true"><use href="#lg-i-bell" /></svg>
              <b>{t("UI.lg.notices.title")}</b>
              {newNoticesCount > 0 && (
                <span
                  className="lg2-qd"
                  data-testid="badge-new-notices"
                  aria-hidden="true"
                />
              )}
            </button>
          )}
        </div>

        {visibleDanesItems.length > 0 && (
          <>
            <div className="lg2-sect">
              <h2>{t("UI.lg.home.today")}</h2>
              {eventDestination && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/${slug}/c/${eventDestination.category.id}`)
                  }
                  data-testid="button-all-program"
                >
                  {t("UI.lg.home.allProgram")}
                </button>
              )}
            </div>
            <div className="lg2-nowtrack" data-testid="list-today">
              {visibleDanesItems.map((item) => (
                <button
                  key={item.id}
                  className="lg2-nowcard"
                  type="button"
                  onClick={item.onClick}
                  data-testid={`card-today-${item.id}`}
                >
                  {item.media && (
                    <img
                      src={mediaImgSrc(item.media, CARD_IMAGE_WIDTH)}
                      alt=""
                      className="lg2-pic"
                      style={imageStyle(item.media)}
                    />
                  )}
                  <span className="lg2-vg" aria-hidden="true" />
                  <span className="lg2-t">
                    <em>{item.badge}</em>
                    <b>{item.title}</b>
                    {item.subtitle && <small>{item.subtitle}</small>}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {zaVasItems.length > 0 && (
          <>
            <div className="lg2-sect">
              <h2>{t("UI.lg.home.forYou")}</h2>
              {offerSection && (
                <button
                  type="button"
                  onClick={() => navigate(`/${slug}/s/offer`)}
                  data-testid="button-all-offers"
                >
                  {t("UI.lg.home.allOffers")}
                </button>
              )}
            </div>
            <div className="lg2-grid lg2-home-cards">
              {zaVasItems.map((item: any) => (
                <button
                  key={item.id}
                  className={`lg2-cardp${item.isWide ? " lg2-cardp--w" : ""}`}
                  type="button"
                  onClick={() => navigate(item.path)}
                  data-testid={`card-for-you-${item.id}`}
                >
                  {item.media && (
                    <img
                      src={mediaImgSrc(
                        item.media,
                        item.isWide ? HERO_IMAGE_WIDTH : CARD_IMAGE_WIDTH,
                      )}
                      alt=""
                      className="lg2-pic"
                      style={imageStyle(item.media)}
                    />
                  )}
                  <span className="lg2-c2">
                    <b>{item.title}</b>
                    {item.subtitle && <small>{item.subtitle}</small>}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {helpCategory && (
          <div className="lg2-home-help">
            <button
              type="button"
              onClick={() => onOpenCategory(helpCategory.id)}
              data-testid="button-home-help"
            >
              {t("UI.lg.helpEmergency")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
