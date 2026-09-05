import { useEffect, useState } from "react";

type GuestLanguage = "sl" | "en" | "de" | "it";

const COPY: Record<
  GuestLanguage,
  { failure: string; retry: string; retrying: string }
> = {
  sl: {
    failure: "Vodnika trenutno ni mogoče naložiti. Preverite povezavo.",
    retry: "Poskusi znova",
    retrying: "Vodnik se znova nalaga …",
  },
  en: {
    failure: "The guide cannot be loaded right now. Check your connection.",
    retry: "Try again",
    retrying: "Loading the guide again …",
  },
  de: {
    failure: "Der Guide kann derzeit nicht geladen werden. Prüfen Sie Ihre Verbindung.",
    retry: "Erneut versuchen",
    retrying: "Der Guide wird erneut geladen …",
  },
  it: {
    failure: "Al momento non è possibile caricare la guida. Controlla la connessione.",
    retry: "Riprova",
    retrying: "Nuovo caricamento della guida …",
  },
};

const RETRY_DELAY_MS = 1_200;
const RETRY_KEY_PREFIX = "s360:guest-load-retry:";

function language(value: string): GuestLanguage {
  return value === "en" || value === "de" || value === "it" ? value : "sl";
}

function retryKey() {
  return `${RETRY_KEY_PREFIX}${window.location.pathname}${window.location.search}`;
}

export function clearGuestLoadRetryGuard() {
  try {
    window.sessionStorage.removeItem(retryKey());
  } catch {
    // Storage may be unavailable in a restricted browser; successful load needs no recovery.
  }
}

function claimAutomaticRetry(): boolean {
  try {
    const key = retryKey();
    if (window.sessionStorage.getItem(key) === "1") return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    // Without durable tab storage, an automatic reload could loop forever.
    return false;
  }
}

export function GuestLoadRecovery({ lang }: { lang: string }) {
  const [willReload] = useState(claimAutomaticRetry);
  const copy = COPY[language(lang)];

  useEffect(() => {
    if (!willReload) return;
    const timer = window.setTimeout(() => window.location.reload(), RETRY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [willReload]);

  const retryManually = () => {
    clearGuestLoadRetryGuard();
    window.location.reload();
  };

  return (
    <main className="guest-load-failure notranslate" translate="no">
      <img
        className="guest-load-failure__mark"
        src={`${import.meta.env.BASE_URL}brand/smart360-kolobar-temno.svg`}
        alt=""
        aria-hidden="true"
      />
      {willReload ? (
        <p className="guest-load-failure__retrying" role="status">
          {copy.retrying}
        </p>
      ) : (
        <>
          <h1>{copy.failure}</h1>
          <button type="button" onClick={retryManually}>
            {copy.retry}
          </button>
        </>
      )}
    </main>
  );
}