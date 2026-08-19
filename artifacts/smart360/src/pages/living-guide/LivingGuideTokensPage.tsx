import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { installTapFeedback } from "../guest/tap-feedback";
import { livingGuideInterWoff2 } from "./inter-font-source";
import { LivingGuideSprite } from "./LivingGuideSprite";
import {
  isLivingTheme,
  LIVING_THEMES,
  type LivingTheme,
  useLivingTheme,
} from "./theme-clock";
import "./living-guide-tokens.css";

const THEME_LABELS: Record<LivingTheme, string> = {
  jutro: "Jutro",
  dan: "Dan",
  vecer: "Zlata ura",
  noc: "Noč",
};

const LIVE_TOKEN_NAMES = [
  "--amb1",
  "--amb2",
  "--amb3",
  "--ambbg",
  "--bg",
  "--card",
  "--card2",
  "--tx",
  "--tx2",
  "--line",
  "--acc",
  "--accg",
  "--onacc",
  "--warm",
  "--glass",
  "--scrim",
  "--navtx",
  "--phbr",
] as const;

type LiveTokenName = (typeof LIVE_TOKEN_NAMES)[number];

function Icon({ name }: { name: string }) {
  return (
    <svg className="lg-icon" aria-hidden="true">
      <use href={`#lg-i-${name}`} />
    </svg>
  );
}

function Stars() {
  const stars = useMemo(
    () =>
      Array.from({ length: 90 }, (_, index) => {
        const x = (index * 47.37 + 11) % 100;
        const y = (index * 29.83 + 7) % 100;
        const size = index % 19 === 0 ? 3 : index % 5 === 0 ? 2.2 : 1.5;
        return {
          x,
          y,
          size,
          duration: 2.4 + (index % 17) * 0.2,
          delay: (index % 13) * 0.27,
          opacity: 0.55 + (index % 8) * 0.05,
        };
      }),
    [],
  );

  return (
    <div className="lg-stars" aria-hidden="true">
      {stars.map((star, index) => (
        <i
          key={index}
          style={
            {
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
              "--d": `${star.duration}s`,
              "--dl": `${star.delay}s`,
              "--o": star.opacity,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function ThemeSamples() {
  return (
    <div className="lg-theme-samples" aria-label="Vse štiri barvne teme">
      {LIVING_THEMES.map((theme) => (
        <div
          className={`lg-theme-sample lg-theme-sample--${theme}`}
          key={theme}
        >
          <b>{THEME_LABELS[theme]}</b>
          <div className="lg-swatches">
            <span className="lg-swatch lg-swatch--bg" title="Ozadje" />
            <span className="lg-swatch lg-swatch--card" title="Kartica" />
            <span className="lg-swatch lg-swatch--accent" title="Poudarek" />
          </div>
          <small>bg · card · accent</small>
        </div>
      ))}
    </div>
  );
}

function LiveTokenTable({
  theme,
  values,
}: {
  theme: LivingTheme;
  values: Record<LiveTokenName, string>;
}) {
  return (
    <section className="lg-token-table-wrap" aria-labelledby="lg-live-token-title">
      <div className="lg-token-table-heading">
        <div>
          <span className="lg-kicker">getComputedStyle · runtime</span>
          <h2 id="lg-live-token-title">Žive vrednosti · {THEME_LABELS[theme]}</h2>
        </div>
        <span>{LIVE_TOKEN_NAMES.length} custom properties</span>
      </div>
      <table className="lg-token-table">
        <caption className="lg-sr-only">
          Žive izračunane CSS vrednosti aktivne teme
        </caption>
        <tbody>
          {LIVE_TOKEN_NAMES.map((name) => (
            <tr key={name}>
              <th scope="row"><code>{name}</code></th>
              <td><code data-live-token={name}>{values[name] || "—"}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DemoQr() {
  return (
    <div className="lg-qr" aria-label="Primer WiFi QR">
      <svg viewBox="0 0 84 84" aria-hidden="true">
        <g fill="currentColor">
          <path d="M2 2h26v26H2zm6 6v14h14V8zm48-6h26v26H56zm6 6v14h14V8zM2 56h26v26H2zm6 6v14h14V62z" />
          <path d="M34 4h8v8h-8zm12 0h6v18h-6zM34 16h8v12h-8zm0 18h10v8H34zm14-8h8v16h-8zm12 6h18v8H60zM4 36h18v8H4zm22-4h6v18h-6zM4 48h10v6H4zm14-2h16v8H18zm20 0h8v16h-8zm12-2h12v8H50zm16 2h16v8H66zM32 58h8v24h-8zm12 6h8v12h-8zm12-8h8v8h-8zm12 2h14v8H68zm-12 12h10v12H56zm14 0h12v6H70z" />
        </g>
      </svg>
    </div>
  );
}

export default function LivingGuideTokensPage() {
  const initialOverride = new URLSearchParams(window.location.search).get("theme");
  const [themeOverride, setThemeOverride] = useState<LivingTheme | undefined>(
    isLivingTheme(initialOverride) ? initialOverride : undefined,
  );
  const [copied, setCopied] = useState(false);
  const livingGuideRef = useRef<HTMLElement>(null);
  const [liveTokenValues, setLiveTokenValues] = useState<
    Record<LiveTokenName, string>
  >(() =>
    Object.fromEntries(
      LIVE_TOKEN_NAMES.map((name) => [name, ""]),
    ) as Record<LiveTokenName, string>,
  );
  const theme = useLivingTheme(themeOverride);

  useEffect(() => {
    const previous = document.body.getAttribute("data-t");
    document.body.setAttribute("data-t", theme);
    return () => {
      if (previous === null) document.body.removeAttribute("data-t");
      else document.body.setAttribute("data-t", previous);
    };
  }, [theme]);

  useEffect(() => installTapFeedback(), []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (!livingGuideRef.current) return;
      const computed = window.getComputedStyle(livingGuideRef.current);
      setLiveTokenValues(
        Object.fromEntries(
          LIVE_TOKEN_NAMES.map((name) => [
            name,
            computed.getPropertyValue(name).trim(),
          ]),
        ) as Record<LiveTokenName, string>,
      );
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [theme]);

  const selectTheme = (nextTheme: LivingTheme) => {
    setThemeOverride(nextTheme);
    const url = new URL(window.location.href);
    url.searchParams.set("theme", nextTheme);
    window.history.replaceState(null, "", url);
  };

  const copyWifi = async () => {
    await navigator.clipboard.writeText("Smart360 Živi vodnik");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const imageBase = `${import.meta.env.BASE_URL}images`;

  return (
    <>
      <style>{`@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:swap;src:url(${livingGuideInterWoff2}) format('woff2')}`}</style>
      <main data-living-guide ref={livingGuideRef}>
        <LivingGuideSprite />
        <Stars />
        <div className="lg-page">
          <header className="lg-demo-header">
            <div>
              <span className="lg-kicker">Smart360 · Part 1</span>
              <h1>Živi vodnik</h1>
              <p className="lg-lead">
                Zavezujoči tokeni, tipografija in osnovni recepti. Izbrana tema sledi
                lokalni uri gosta; spodnji preklop je samo razvojni pripomoček.
              </p>
            </div>
            <span className="lg-clock">
              {THEME_LABELS[theme]} · {new Date().toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </header>

          <div className="lg-theme-switch" role="group" aria-label="Razvojni preklop teme">
            {LIVING_THEMES.map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={theme === item}
                onClick={() => selectTheme(item)}
              >
                {THEME_LABELS[item]}
              </button>
            ))}
          </div>

          <div className="lg-layout">
            <div>
              <section className="lg-section">
                <h2 className="lg-section-title">Kartice nastanitve</h2>
                <div className="lg-card-grid">
                  <button type="button" className="lg-cardp lg-cardp--wide">
                    <img src={`${imageBase}/IMG_6196_0.jpg`} alt="Bazen ob nastanitvi" />
                    <div className="lg-card-caption">
                      <b>Bazen</b>
                      <small><span className="lg-live" /><em>odprto do 21:00</em></small>
                    </div>
                  </button>
                  <button type="button" className="lg-ut">
                    <span className="lg-icon-box"><Icon name="wifi" /></span>
                    <div><b>WiFi</b><small>povezava s QR</small></div>
                  </button>
                  <button type="button" className="lg-ut">
                    <span className="lg-icon-box"><Icon name="clk" /></span>
                    <div><b>Prijava in odjava</b><small>14:00 / 10:00</small></div>
                  </button>
                </div>
              </section>

              <section className="lg-section">
                <h2 className="lg-section-title">Vsebinski recepti</h2>
                <div className="lg-chips">
                  <span className="lg-chip lg-chip--open">odprto do 21:00</span>
                  <span className="lg-chip">120 m</span>
                  <span className="lg-chip">€€</span>
                </div>
                <div className="lg-step">
                  <span className="lg-step-number">1</span>
                  <span>Preverite, da je stikalo vključeno.</span>
                </div>
                <div className="lg-rule">
                  <span className="lg-rule-icon"><Icon name="doc" /></span>
                  <span>Po 22. uri spoštujte nočni mir.</span>
                </div>
                <div className="lg-rule lg-rule--warning">
                  <span className="lg-rule-icon"><Icon name="sos" /></span>
                  <span>V sili pokličite 112.</span>
                </div>
              </section>
            </div>

            <div>
              <section className="lg-sheet">
                <div className="lg-grab" />
                <h2>Bazen</h2>
                <div className="lg-facts">
                  <div className="lg-on"><b>21:00</b><small>odprto do</small></div>
                  <div><b>26 °C</b><small>voda</small></div>
                  <div><b>1,4 m</b><small>globina</small></div>
                </div>
                <div className="lg-seg">
                  <button type="button" aria-pressed="true">Prijava</button>
                  <button type="button" aria-pressed="false">Odjava</button>
                </div>
                <DemoQr />
                <div className="lg-wifi-row">
                  <div><small>Omrežje</small><b>Smart360 Guest</b></div>
                  <button type="button" className="lg-wifi-copy" onClick={copyWifi}>
                    {copied ? "Kopirano" : "Kopiraj"}
                  </button>
                </div>
                <div className="lg-sub2">
                  <span className="lg-sub-icon"><Icon name="phone" /></span>
                  <div><b>Recepcija</b><small>+386 40 000 000</small></div>
                  <span className="lg-chevron">›</span>
                </div>
                <div className="lg-notice-row">
                  <img className="lg-notice-thumb" src={`${imageBase}/IMG_6203_0.jpg`} alt="" />
                  <div><b>Bazen je danes odprt dlje</b><small>danes · 08:15</small></div>
                  <span className="lg-new">novo</span>
                </div>
                <button type="button" className="lg-btn">Primarni gumb</button>
              </section>
            </div>
          </div>

          <ThemeSamples />
          <LiveTokenTable theme={theme} values={liveTokenValues} />
        </div>
      </main>
    </>
  );
}
