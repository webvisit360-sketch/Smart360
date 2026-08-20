import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { UiTranslator } from "../guest/i18n";

function visible(rows: any[] | null | undefined): any[] {
  return (rows ?? []).filter((row) => row.isVisible !== false);
}

function normalizedSearchText(value: unknown): string {
  return typeof value === "string"
    ? value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLocaleLowerCase()
        .trim()
    : "";
}

export function LivingGuideSearchSheet({
  sections,
  t,
  onClose,
  onOpenCategory,
  onOpenItem,
}: {
  sections: any[];
  t: UiTranslator;
  onClose: () => void;
  onOpenCategory: (categoryId: string) => void;
  onOpenItem: (categoryId: string, itemId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      if (returnFocusRef.current?.isConnected) {
        returnFocusRef.current.focus();
      }
    };
  }, []);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => !element.hasAttribute("hidden"));
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const results = useMemo(() => {
    const normalizedQuery = normalizedSearchText(query);
    if (!normalizedQuery) return [];

    return sections
      .flatMap((section: any) =>
        visible(section.categories).flatMap((category: any) => {
          const categoryResult = {
            id: `category:${category.id}`,
            title: category.label,
            subtitle: section.title,
            icon: "doc",
            onOpen: () => onOpenCategory(category.id),
          };
          const itemResults = visible(category.items).map((item: any) => ({
            id: `item:${item.id}`,
            title: item.title,
            subtitle: category.label,
            icon: "srch",
            onOpen: () => onOpenItem(category.id, item.id),
          }));
          return [categoryResult, ...itemResults];
        }),
      )
      .filter((result: any) =>
        normalizedSearchText(result.title).includes(normalizedQuery),
      )
      .slice(0, 40);
  }, [onOpenCategory, onOpenItem, query, sections]);

  return (
    <div
      className="lg2-sheet-overlay"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="lg2-welcome-sheet lg2-search-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lg2-search-title"
        data-lg-search-sheet
        onKeyDown={handleDialogKeyDown}
      >
        <div className="lg2-grabber" aria-hidden="true" />
        <h2 id="lg2-search-title">{t("UI.lg.search.title")}</h2>
        <label className="lg2-search-field">
          <span className="lg2-sr-only">{t("UI.lg.search.title")}</span>
          <svg aria-hidden="true"><use href="#lg-i-srch" /></svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder={t("UI.lg.search.placeholder")}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="lg2-search-results">
          {results.map((result: any) => (
            <button
              type="button"
              className="lg2-sub2"
              key={result.id}
              onClick={result.onOpen}
            >
              <span className="lg2-sub-icon" aria-hidden="true">
                <svg><use href={`#lg-i-${result.icon}`} /></svg>
              </span>
              <span>
                <b>{result.title}</b>
                <small>{result.subtitle}</small>
              </span>
              <span className="lg2-chevron" aria-hidden="true">›</span>
            </button>
          ))}
          {query.trim() && results.length === 0 && (
            <p className="lg2-search-empty">{t("UI.lg.search.empty")}</p>
          )}
        </div>
      </div>
    </div>
  );
}