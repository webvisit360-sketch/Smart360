import { useMemo, useState, type MouseEvent } from "react";
import { CARD_IMAGE_WIDTH, HERO_IMAGE_WIDTH, mediaImgSrc } from "../guest/img";
import { sanitizeHtml } from "@/lib/sanitize";
import { itemPriceText, normalizeGuestMedia } from "./living-guide-formatters";
import {
  DAY_CODES,
  addDays,
  buildWeek,
  dayShort2,
  dayShort3,
  formatTimeRange,
  mondayOf,
  nextOccurrence,
  occurrencesOn,
  programEventOf,
  programItems,
  programLabel,
  programToday,
  programUiState,
  recurrenceHint,
  restrictiveAgeHint,
  weekRangeLabel,
  type ProgramEvent,
  type ProgramFilter,
} from "./living-guide-program-model";
import "./living-guide-program.css";

const stop = (event: MouseEvent) => event.stopPropagation();

/** Synthetic-fixture-only gradient tint (1–4); production items never carry it. */
function fixtureTint(item: any): number | null {
  const tint = Number(item?.__fixtureTint);
  return tint >= 1 && tint <= 4 ? tint : null;
}

function Badge({ event, lang, style }: { event: ProgramEvent; lang: string; style?: any }) {
  if (event.inCamp === undefined) return null;
  return (
    <span className={`lgp-badge ${event.inCamp ? "lgp-b-in" : "lgp-b-out"}`} style={style} data-testid="program-badge">
      {programLabel(lang, event.inCamp ? "in" : "out")}
    </span>
  );
}

function bodyText(body: unknown): string {
  if (typeof body !== "string" || !body.trim()) return "";
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) return parsed.filter((p) => typeof p === "string").map((p) => `<p>${sanitizeHtml(p)}</p>`).join("");
  } catch {}
  return sanitizeHtml(body);
}

export function ProgramView({ category, tenant, lang, onOpenItem, onBack }: any) {
  const rows = useMemo(() => programItems(category), [category]);
  const today = programToday();
  const [selected, setSelected] = useState<string>(() => programUiState.selectedDate ?? today);
  const [filter, setFilterState] = useState<ProgramFilter>(() => programUiState.filter);
  const select = (key: string) => { programUiState.selectedDate = key; setSelected(key); };
  const setFilter = (next: ProgramFilter) => { programUiState.filter = next; setFilterState(next); };
  const week = useMemo(() => buildWeek(rows, selected, filter), [rows, selected, filter]);
  const list = useMemo(() => occurrencesOn(rows, selected, filter), [rows, selected, filter]);
  const shiftWeek = (delta: number) => {
    const monday = addDays(mondayOf(selected), delta * 7);
    // Landing on the current week selects today, otherwise the week's Monday.
    select(mondayOf(today) === monday ? today : monday);
  };

  return (
    <div className="lg2-screen-scroll lgp-root" data-lg-scroll onClick={stop} data-testid="program-view">
      <div className="lg2-detail-hero lgp-anchor" aria-hidden="true" />
      <div className="lgp-phone">
        <div className="lgp-toprow">
          <div className="lgp-small">{tenant?.name}</div>
        </div>
        <h1 className="lgp-h1" data-lg-detail-title>{programLabel(lang, "title")}</h1>

        <div className="lgp-weeknav">
          <button type="button" className="lgp-ar" onClick={() => shiftWeek(-1)} aria-label={programLabel(lang, "prevWeek")} data-testid="program-prev-week">&#9664;</button>
          <div className="lgp-rng" data-testid="program-week-range">{weekRangeLabel(selected, lang)}</div>
          <button type="button" className="lgp-ar" onClick={() => shiftWeek(1)} aria-label={programLabel(lang, "nextWeek")} data-testid="program-next-week">&#9654;</button>
        </div>

        <div className="lgp-week" role="tablist">
          {week.map((cell) => (
            <button
              type="button"
              role="tab"
              aria-selected={cell.date === selected}
              key={cell.date}
              className={`lgp-day${cell.date === selected ? " lgp-sel" : ""}`}
              onClick={() => select(cell.date)}
              data-testid={`program-day-${cell.date}`}
              data-has-events={cell.hasEvents}
            >
              <div className="lgp-dn">{dayShort2(cell.code, lang)}</div>
              <div className="lgp-dd">{cell.dayOfMonth}</div>
              <div className={cell.hasEvents ? "lgp-dot" : "lgp-nodot"} />
            </button>
          ))}
        </div>

        <div className="lgp-filters">
          {(["all", "in", "out"] as ProgramFilter[]).map((key) => (
            <button type="button" key={key} className={`lgp-f ${filter === key ? "lgp-on" : "lgp-off"}`} onClick={() => setFilter(key)} aria-pressed={filter === key} data-testid={`program-filter-${key}`}>
              {programLabel(lang, key)}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="lgp-empty" data-testid="program-empty">
            <svg aria-hidden="true"><use href="#lg-i-cal" /></svg>
            <p>{programLabel(lang, filter === "all" ? "empty" : "emptyFilter")}</p>
          </div>
        ) : (
          list.map(({ item, event, date }) => {
            const media = normalizeGuestMedia(item.media)[0];
            const src = media ? mediaImgSrc(media, CARD_IMAGE_WIDTH) : null;
            const tint = fixtureTint(item);
            const hint = recurrenceHint(event, lang);
            return (
              <button type="button" className="lgp-ev" key={`${item.id}-${date}`} onClick={() => { programUiState.selectedDate = date; onOpenItem(item.id); }} data-testid={`program-card-${item.id}`}>
                <div className={`lgp-th${tint ? ` lgp-t${tint}` : ""}`}>
                  {src && <img src={src} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                </div>
                <div className="lgp-mid">
                  <div className="lgp-time">{formatTimeRange(event, lang)}</div>
                  <div className="lgp-name">{item.title}</div>
                  <Badge event={event} lang={lang} />
                  {hint && <span className="lgp-rep">&#8635; {hint}</span>}
                  {restrictiveAgeHint(event.ageText) && <span className="lgp-rep">{event.ageText}</span>}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function ProgramDetail({ item, lang, t, onBack, onSignup }: any) {
  const event = programEventOf(item)!;
  const date = programUiState.selectedDate && (event.type === "weekly" || event.date === programUiState.selectedDate)
    ? programUiState.selectedDate
    : nextOccurrence(event, programToday());
  const media = normalizeGuestMedia(item.media)[0];
  const src = media ? mediaImgSrc(media, HERO_IMAGE_WIDTH) : null;
  const tint = fixtureTint(item);
  const price = itemPriceText(item, t);
  const html = bodyText(item.body);
  const where = event.locationText;

  return (
    <div className="lg2-screen-scroll lgp-root" data-lg-scroll onClick={stop} data-testid="program-detail">
      <div className="lg2-detail-hero lgp-anchor" aria-hidden="true" />
      <div className="lgp-phone">
        <div className={`lgp-hero${tint ? " lgp-hero-fixture" : ""}`}>
          {src && <img src={src} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
          <div className="lgp-sh" />
          <button type="button" className="lgp-hback" onClick={onBack} aria-label={programLabel(lang, "back")} data-testid="program-detail-back">
            <svg aria-hidden="true"><use href="#lg-i-bk" /></svg>
          </button>
          <h1 className="lgp-ht" data-lg-detail-title>{item.title}</h1>
        </div>

        <div className="lgp-rowb">
          <div className="lgp-timecard"><span>{programLabel(lang, "time")}</span>{formatTimeRange(event, lang)}</div>
          {where && <div className="lgp-timecard" style={{ flex: 1 }}><span>{programLabel(lang, "where")}</span>{where}</div>}
          <Badge event={event} lang={lang} style={{ alignSelf: "flex-start", marginTop: 4 }} />
        </div>

        <div className="lgp-days" data-testid="program-day-pills">
          {DAY_CODES.map((code) => (
            <div key={code} className={`lgp-dpill ${event.days.includes(code) ? "lgp-dp-on" : "lgp-dp-off"}`} data-on={event.days.includes(code)}>
              {dayShort3(code, lang)}
            </div>
          ))}
        </div>

        {html && <div className="lgp-desc" dangerouslySetInnerHTML={{ __html: html }} />}

        {(where || event.ageText || price) && (
          <div className="lgp-meta" data-testid="program-meta">
            {where && <div className="lgp-mrow"><div className="lgp-mk">{programLabel(lang, "location")}</div><div className="lgp-mv">{where}</div></div>}
            {event.ageText && <div className="lgp-mrow"><div className="lgp-mk">{programLabel(lang, "age")}</div><div className="lgp-mv">{event.ageText}</div></div>}
            {price && <div className="lgp-mrow"><div className="lgp-mk">{programLabel(lang, "price")}</div><div className="lgp-mv">{price}</div></div>}
          </div>
        )}

        {item.orderEnabled && (
          <button type="button" className="lgp-cta" onClick={() => onSignup(item, event, date)} data-testid="program-signup">
            {programLabel(lang, "signup")}
          </button>
        )}
      </div>
    </div>
  );
}
