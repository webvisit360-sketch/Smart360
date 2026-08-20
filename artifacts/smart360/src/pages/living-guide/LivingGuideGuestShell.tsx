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
import "./living-guide-tokens.css";
import "./living-guide-guest.css";

type GuestRecord = {
  unit: string;
  name: string;
};

type ScreenName = "cover" | "grid" | "detail" | "explore";

const GUEST_STORAGE_PREFIX = "smart360:living-guide:guest:";

function visible(rows: any[] | null | undefined): any[] {
  return (rows ?? []).filter((row) => row.isVisible !== false);
}

function readGuest(slug: string): GuestRecord | null {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_PREFIX + slug);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.unit !== "string" || !parsed.unit.trim()) return null;
    return {
      unit: parsed.unit.trim(),
      name: typeof parsed.name === "string" ? parsed.name.trim() : "",
    };
  } catch {
    return null;
  }
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
  return {
    text:
      status.isOpen && status.closesAt
        ? `${t("UI.lg.hours.openUntil")} ${status.closesAt}`
        : t("UI.lg.hours.closed"),
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
  const welcomeOverride = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get("welcome")
    : null;

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
  if (categoryContext) screen = "detail";
  else if (routeSectionKey === "explore") screen = "explore";
  else if (routeSectionKey) screen = "grid";

  const [guest, setGuest] = useState<GuestRecord | null>(() => readGuest(slug));
  const [showSignIn, setShowSignIn] = useState(
    () =>
      screen === "cover" &&
      (welcomeOverride === "show" ||
        (welcomeOverride !== "skip" && !readGuest(slug))),
  );
  const [showNotices, setShowNotices] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);

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

  useEffect(() => {
    if (screen !== "detail" && !showLanguages && !showNotices && !showSearch && !showSignIn) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showSignIn) setShowSignIn(false);
        else if (showNotices) setShowNotices(false);
        else if (showSearch) setShowSearch(false);
        else if (showLanguages) setShowLanguages(false);
        else goBack();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goBack, screen, showLanguages, showNotices, showSearch, showSignIn]);

  const saveGuest = (record: GuestRecord) => {
    const clean = { unit: record.unit.trim(), name: record.name.trim() };
    if (!clean.unit) return;
    setGuest(clean);
    try {
      localStorage.setItem(GUEST_STORAGE_PREFIX + slug, JSON.stringify(clean));
    } catch {}
    setShowSignIn(false);
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
      className="lg2-app"
      data-living-guide
      data-living-guide-app
      data-screen={screen}
    >
      <style>{`@font-face{font-family:"Inter";src:url("${livingGuideInterWoff2}") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}`}</style>
      <LivingGuideSprite />
      <Starfield theme={theme} />

      <main className="lg2-stage">
        {screen === "cover" && (
          <CoverView tenant={tenant} lang={lang} t={t} onOpen={() => navigate(gridPath(staySection))} onSearch={() => setShowSearch(true)} onLanguage={() => setShowLanguages(true)} />
        )}

        {screen === "grid" && currentSection && (
          <GridView
            tenant={tenant}
            section={currentSection}
            lang={lang}
            t={t}
            guest={currentSection.key === "stay" ? guest : null}
            onEditGuest={() => setShowSignIn(true)}
            onOpenCategory={openCategory}
            onOpenNotices={() => setShowNotices(true)}
            helpCategoryId={currentSection.key === "stay" ? helpCategory?.id : null}
            notices={currentSection.key === "stay" ? notices : []}
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
          />
        )}
      </main>

      {screen !== "cover" && (
        <button
          className="lg2-screen-language"
          type="button"
          onClick={() => setShowLanguages(true)}
          aria-label={t("UI.lg.language", { lang: lang.toUpperCase() })}
          data-lg-language-trigger
        >
          {lang.toUpperCase()}
        </button>
      )}

      {screen !== "cover" && (
        <BottomNav
          sections={sections}
          slug={slug}
          t={t}
          activeSectionKey={currentSection?.key ?? null}
          onNavigate={navigate}
        />
      )}

      {showSignIn && (
        <SignInSheet tenantName={tenant.name} t={t} initialGuest={guest} onClose={() => setShowSignIn(false)} onSave={saveGuest} />
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

  return (
    <section className="lg2-view lg2-cover" aria-label={title}>
      <div className="lg2-cover-photo" aria-hidden="true">
        {tenant.heroUrl && <img src={tenant.heroUrl} alt="" fetchPriority="high" decoding="async" style={imageStyle(tenant.heroMedia, tenant)} />}
      </div>
      <div className="lg2-cover-veil" aria-hidden="true" />
      <div className="lg2-cover-top">
        <button className="lg2-fab lg2-cover-search" type="button" onClick={onSearch} aria-label={t("UI.lg.search.title")}>
          <svg aria-hidden="true"><use href="#lg-i-srch" /></svg>
        </button>
        <button className="lg2-fab lg2-language" type="button" onClick={onLanguage} aria-label={t("UI.lg.language", { lang: lang.toUpperCase() })} data-lg-language-trigger>
          {lang.toUpperCase()}
        </button>
      </div>
      <div className="lg2-cover-mast">
        <p className="lg2-cover-kicker">{t("UI.lg.guide")}</p>
        {title && <h1>{title}</h1>}
        {tenant.coverSubtitle && <p className="lg2-cover-subtitle">{tenant.coverSubtitle}</p>}
        {tenant.address && <p className="lg2-cover-address">{tenant.address}</p>}
      </div>
      <button className="lg2-open-guide" type="button" onClick={onOpen}>
        <svg aria-hidden="true"><use href="#lg-i-down" /></svg>
        {t("UI.lg.openGuide")}
      </button>
    </section>
  );
}

function SignInSheet({ tenantName, t, initialGuest, onClose, onSave }: any) {
  const [unit, setUnit] = useState(initialGuest?.unit ?? "");
  const [name, setName] = useState(initialGuest?.name ?? "");
  const unitInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => unitInput.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({ unit, name });
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
        <label className="lg2-field lg2-field--required">
          <span>{t("UI.lg.welcome.unit")}</span>
          <input ref={unitInput} required autoComplete="off" value={unit} placeholder={t("UI.lg.welcome.unitPlaceholder")} onChange={(event) => setUnit(event.target.value)} />
        </label>
        <label className="lg2-field">
          <span>{t("UI.lg.welcome.name")}</span>
          <input autoComplete="name" value={name} placeholder={t("UI.lg.welcome.namePlaceholder")} onChange={(event) => setName(event.target.value)} />
        </label>
        <button className="lg2-primary-button" type="submit" disabled={!unit.trim()}>
          {t("UI.lg.welcome.save")}
        </button>
        <button className="lg2-later" type="button" onClick={onClose}>
          {t("UI.lg.welcome.later")}
        </button>
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

function GridView({ tenant, section, lang, t, guest, onEditGuest, onOpenCategory, onOpenNotices, helpCategoryId, notices }: any) {
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
          <button className="lg2-greeting" type="button" onClick={onEditGuest}>
            <span className="lg2-greeting-icon" aria-hidden="true"><svg><use href="#lg-i-usr" /></svg></span>
            <span>
              <b>{guest.name ? t("UI.lg.greeting.named", { name: guest.name }) : t("UI.lg.greeting.generic")}</b>
              <small>{t("UI.lg.greeting.ordersTo")} {guest.unit}</small>
            </span>
            <em>{t("UI.lg.greeting.change")}</em>
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
            const supporting = [
              distinctSubtitle(item.title, item.subtitle),
              status?.text,
            ].filter(Boolean).join(" · ");
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
  if (!media?.length) return (
    <div className="lg2-detail-hero lg2-detail-hero--ambient" data-lg-ambient-hero>
      <button className="lg2-detail-back" type="button" onClick={onBack} aria-label={t("UI.lg.action.back")}><svg aria-hidden="true"><use href="#lg-i-bk"/></svg></button>
    </div>
  );
  if (singleOnly) {
    const entry = media[0];
    return (
      <div className="lg2-detail-hero">
        <div className="lg2-gallery-track">
          <div className="lg2-gallery-slide">
            <img data-lg-hero-image src={mediaImgSrc(entry, HERO_IMAGE_WIDTH)} alt="" loading="eager" decoding="async" style={imageStyle(entry)} />
          </div>
        </div>
        <button className="lg2-detail-back" type="button" onClick={onBack} aria-label={t("UI.lg.action.back")}><svg aria-hidden="true"><use href="#lg-i-bk" /></svg></button>
      </div>
    );
  }
  return (
    <div className="lg2-detail-hero">
      <div className="lg2-gallery-track" data-lg-gallery onScroll={(e) => {
        const el = e.currentTarget;
        if (!el.clientWidth) return;
        onGalleryIndex(Math.max(0, Math.min(media.length - 1, Math.round(el.scrollLeft / el.clientWidth))));
      }}>
        {media.map((entry: any, index: number) => (
          <div className="lg2-gallery-slide" key={entry.id || index}>
            <img data-lg-hero-image src={mediaImgSrc(entry, HERO_IMAGE_WIDTH)} alt="" loading={index===0?"eager":"lazy"} decoding="async" style={imageStyle(entry)} />
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <div className="lg2-gallery-dots" aria-hidden="true">
          {media.map((_: any, index: number) => <i key={index} className={index === galleryIndex ? "is-active" : undefined} />)}
        </div>
      )}
      <button className="lg2-detail-back" type="button" onClick={onBack} aria-label={t("UI.lg.action.back")}><svg aria-hidden="true"><use href="#lg-i-bk" /></svg></button>
    </div>
  );
}

function DetailView({ category, itemId, lang, t, galleryIndex, onGalleryIndex, onBack, tenant, onOpenItem, showHostContacts }: any) {
  const items = visible(category.items);
  const activeItem = itemId ? items.find((i: any) => i.id === itemId) : null;

  const layout = category.layout || "";

  let content = null;
  if (activeItem) {
    if (layout === "poi") {
      content = <TemplateF item={activeItem} category={category} lang={lang} t={t} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
    } else if (layout === "routes") {
      content = <TemplateG item={activeItem} category={category} t={t} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
    } else if (layout === "tabs") {
      content = <TemplateB2 item={activeItem} category={category} t={t} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
    } else {
        content = <TemplateA category={category} items={[activeItem]} mediaOverride={visible(activeItem.media)} titleOverride={activeItem.title} tenant={tenant} lang={lang} t={t} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
    }
  } else {
    if (layout === "wifi") {
      content = <TemplateE category={category} items={items} tenant={tenant} t={t} onBack={onBack} />;
    } else if (layout === "tabs" && items.length === 2) {
      content = <TemplateD category={category} items={items} t={t} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
    } else if (layout === "tabs" || layout === "apartments" || layout === "products" || layout === "poi" || layout === "routes" || layout === "events") {
      content = <TemplateB category={category} items={items} t={t} onBack={onBack} onOpenItem={onOpenItem} />;
    } else if (layout === "rules") {
      if (isOperationalRulesCategory(category)) {
        content = <TemplateA category={category} items={items} tenant={tenant} showHostContacts={showHostContacts} lang={lang} t={t} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
      } else {
        content = <TemplateC category={category} items={items} t={t} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
      }
    } else {
      content = <TemplateA category={category} items={items} tenant={tenant} showHostContacts={showHostContacts} lang={lang} t={t} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} />;
    }
  }

  return (
    <section className="lg2-view lg2-detail-view">
      {content}
    </section>
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

function TemplateA({ category, items, mediaOverride, titleOverride, tenant, showHostContacts, t, onBack, galleryIndex, onGalleryIndex }: any) {
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
  const detailRows = items.slice(1).filter((i: any) => i.title || i.body || i.bullets?.length);

  return (
    <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
      <div className="lg2-detail-layout">
        <HeroGallery media={media} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} t={t} />
        <article className="lg2-detail-sheet">
          <div className="lg2-grabber" aria-hidden="true" />
          <h1>{heading}</h1>
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
function TemplateB({ category, items, t, onBack, onOpenItem }: any) {
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
                const supporting = [subtitle, status?.text].filter(Boolean).join(" · ");
                return (
                  <button type="button" className="lg2-sub2" key={item.id} onClick={() => onOpenItem(item.id)}>
                    <span className="lg2-sub-icon" aria-hidden="true">
                      {item.media?.[0] ? <img src={mediaImgSrc(item.media[0], CARD_IMAGE_WIDTH)} alt="" style={imageStyle(item.media[0])} className="lg2-sub-img" /> : <svg><use href={`#lg-i-${categoryIcon(category)}`}/></svg>}
                    </span>
                    <div><b>{item.title}</b>{supporting && <small>{supporting}</small>}</div>
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

// Template B2: Steps page
function TemplateB2({ item, category, t, onBack, galleryIndex, onGalleryIndex }: any) {
  const media = visible(item?.media);
  const heading = item?.title || category?.label;
  const subtitle = distinctSubtitle(heading, item?.subtitle);
  const bullets = itemBullets(item);
  return (
    <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
      <div className="lg2-detail-layout">
        <HeroGallery media={media} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} t={t} />
        <article className="lg2-detail-sheet">
           <div className="lg2-grabber" aria-hidden="true" />
           <h1>{heading}</h1>
           {subtitle && <div className="lg2-chips"><span className="lg2-chip">{subtitle}</span></div>}

           {itemBodyHtml(item) && <div className="lg2-detail-prose" dangerouslySetInnerHTML={{ __html: itemBodyHtml(item) }} />}

           <StructuredBulletRows bullets={bullets} numbered />

           {item?.phone && (
             <div className="lg2-actions" style={{marginTop:16}}>
               {item?.phone && <a className="lg2-primary-button" href={`tel:${item.phone}`}><svg aria-hidden="true"><use href="#lg-i-phone"/></svg>{t("UI.lg.action.call")}</a>}
             </div>
           )}
        </article>
      </div>
    </div>
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

// Template D: Segmented
function TemplateD({ category, items, t, onBack, galleryIndex, onGalleryIndex }: any) {
  const [segment, setSegment] = useState(0);
  const activeItem = items[segment] || items[0];
  if (!activeItem) return null;
  const media = visible(activeItem.media);

  return (
    <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
      <div className="lg2-detail-layout">
        <HeroGallery media={media} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} t={t} />
        <article className="lg2-detail-sheet">
          <div className="lg2-grabber" aria-hidden="true" />
          <h1>{category.label}</h1>
          <div className="lg2-seg" role="tablist">
             {items.map((item: any, i: number) => (
                <button
                  id={`lg2-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-controls="lg2-segment-panel"
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
          <div id="lg2-segment-panel" role="tabpanel" aria-labelledby={`lg2-tab-${activeItem.id}`}>
             {itemBodyHtml(activeItem) && <div className="lg2-detail-prose" dangerouslySetInnerHTML={{ __html: itemBodyHtml(activeItem) }} />}
             <StructuredBulletRows bullets={itemBullets(activeItem)} />
          </div>
        </article>
      </div>
    </div>
  );
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
function TemplateF({ item, category, lang, t, onBack, galleryIndex, onGalleryIndex }: any) {
  const media = visible(item?.media);
  const heading = item?.title || category?.label;
  const subtitle = distinctSubtitle(heading, item?.subtitle);
  const bullets = itemBullets(item);
  const openStatus = itemOpenStatus(item, t);

  return (
    <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
      <div className="lg2-detail-layout">
        <HeroGallery media={media} onBack={onBack} galleryIndex={galleryIndex} onGalleryIndex={onGalleryIndex} t={t} />
        <article className="lg2-detail-sheet">
           <div className="lg2-grabber" aria-hidden="true" />
           <h1>{heading}</h1>
           {(openStatus || subtitle || item?.price) && (
             <div className="lg2-chips">
                {openStatus && <span className={`lg2-chip${openStatus.isOpen ? " lg2-chip--open" : ""}`}>{openStatus.text}</span>}
                 {subtitle && <span className="lg2-chip">{subtitle}</span>}
                {item?.price && <span className="lg2-chip">{item.price}</span>}
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
function TemplateG({ item, category, t, onBack, galleryIndex, onGalleryIndex }: any) {
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

function BottomNav({ sections, slug, t, activeSectionKey, onNavigate }: any) {
  const sectionFor = (key: string) => sections.find((section: any) => section.key === key);
  const tabs = [
    { key: "home", label: t("UI.lg.nav.home"), icon: "home", path: `/${slug}` },
    { key: "stay", label: t("UI.lg.nav.stay"), icon: "tent", section: sectionFor("stay") },
    { key: "offer", label: t("UI.lg.nav.offer"), icon: "bag", section: sectionFor("offer") },
    { key: "explore", label: t("UI.lg.nav.area"), icon: "comp", section: sectionFor("explore") },
    { key: "program", label: t("UI.lg.nav.program"), icon: "cal", section: sectionFor("program") },
  ].filter((tab) => tab.key === "home" || tab.section);

  const normalizedActive = activeSectionKey === "services" ? "explore" : activeSectionKey;

  return (
    <nav className="lg2-bottom-nav" aria-label={t("UI.lg.nav.primary")}>
      {tabs.map((tab) => {
        const isActive = tab.key !== "home" && normalizedActive === tab.key;
        const path = tab.path ?? `/${slug}/s/${encodeURIComponent((tab.section as any).key)}`;
        return (
          <button key={tab.key} className={isActive ? "is-active" : undefined} type="button" onClick={() => onNavigate(path)}>
            <svg aria-hidden="true"><use href={`#lg-i-${tab.icon}`} /></svg>
            <b>{tab.label}</b>
          </button>
        );
      })}
    </nav>
  );
}
