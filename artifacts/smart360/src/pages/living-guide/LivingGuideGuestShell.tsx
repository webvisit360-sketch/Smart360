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
import { formatTodayHours } from "@/lib/hours";
import { sanitizeHtml } from "@/lib/sanitize";
import { mediaImgSrc } from "../guest/img";
import { buildGuestPath } from "../guest/guest-url";
import {
  makeT,
  switchLang,
  type UiTranslator,
} from "../guest/i18n";
import { LivingGuideSprite } from "./LivingGuideSprite";
import { livingGuideInterWoff2 } from "./inter-font-source";
import {
  isLivingTheme,
  type LivingTheme,
  useLivingTheme,
} from "./theme-clock";
import "./living-guide-tokens.css";
import "./living-guide-guest.css";

type GuestRecord = {
  unit: string;
  name: string;
};

type ScreenName = "cover" | "grid" | "detail";

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
  } catch {
    // Existing content also contains normal HTML strings.
  }
  return sanitizeHtml(body);
}

function firstMedia(category: any): any | null {
  for (const item of visible(category?.items)) {
    const media = item.media?.[0];
    if (media) return media;
  }
  return null;
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
  const haystack = `${category?.label ?? ""} ${category?.layout ?? ""}`
    .toLocaleLowerCase("sl")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (haystack.includes("wifi")) return "wifi";
  if (haystack.includes("prijav") || haystack.includes("odjav")) return "clk";
  if (haystack.includes("vhod") || haystack.includes("ramp")) return "gate";
  if (haystack.includes("apartma") || haystack.includes("sob")) return "bed";
  if (haystack.includes("lokacij")) return "pin";
  if (haystack.includes("park")) return "car";
  if (haystack.includes("oprem")) return "tool";
  if (haystack.includes("dobrodos")) return "home";
  if (haystack.includes("kontakt")) return "phone";
  return "doc";
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

export default function LivingGuideGuestShell({
  tenant,
  slug,
  lang,
  categoryId,
}: {
  tenant: any;
  slug: string;
  lang: string;
  categoryId: string | null;
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
  const categoryContext =
    allCategories.find((entry: any) => entry.category.id === categoryId) ?? null;
  const staySection =
    sections.find((section: any) => section.key === "stay") ?? sections[0] ?? null;

  const pathParts = location.split("/").filter(Boolean);
  const routeSectionKey =
    pathParts[1] === "s" ? decodeURIComponent(pathParts[2] ?? "") : null;
  const routeSection =
    sections.find((section: any) => section.key === routeSectionKey) ?? null;
  const currentSection = categoryContext?.section ?? routeSection ?? staySection;
  const screen: ScreenName = categoryContext
    ? "detail"
    : routeSectionKey
      ? "grid"
      : "cover";

  const [guest, setGuest] = useState<GuestRecord | null>(() => readGuest(slug));
  const [showSignIn, setShowSignIn] = useState(
    () =>
      screen === "cover" &&
      (welcomeOverride === "show" ||
        (welcomeOverride !== "skip" && !readGuest(slug))),
  );

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
    if (window.history.state?.livingGuide) {
      window.history.back();
      return;
    }
    navigate(gridPath(categoryContext?.section ?? staySection), true);
  }, [categoryContext?.section, navigate, screen, slug, staySection]);

  useEffect(() => {
    if (screen !== "detail") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") goBack();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goBack, screen]);

  const saveGuest = (record: GuestRecord) => {
    const clean = { unit: record.unit.trim(), name: record.name.trim() };
    if (!clean.unit) return;
    setGuest(clean);
    try {
      localStorage.setItem(GUEST_STORAGE_PREFIX + slug, JSON.stringify(clean));
    } catch {
      // Private browsing can make localStorage unavailable; current state still works.
    }
    setShowSignIn(false);
  };

  const openCategory = (id: string) => navigate(`/${slug}/c/${id}`);

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
          <CoverView
            tenant={tenant}
            slug={slug}
            lang={lang}
            t={t}
            onOpen={() => navigate(gridPath(staySection))}
          />
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
          />
        )}

        {screen === "detail" && categoryContext && (
          <DetailView
            category={categoryContext.category}
            lang={lang}
            t={t}
            galleryIndex={galleryIndex}
            onGalleryIndex={setGalleryIndex}
            onBack={goBack}
          />
        )}
      </main>

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
        <SignInSheet
          tenantName={tenant.name}
          t={t}
          initialGuest={guest}
          onClose={() => setShowSignIn(false)}
          onSave={saveGuest}
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

function CoverView({
  tenant,
  slug,
  lang,
  t,
  onOpen,
}: {
  tenant: any;
  slug: string;
  lang: string;
  t: UiTranslator;
  onOpen: () => void;
}) {
  const languages = enabledLanguageCodes(tenant);
  const nextLanguage =
    languages[(Math.max(0, languages.indexOf(lang)) + 1) % languages.length] ?? lang;
  const title = tenant.coverTitle || tenant.name;

  return (
    <section className="lg2-view lg2-cover" aria-label={title}>
      <div className="lg2-cover-photo" aria-hidden="true">
        {tenant.heroUrl && (
          <img src={tenant.heroUrl} alt="" fetchPriority="high" decoding="async" />
        )}
      </div>
      <div className="lg2-cover-veil" aria-hidden="true" />
      <div className="lg2-cover-top">
        <button
          className="lg2-fab lg2-language"
          type="button"
          onClick={() => switchLang(slug, nextLanguage)}
          aria-label={t("UI.lg.language", { lang: lang.toUpperCase() })}
        >
          {lang.toUpperCase()}
        </button>
      </div>
      <div className="lg2-cover-mast">
        <p className="lg2-cover-kicker">{t("UI.lg.guide")}</p>
        {title && <h1>{title}</h1>}
        {tenant.coverSubtitle && (
          <p className="lg2-cover-subtitle">{tenant.coverSubtitle}</p>
        )}
        {tenant.address && <p className="lg2-cover-address">{tenant.address}</p>}
      </div>
      <button className="lg2-open-guide" type="button" onClick={onOpen}>
        <svg aria-hidden="true">
          <use href="#lg-i-down" />
        </svg>
        {t("UI.lg.openGuide")}
      </button>
    </section>
  );
}

function SignInSheet({
  tenantName,
  t,
  initialGuest,
  onClose,
  onSave,
}: {
  tenantName: string;
  t: UiTranslator;
  initialGuest: GuestRecord | null;
  onClose: () => void;
  onSave: (record: GuestRecord) => void;
}) {
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
    <div
      className="lg2-sheet-overlay"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="lg2-welcome-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lg2-welcome-title"
        onSubmit={submit}
      >
        <div className="lg2-grabber" aria-hidden="true" />
        <div className="lg2-welcome-heading">
          <p>{tenantName}</p>
          <h2 id="lg2-welcome-title">{t("UI.lg.welcome.title")}</h2>
          <span>{t("UI.lg.welcome.description")}</span>
        </div>
        <label className="lg2-field lg2-field--required">
          <span>{t("UI.lg.welcome.unit")}</span>
          <input
            ref={unitInput}
            required
            autoComplete="off"
            value={unit}
            placeholder={t("UI.lg.welcome.unitPlaceholder")}
            onChange={(event) => setUnit(event.target.value)}
          />
        </label>
        <label className="lg2-field">
          <span>{t("UI.lg.welcome.name")}</span>
          <input
            autoComplete="name"
            value={name}
            placeholder={t("UI.lg.welcome.namePlaceholder")}
            onChange={(event) => setName(event.target.value)}
          />
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

function GridView({
  tenant,
  section,
  lang,
  t,
  guest,
  onEditGuest,
  onOpenCategory,
}: {
  tenant: any;
  section: any;
  lang: string;
  t: UiTranslator;
  guest: GuestRecord | null;
  onEditGuest: () => void;
  onOpenCategory: (id: string) => void;
}) {
  const categories = visible(section.categories);
  const featuredCategory =
    categories.find(
      (category: any) =>
        category.layout === "rules" &&
        (visible(category.items)[0]?.media?.length ?? 0) > 1,
    ) ??
    categories.find((category: any) => {
    const firstItem = visible(category.items)[0];
    return !firstItem?.tint && !!firstMedia(category);
  });
  const orderedCategories = featuredCategory
    ? [
        featuredCategory,
        ...categories.filter((category: any) => category.id !== featuredCategory.id),
      ]
    : categories;

  return (
    <section className="lg2-view lg2-grid-view">
      <header className="lg2-grid-header">
        <div>
          <p>{tenant.name}</p>
          <h1>{section.title}</h1>
        </div>
      </header>
      <div className="lg2-screen-scroll" data-lg-scroll>
        {guest && (
          <button className="lg2-greeting" type="button" onClick={onEditGuest}>
            <span className="lg2-greeting-icon" aria-hidden="true">
              <svg>
                <use href="#lg-i-usr" />
              </svg>
            </span>
            <span>
              <b>
                {guest.name
                  ? t("UI.lg.greeting.named", { name: guest.name })
                  : t("UI.lg.greeting.generic")}
              </b>
              <small>
                {t("UI.lg.greeting.ordersTo")} {guest.unit}
              </small>
            </span>
            <em>{t("UI.lg.greeting.change")}</em>
          </button>
        )}

        <div className="lg2-grid lg2-stagger">
          {orderedCategories.map((category: any, index: number) => {
            const item = visible(category.items)[0];
            const media = firstMedia(category);
            const isPhotoCard = !!media && !item?.tint;
            const isWide = category.id === featuredCategory?.id;
            const today = formatTodayHours(item?.hoursJson, lang);
            const supporting =
              today ||
              (item?.title && item.title !== category.label ? item.title : null);
            const staggerStyle = {
              "--lg2-delay": `${0.05 + Math.min(index, 6) * 0.06}s`,
            } as CSSProperties;

            if (isPhotoCard) {
              return (
                <button
                  key={category.id}
                  className={`lg2-photo-card${isWide ? " lg2-photo-card--wide" : ""}`}
                  style={staggerStyle}
                  type="button"
                  onClick={() => onOpenCategory(category.id)}
                >
                  <img
                    src={mediaImgSrc(media, isWide ? 1400 : 620)}
                    alt=""
                    loading={index < 2 ? "eager" : "lazy"}
                    decoding="async"
                  />
                  <span>
                    <b>{category.label}</b>
                    {supporting && <small>{supporting}</small>}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={category.id}
                className="lg2-utility-card"
                style={staggerStyle}
                type="button"
                onClick={() => onOpenCategory(category.id)}
              >
                <span className="lg2-utility-icon" aria-hidden="true">
                  <svg>
                    <use href={`#lg-i-${categoryIcon(category)}`} />
                  </svg>
                </span>
                <span>
                  <b>{category.label}</b>
                  {supporting && <small>{supporting}</small>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DetailView({
  category,
  lang,
  t,
  galleryIndex,
  onGalleryIndex,
  onBack,
}: {
  category: any;
  lang: string;
  t: UiTranslator;
  galleryIndex: number;
  onGalleryIndex: (index: number) => void;
  onBack: () => void;
}) {
  const items = visible(category.items);
  const firstItem = items[0] ?? null;
  const media = categoryMedia(category);
  const today = formatTodayHours(firstItem?.hoursJson, lang);
  const introTitle =
    firstItem?.title && firstItem.title !== category.label ? firstItem.title : null;
  const introBody = bodyHtml(firstItem?.body);
  const detailRows = items
    .slice(1)
    .filter((item: any) => item.title || item.body || item.bullets?.length);

  const actions = [
    firstItem?.phone
      ? {
          href: `tel:${firstItem.phone}`,
          label: t("UI.lg.action.call"),
          icon: "phone",
          external: false,
        }
      : null,
    firstItem?.mapQuery
      ? {
          href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(firstItem.mapQuery)}`,
          label: t("UI.lg.action.directions"),
          icon: "nav2",
          external: true,
        }
      : null,
    firstItem?.website
      ? {
          href: externalUrl(firstItem.website),
          label: t("UI.lg.action.website"),
          icon: "comp",
          external: true,
        }
      : null,
  ]
    .filter(Boolean)
    .slice(0, 2) as Array<{
    href: string;
    label: string;
    icon: string;
    external: boolean;
  }>;

  const todayTime = today?.match(/\d{1,2}:\d{2}–\d{1,2}:\d{2}/)?.[0] ?? null;

  return (
    <section className="lg2-view lg2-detail-view">
      <div className="lg2-screen-scroll lg2-detail-scroll" data-lg-scroll>
        <div className="lg2-detail-layout">
          {media.length > 0 && (
            <div className="lg2-detail-hero">
              <div
                className="lg2-gallery-track"
                data-lg-gallery
                onScroll={(event) => {
                  const element = event.currentTarget;
                  if (!element.clientWidth) return;
                  onGalleryIndex(
                    Math.max(
                      0,
                      Math.min(
                        media.length - 1,
                        Math.round(element.scrollLeft / element.clientWidth),
                      ),
                    ),
                  );
                }}
              >
                {media.map((entry: any, index: number) => (
                  <div className="lg2-gallery-slide" key={entry.id ?? `${entry.url}-${index}`}>
                    <img
                      src={mediaImgSrc(entry, 1400)}
                      alt=""
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                    />
                  </div>
                ))}
              </div>
              {media.length > 1 && (
                <div className="lg2-gallery-dots" aria-hidden="true">
                  {media.map((entry: any, index: number) => (
                    <i
                      key={entry.id ?? index}
                      className={index === galleryIndex ? "is-active" : undefined}
                    />
                  ))}
                </div>
              )}
              <button
                className="lg2-detail-back"
                type="button"
                onClick={onBack}
                aria-label={t("UI.lg.action.back")}
              >
                <svg aria-hidden="true">
                  <use href="#lg-i-bk" />
                </svg>
              </button>
            </div>
          )}

          <article className={`lg2-detail-sheet${media.length ? "" : " lg2-detail-sheet--solo"}`}>
            <div className="lg2-grabber" aria-hidden="true" />
            <h1>{category.label}</h1>

            {(todayTime || firstItem?.open24) && (
              <div className="lg2-facts">
                <div>
                  <b>
                    {firstItem?.open24
                      ? t("UI.lg.hours.alwaysValue")
                      : todayTime}
                  </b>
                  <small>
                    {firstItem?.open24
                      ? t("UI.lg.hours.alwaysLabel")
                      : t("UI.lg.hours.openUntil")}
                  </small>
                </div>
              </div>
            )}

            {introTitle && <p className="lg2-detail-lead">{introTitle}</p>}
            {introBody && (
              <div
                className="lg2-detail-prose"
                dangerouslySetInnerHTML={{ __html: introBody }}
              />
            )}
            {firstItem?.bullets?.length > 0 && (
              <ul className="lg2-bullets">
                {firstItem.bullets.map((bullet: string) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}

            {detailRows.length > 0 && (
              <div className="lg2-rule-list">
                {detailRows.map((item: any, index: number) => (
                  <div
                    className={`lg2-rule-row${index === 0 ? " lg2-rule-row--warning" : ""}`}
                    key={item.id}
                  >
                    <span className="lg2-rule-icon" aria-hidden="true">
                      <svg>
                        <use href={`#lg-i-${index === 0 ? "sos" : "doc"}`} />
                      </svg>
                    </span>
                    <div>
                      {item.title && <b>{item.title}</b>}
                      {item.body && (
                        <span
                          dangerouslySetInnerHTML={{ __html: bodyHtml(item.body) }}
                        />
                      )}
                      {item.bullets?.length > 0 && (
                        <ul>
                          {item.bullets.map((bullet: string) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {actions.length > 0 && (
              <div className="lg2-actions">
                {actions.map((action) => (
                  <a
                    key={action.href}
                    className="lg2-primary-button"
                    href={action.href}
                    target={action.external ? "_blank" : undefined}
                    rel={action.external ? "noopener noreferrer" : undefined}
                  >
                    <svg aria-hidden="true">
                      <use href={`#lg-i-${action.icon}`} />
                    </svg>
                    {action.label}
                  </a>
                ))}
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}

function BottomNav({
  sections,
  slug,
  t,
  activeSectionKey,
  onNavigate,
}: {
  sections: any[];
  slug: string;
  t: UiTranslator;
  activeSectionKey: string | null;
  onNavigate: (path: string) => void;
}) {
  const sectionFor = (key: string) =>
    sections.find((section: any) => section.key === key);
  const tabs = [
    {
      key: "home",
      label: t("UI.lg.nav.home"),
      icon: "home",
      path: `/${slug}`,
    },
    {
      key: "stay",
      label: t("UI.lg.nav.stay"),
      icon: "tent",
      section: sectionFor("stay"),
    },
    {
      key: "offer",
      label: t("UI.lg.nav.offer"),
      icon: "bag",
      section: sectionFor("offer"),
    },
    {
      key: "explore",
      label: t("UI.lg.nav.area"),
      icon: "comp",
      section: sectionFor("explore"),
    },
  ].filter((tab) => tab.key === "home" || tab.section);

  const normalizedActive =
    activeSectionKey === "services" ? "explore" : activeSectionKey;

  return (
    <nav className="lg2-bottom-nav" aria-label={t("UI.lg.nav.primary")}>
      {tabs.map((tab) => {
        const isActive = tab.key !== "home" && normalizedActive === tab.key;
        const path =
          tab.path ??
          `/${slug}/s/${encodeURIComponent((tab.section as any).key)}`;
        return (
          <button
            key={tab.key}
            className={isActive ? "is-active" : undefined}
            type="button"
            onClick={() => onNavigate(path)}
          >
            <svg aria-hidden="true">
              <use href={`#lg-i-${tab.icon}`} />
            </svg>
            <b>{tab.label}</b>
          </button>
        );
      })}
    </nav>
  );
}