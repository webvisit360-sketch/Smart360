import { FormEvent, useEffect, useMemo, useState } from "react";
import enquiryHtml from "@assets/Smart360-povprasevanje_1_1787894314826.html?raw";
import "./enquiry.css";

const propertyTypes = ["Apartma", "Hiša do 6 enot", "Kamp", "Hotel"] as const;
const BUSINESS_CONTACT_EMAIL = "smart360hq@gmail.com";
const logoSvg = enquiryHtml.match(/<div class="lk">([\s\S]*?<\/svg>)<\/div>/)?.[1] ?? "";
const ringSvg = enquiryHtml.match(/<div class="bgring"[^>]*>([\s\S]*?<\/svg>)<\/div>/)?.[1] ?? "";

export default function EnquiryPage() {
  const [propertyType, setPropertyType] = useState<(typeof propertyTypes)[number]>("Apartma");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = useMemo(() => "Smart360 — povpraševanje", []);

  useEffect(() => {
    document.title = title;
    document.body.classList.toggle("sent", sent);
    return () => document.body.classList.remove("sent");
  }, [sent, title]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/public/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          propertyName: form.get("propertyName"),
          address: form.get("address"),
          propertyType,
          message: form.get("message") || undefined,
          website: form.get("website"),
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Pošiljanje ni uspelo. Poskusite znova.");
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pošiljanje ni uspelo. Poskusite znova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="enquiry-page">
      <div className="enquiry-ring" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ringSvg }} />
      <div className="enquiry-wrap">
        <header className="enquiry-head">
          <div className="enquiry-logo" role="img" aria-label="Smart360" dangerouslySetInnerHTML={{ __html: logoSvg }} />
          <h1>Poglejva, kako bi izgledal vaš vodnik</h1>
          <p>Pošljite pet podatkov. Odgovorim v enem delovnem dnevu — brez obveznosti.</p>
        </header>

        <main className="enquiry-card">
          <form className="enquiry-form" onSubmit={submit}>
            <div className="enquiry-reassurance"><i /><span>Okolico, razdalje in opise pripravimo mi. Vi dodate fotografije svoje hiše in ponudbo — vašega dela je za pol ure.</span></div>
            <div className="enquiry-two">
              <label>Ime in priimek<input name="name" placeholder="Ana Novak" minLength={2} maxLength={120} required /></label>
              <label>E-pošta<input name="email" type="email" placeholder="ana@primer.si" maxLength={254} required /></label>
            </div>
            <label>Ime nastanitve<input name="propertyName" placeholder="Apartmaji Meli Pu" minLength={2} maxLength={160} required /></label>
            <label>Naslov nastanitve<input name="address" placeholder="Malija 143b, 6310 Izola" minLength={3} maxLength={240} required /></label>
            <fieldset>
              <legend>Kaj oddajate</legend>
              <div className="enquiry-chips">
                {propertyTypes.map((type) => (
                  <button key={type} className={propertyType === type ? "on" : ""} type="button" onClick={() => setPropertyType(type)}>{type}</button>
                ))}
              </div>
            </fieldset>
            <label>Vprašanje ali opomba — neobvezno<textarea name="message" placeholder="Kaj bi radi izvedeli?" maxLength={2000} /></label>
            <label className="enquiry-honeypot" aria-hidden="true">Spletna stran<input name="website" tabIndex={-1} autoComplete="off" /></label>
            {error && <p className="enquiry-error" role="alert">{error}</p>}
            <button className="enquiry-submit" type="submit" disabled={busy}>{busy ? "Pošiljam …" : "Pošljite povpraševanje"}</button>
            <p className="enquiry-note">Vaše podatke uporabim samo za odgovor na to povpraševanje. Več v <a href="/zasebnost">obvestilu o zasebnosti</a>.</p>
          </form>

          <section className="enquiry-success" aria-live="polite">
            <div className="tick"><svg viewBox="0 0 24 24"><path d="m4 12.5 5.5 5.5L20 7" /></svg></div>
            <h2>Prejeto, hvala.</h2>
            <p>Oglasim se v enem delovnem dnevu. Če je nujno, pišite na {BUSINESS_CONTACT_EMAIL}.</p>
          </section>
        </main>
        <footer className="enquiry-foot"><a href="/pogoji">Pogoji uporabe</a> · Agencija Sinhron d.o.o.</footer>
      </div>
    </div>
  );
}