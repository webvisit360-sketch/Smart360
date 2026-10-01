import { useEffect, useRef, useState } from "react";
import "./living-guide-announcements.css";
import { CARD_IMAGE_WIDTH, HERO_IMAGE_WIDTH, imgSrc } from "../guest/img";
import {
  announcementCopy,
  formatFullDate,
  formatListDate,
  localizedField,
  snippet,
  type GuestAnnouncement,
} from "./living-guide-announcements-model";
import type { GuestAnnouncementsState } from "./use-guest-announcements";

function useEscape(onEscape: () => void) {
  const ref = useRef(onEscape);
  ref.current = onEscape;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      ref.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}

export function AnnouncementCard({ row, lang, now, isNew, onOpen }: { row: GuestAnnouncement; lang: string; now: number; isNew: boolean; onOpen: () => void }) {
  const c = announcementCopy(lang);
  const title = localizedField(row, "title", lang);
  const body = localizedField(row, "body", lang);
  const [imageOk, setImageOk] = useState(true);
  const showImage = !!row.imageUrl && imageOk;
  return (
    <button type="button" className="lg2-ann-card" onClick={onOpen} data-testid={`card-announcement-${row.id}`}>
      {showImage
        ? <img className="lg2-ann-thumb" src={imgSrc(row.imageUrl, CARD_IMAGE_WIDTH)} alt="" loading="lazy" onError={() => setImageOk(false)} />
        : <span className="lg2-ann-noimg" aria-hidden="true" />}
      <span className="lg2-ann-mid">
        <span className="lg2-ann-date">{formatListDate(row.validFrom || row.createdAt, lang, now)}</span>
        <span className="lg2-ann-name">{title}{isNew && <span className="lg2-ann-badge" data-testid="badge-announcement-new">{c.isNew}</span>}</span>
        {body && <span className="lg2-ann-snip">{snippet(body)}</span>}
      </span>
    </button>
  );
}

export function AnnouncementDetail({ row, lang, onBack }: { row: GuestAnnouncement; lang: string; onBack: () => void }) {
  const c = announcementCopy(lang);
  const title = localizedField(row, "title", lang);
  const body = localizedField(row, "body", lang);
  const [imageOk, setImageOk] = useState(true);
  const hasImage = !!row.imageUrl && imageOk;
  return (
    <article className="lg2-ann-detail" data-testid="announcement-detail" data-has-image={hasImage ? "true" : "false"}>
      {hasImage ? (
        <div className="lg2-ann-hero">
          <img src={imgSrc(row.imageUrl, HERO_IMAGE_WIDTH)} alt="" onError={() => setImageOk(false)} />
          <div className="lg2-ann-hero-sh" aria-hidden="true" />
          <button type="button" className="lg2-ann-hero-back" onClick={onBack} aria-label={c.back} data-testid="button-announcement-back">
            <svg aria-hidden="true"><use href="#lg-i-bk" /></svg>
          </button>
          <h1 className="lg2-ann-hero-title">{title}</h1>
        </div>
      ) : (
        <header className="lg2-ann-plainhead">
          <button type="button" className="lg2-ann-back" onClick={onBack} aria-label={c.back} data-testid="button-announcement-back">
            <svg aria-hidden="true"><use href="#lg-i-bk" /></svg>
          </button>
          <h1 className="lg2-ann-h1">{title}</h1>
        </header>
      )}
      <div className="lg2-ann-detail-body">
        <p className="lg2-ann-meta">{c.published} {formatFullDate(row.validFrom || row.createdAt, lang)}</p>
        {body && <div className="lg2-ann-text">{body}</div>}
        {row.validTo && (
          <div className="lg2-ann-valid" data-testid="announcement-valid-to">
            <svg aria-hidden="true"><use href="#lg-i-clk" /></svg>
            <span>{c.validTo}: {formatFullDate(row.validTo, lang)}</span>
          </div>
        )}
      </div>
    </article>
  );
}

export function LivingGuideAnnouncements({ state, lang, tenantName, onClose }: {
  state: GuestAnnouncementsState; lang: string; tenantName: string; onClose: () => void;
}) {
  const c = announcementCopy(lang);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? state.active.find((r) => r.id === openId) ?? null : null;
  const layerRef = useRef<HTMLDivElement | null>(null);
  useEscape(() => (open ? setOpenId(null) : onClose()));
  useEffect(() => { layerRef.current?.scrollTo?.({ top: 0 }); }, [openId]);
  // Detail of an announcement that just expired falls back to the list automatically.
  useEffect(() => { if (openId && !open) setOpenId(null); }, [openId, open]);

  // Opening the list always triggers a fresh request.
  const refreshRef = useRef(state.refetch);
  refreshRef.current = state.refetch;
  useEffect(() => { void refreshRef.current(); }, []);

  const openRow = (id: string) => { state.markRead(id); setOpenId(id); };

  return (
    <div className="lg2-ann-layer" role="dialog" aria-modal="true" aria-label={c.title} ref={layerRef} data-testid="announcements-layer">
      {open ? <AnnouncementDetail row={open} lang={lang} onBack={() => setOpenId(null)} /> : (
        <div className="lg2-ann-list">
          <div className="lg2-ann-top">
            <button type="button" className="lg2-ann-back" onClick={onClose} aria-label={c.close} data-testid="button-announcements-close">
              <svg aria-hidden="true"><use href="#lg-i-bk" /></svg>
            </button>
          </div>
          <p className="lg2-ann-kicker">{tenantName}</p>
          <h1 className="lg2-ann-h1">{c.title}</h1>
          {state.isLoading && (
            <div aria-busy="true" data-testid="announcements-loading">
              {[0, 1, 2].map((i) => <div key={i} className="lg2-ann-card lg2-ann-skel" />)}
            </div>
          )}
          {state.offline && (
            <div className="lg2-ann-notice" role="status" data-testid="announcements-offline">
              <p>{c.offline}</p>
              <button type="button" onClick={() => void state.refetch()}>{c.retry}</button>
            </div>
          )}
          {state.failed && (
            <div className="lg2-ann-notice" role="alert" data-testid="announcements-error">
              <p>{c.error}</p>
              <button type="button" onClick={() => void state.refetch()}>{c.retry}</button>
            </div>
          )}
          {!state.isLoading && !state.offline && !state.failed && state.active.length === 0 && (
            <div className="lg2-ann-empty" data-testid="announcements-empty">
              <svg aria-hidden="true"><use href="#lg-i-bell" /></svg>
              <strong>{c.empty}</strong>
              <p>{c.emptyNote}</p>
            </div>
          )}
          {state.active.map((row) => (
            <AnnouncementCard key={row.id} row={row} lang={lang} now={state.now} isNew={!state.readIds.has(row.id)} onOpen={() => openRow(row.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
