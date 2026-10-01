import { useEffect, useRef, useState } from "react";
import "./sos.css";
import { sosLang, sosT } from "./sos-i18n";
import {
  ageSeconds, bearingDeg, cardinal, copyText, detectOs, distanceMeters,
  formatDecimal, formatDecimalRough, formatDistance, formatDmsPair, shareText,
  smsUrl, sosStatus, tenantHasCoords, type SosTenant,
} from "./sos-model";
import { useSosGeolocation, type SosGeolocationSource } from "./use-sos-geolocation";

function SosIcon({ name }: { name: "phone" | "pin" | "copy" | "share" | "nav2" | "chat" }) {
  return <svg className="sos-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href={`#lg-i-${name}`} /></svg>;
}

export interface SosViewProps {
  tenant: SosTenant | null | undefined;
  lang: string;
  onClose: () => void;
  /** DEV fixture only: simulated geolocation source. */
  geolocation?: SosGeolocationSource | null;
  /** DEV fixture only: force OS instructions. */
  osOverride?: "ios" | "android" | "desktop";
}

/** Emergency entry card for the top of "Pomoč in nujni primeri". */
export function SosCard({ lang, onOpen }: { lang: string; onOpen: () => void }) {
  const t = sosT(lang);
  return (
    <div className="sos-scope soscard">
      <div className="h">
        <div className="sosdot" aria-hidden="true">SOS</div>
        <div className="t">{t.cardTitle}</div>
      </div>
      <div className="p">{t.cardText}</div>
      <button type="button" className="sosbtn" onClick={onOpen}>{t.cardButton}</button>
    </div>
  );
}

/** Small round SOS button for tour maps. Parent positions it (corner). */
export function SosMapButton({ lang, onOpen }: { lang: string; onOpen: () => void }) {
  const t = sosT(lang);
  return (
    <button type="button" className="sos-scope sos-mapbtn" onClick={onOpen} aria-label={t.mapButton} title={t.mapButton}>
      SOS
    </button>
  );
}

type Msg = { kind: "ok" } | { kind: "fail"; text: string } | null;

async function tryCopy(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function SosView({ tenant, lang, onClose, geolocation, osOverride }: SosViewProps) {
  const t = sosT(lang);
  const l = sosLang(lang);
  const { fix, error, now, retry } = useSosGeolocation(geolocation);
  const status = sosStatus(fix, error, now);
  const [msg, setMsg] = useState<Msg>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    closeRef.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const precise = status.kind === "active" || status.kind === "stale" ? status.fix : null;
  const smsFix = status.kind === "active" || status.kind === "stale" || status.kind === "poor" ? status.fix : null;
  const os = osOverride ?? detectOs(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
    typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0,
  );

  const doCopy = async () => {
    if (!precise) return;
    const text = copyText(precise);
    setMsg((await tryCopy(text)) ? { kind: "ok" } : { kind: "fail", text });
  };

  const doShare = async () => {
    if (!precise) return;
    const text = shareText(precise);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // user cancelled: not an error
      }
    }
    setMsg((await tryCopy(text)) ? { kind: "ok" } : { kind: "fail", text });
  };

  const blocked = status.kind === "denied" || status.kind === "unsupported";
  const call = (
    <>
      <a href="tel:112" className="call112 sticky"><SosIcon name="phone" />{"\u00A0 "}{t.call}</a>
      <div className="call-reassurance" data-testid="text-sos-call-reassurance">{t.callReassurance}</div>
    </>
  );

  let orientation: { nt: string; ns: string | null } | null = null;
  if (precise && tenantHasCoords(tenant)) {
    const from = { lat: tenant.latitude, lon: tenant.longitude };
    const d = distanceMeters(from, precise);
    orientation = {
      nt: t.near(formatDistance(d, l), t.dir[cardinal(bearingDeg(from, precise))], tenant.name),
      ns: tenant.address?.trim() || null,
    };
  }

  return (
    <div className="sos-overlay" role="dialog" aria-modal="true" aria-labelledby="sos-title">
      <div className="sos-scope phone">
        <button ref={closeRef} type="button" className="sos-close" onClick={onClose} aria-label={t.close}>×</button>
        <div className="small">{t.eyebrow}</div>
        <div className="h1" id="sos-title">{t.title}</div>
        <div className="sub">{t.sub}</div>

        {blocked && call}

        {status.kind === "denied" && (
          <div className="seek top" role="alert">
            <SosIcon name="pin" />
            <div>
              <div className="st">{t.deniedTitle}</div>
              <div className="ss denied-reassurance" data-testid="text-sos-denied-reassurance">{t.deniedReassurance}</div>
              <div className="ss">{t.deniedSub}</div>
              <div className="os-label">{t.osLabel[os]}</div>
              <ol className="os-list">{t.os[os].map((s) => <li key={s}>{s}</li>)}</ol>
              <button type="button" className="retry" onClick={retry}>{t.retry}</button>
            </div>
          </div>
        )}
        {status.kind === "unsupported" && (
          <div className="seek" role="alert">
            <SosIcon name="pin" />
            <div><div className="st">{t.unsupportedTitle}</div><div className="ss">{t.unsupportedSub}</div></div>
          </div>
        )}
        {status.kind === "acquiring" && (
          <div className="seek" role="status">
            <SosIcon name="nav2" />
            <div><div className="st">{t.acquiringTitle}</div><div className="ss">{status.errored ? t.acquiringError : t.acquiringSub}</div></div>
          </div>
        )}
        {status.kind === "poor" && (
          <div className="seek" role="status">
            <SosIcon name="nav2" />
            <div><div className="st">{t.poorTitle}</div><div className="ss">{t.poorSub(Math.round(status.fix.accuracy))}</div></div>
          </div>
        )}
        {status.kind === "stale" && (
          <div className="seek" role="status">
            <SosIcon name="nav2" />
            <div><div className="st">{t.staleTitle}</div><div className="ss">{t.staleSub(ageSeconds(status.fix, now))}</div></div>
          </div>
        )}

        {!blocked && (
          <div className="coord">
            <div className="k">{t.coordsLabel}</div>
            {precise ? (
              <>
                <div className="big" aria-live="polite">
                  {formatDecimal(precise.lat, "lat")}<br />{formatDecimal(precise.lon, "lon")}
                </div>
                <div className="dms">{formatDmsPair(precise.lat, precise.lon)}</div>
                <div className="statrow">
                  <div className="stat"><div className="sk">{t.altitude}</div><div className="sv">{precise.altitude == null ? t.unknown : `${Math.round(precise.altitude)} m`}</div></div>
                  <div className="stat"><div className="sk">{t.accuracy}</div><div className="sv">± {Math.round(precise.accuracy)} m</div></div>
                  <div className="stat"><div className="sk">{t.updated}</div><div className="sv">{t.ago(ageSeconds(precise, now))}</div></div>
                </div>
                {status.kind === "active" && (
                  <div className="fresh"><span className="pulse" aria-hidden="true"></span>{t.fresh}</div>
                )}
              </>
            ) : status.kind === "poor" ? (
              <>
                <div className="big grey">{formatDecimalRough(status.fix.lat, "lat")}<br />{formatDecimalRough(status.fix.lon, "lon")}</div>
                <div className="dms">{t.improving}</div>
              </>
            ) : (
              <>
                <div className="big grey">— °<br />— °</div>
                <div className="dms">{t.improving}</div>
              </>
            )}
          </div>
        )}

        {orientation && (
          <div className="near">
            <SosIcon name="pin" />
            <div>
              <div className="nt">{orientation.nt}</div>
              {orientation.ns && <div className="ns">{orientation.ns}</div>}
            </div>
          </div>
        )}

        {!blocked && call}

        {status.kind !== "denied" && (
          <>
            <div className="secrow">
              {precise && (
                <>
                  <button type="button" className="sec" onClick={doCopy}><SosIcon name="copy" />{"\u00A0 "}{t.copy}</button>
                  <button type="button" className="sec" onClick={doShare}><SosIcon name="share" />{"\u00A0 "}{t.share}</button>
                </>
              )}
              {smsFix ? (
                <a className="sec" data-testid="link-sos-sms" href={smsUrl(smsFix, os)} title={t.smsManual}><SosIcon name="chat" />{"\u00A0 "}{t.sms}</a>
              ) : (
                <button type="button" className="sec" data-testid="button-sos-sms" disabled aria-describedby="sos-sms-hint"><SosIcon name="chat" />{"\u00A0 "}{t.sms}</button>
              )}
            </div>
            {!smsFix && <div id="sos-sms-hint" className="sms-hint" data-testid="text-sos-sms-hint">{t.smsHint}</div>}
            {msg && (
              <div className="sos-msg" role="status">
                {msg.kind === "ok" ? t.copied : (
                  <>
                    {t.copyFailed}
                    <textarea className="sos-manual" readOnly rows={3} aria-label={t.manualCopy} value={msg.text} onFocus={(e) => e.currentTarget.select()} />
                  </>
                )}
              </div>
            )}
          </>
        )}

        {(
          <ol className="guide">
            {t.guide.map(([b, rest], i) => (
              <li className="grow" key={b}><div className="n">{i + 1}</div><div className="g"><b>{b}</b>{rest}</div></li>
            ))}
          </ol>
        )}

        <div className="priv">{t.privacy[0]}<br />{t.privacy[1]}</div>
      </div>
    </div>
  );
}

export default SosView;
