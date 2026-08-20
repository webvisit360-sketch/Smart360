import {
  type KeyboardEvent,
  useEffect,
  useRef,
} from "react";
import type { UiTranslator } from "../guest/i18n";

const LANGUAGE_NAMES: Record<string, string> = {
  sl: "Slovenščina",
  en: "English",
  de: "Deutsch",
  it: "Italiano",
};

export function LivingGuideLanguageSheet({
  languages,
  currentLanguage,
  t,
  onClose,
  onSelect,
}: {
  languages: string[];
  currentLanguage: string;
  t: UiTranslator;
  onClose: () => void;
  onSelect: (lang: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const currentButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = window.requestAnimationFrame(() =>
      currentButtonRef.current?.focus(),
    );
    return () => {
      window.cancelAnimationFrame(frame);
      if (returnFocusRef.current?.isConnected) {
        returnFocusRef.current.focus();
      }
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const buttons = Array.from(
      dialogRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])",
      ) ?? [],
    );
    if (buttons.length === 0) {
      event.preventDefault();
      return;
    }

    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

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
        className="lg2-welcome-sheet lg2-language-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lg2-language-title"
        onKeyDown={handleKeyDown}
        data-lg-language-sheet
      >
        <div className="lg2-grabber" aria-hidden="true" />
        <h2 id="lg2-language-title">{t("UI.lg.languagePicker.title")}</h2>
        <div className="lg2-language-options">
          {languages.map((language) => {
            const isCurrent = language === currentLanguage;
            return (
              <button
                ref={isCurrent ? currentButtonRef : undefined}
                key={language}
                type="button"
                className={isCurrent ? "is-current" : undefined}
                aria-current={isCurrent ? "true" : undefined}
                onClick={() => onSelect(language)}
              >
                <span className="lg2-language-code">
                  {language.toUpperCase()}
                </span>
                <span>{LANGUAGE_NAMES[language] ?? language.toUpperCase()}</span>
                <span className="lg2-language-check" aria-hidden="true">
                  {isCurrent ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}