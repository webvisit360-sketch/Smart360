import { useGuestInstall } from "../guest/guest-install";
import "../guest/guest-install.css";

const copy = {
  sl: { title: "Dodaj vodnik na začetni zaslon", button: "Dodaj vodnik", close: "Zapri", ios: "Tapni Deli, nato Dodaj na začetni zaslon.", note: "Vodnik bo vedno pri roki.", error: "Poziv ni na voljo. Poskusi prek menija brskalnika." },
  en: { title: "Add guide to Home Screen", button: "Add guide", close: "Dismiss", ios: "Tap Share, then Add to Home Screen.", note: "Keep your guide close at hand.", error: "Install prompt unavailable. Try the browser menu." },
  de: { title: "Guide zum Home-Bildschirm hinzufügen", button: "Guide hinzufügen", close: "Schließen", ios: "Tippe auf Teilen, dann Zum Home-Bildschirm.", note: "Dein Guide ist immer griffbereit.", error: "Installationsdialog nicht verfügbar. Nutze das Browsermenü." },
  it: { title: "Aggiungi la guida alla schermata Home", button: "Aggiungi guida", close: "Chiudi", ios: "Tocca Condividi, poi Aggiungi alla schermata Home.", note: "La guida sarà sempre a portata di mano.", error: "Installazione non disponibile. Usa il menu del browser." },
} as const;

export function GuestInstallCard({ slug, lang, enabled, placement }: { slug: string; lang: string; enabled: boolean; placement?: "cover" | "mediterranean" }) {
  const { mode, dismiss, install, promptError, canPrompt } = useGuestInstall(slug, enabled);
  if (!mode) return null;
  const text = copy[lang as keyof typeof copy] ?? copy.sl;
  const card = (
    <aside className="lg2-install-card" data-testid={`card-install-${mode}`}>
      <div className="lg2-install-glyph" aria-hidden="true">
        {mode === "ios" ? <svg viewBox="0 0 32 32" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3v17m-6-11 6-6 6 6M7 17v11h18V17" /></svg> : "+"}
      </div>
      <div className="lg2-install-body">
        <strong>{text.title}</strong>
        <p role={promptError ? "alert" : undefined}>{mode === "ios" ? text.ios : promptError ? text.error : text.note}</p>
        {mode === "chromium" && canPrompt && (
          <button type="button" className="lg2-install-action" onClick={() => void install()} data-testid="button-install-guide">{text.button} <span aria-hidden="true">↗</span></button>
        )}
      </div>
      <button type="button" className="lg2-install-close" onClick={dismiss} aria-label={text.close} data-testid="button-dismiss-install">×</button>
    </aside>
  );
  return placement ? <div className={`guest-install-${placement}`}>{card}</div> : card;
}