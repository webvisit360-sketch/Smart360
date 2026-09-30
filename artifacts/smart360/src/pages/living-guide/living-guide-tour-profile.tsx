import React, { useEffect, useState } from "react";
import type { UiTranslator } from "../guest/i18n";
import type { TourActivity } from "../../lib/live-tour";
import { loadTourProfile, saveTourProfile, type TourProfile, validProfile } from "../../lib/tour-calories";

const SEEN_KEY = "smart360:tour-profile-intro:v1";
const seen = () => { try { return window.localStorage.getItem(SEEN_KEY) === "yes"; } catch { return false; } };
const remember = () => { try { window.localStorage.setItem(SEEN_KEY, "yes"); return true; } catch { return false; } };

export function useTourProfile() {
  const [profile, setProfile] = useState<TourProfile>(loadTourProfile);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<((profile: TourProfile) => void) | null>(null);
  const [storageError, setStorageError] = useState(false);
  const start = (callback: (profile: TourProfile) => void) => {
    if (seen()) callback(profile);
    else { setPending(() => callback); setOpen(true); }
  };
  const complete = (draft: TourProfile | null) => {
    // Do not start until state has the new profile snapshot: caller receives it directly.
    if (draft) { const clean = validProfile(draft); setProfile(clean); setStorageError(!saveTourProfile(clean) || !remember()); }
    else setStorageError(!remember());
    setOpen(false);
    const next = pending;
    setPending(null);
    if (next) next(draft ? validProfile(draft) : profile);
  };
  return { profile, open, setOpen, complete, start, pending: !!pending, storageError };
}

export function TourProfileControl({ t, activity, tourActive, controller }: {
  t: UiTranslator; activity: TourActivity; tourActive: boolean; controller: ReturnType<typeof useTourProfile>;
}) {
  const [draft, setDraft] = useState<TourProfile>({});
  useEffect(() => { if (controller.open) setDraft(controller.profile); }, [controller.open]);
  const update = (value: Partial<TourProfile>) => setDraft(previous => ({ ...previous, ...value }));
  const show = () => { setDraft(controller.profile); controller.setOpen(true); };
  const close = () => { if (controller.pending) controller.complete(null); else controller.setOpen(false); };
  const label = (key: string) => t(`UI.lg.calories.${key}`);
  return (
    <div className="s360-profile" data-testid="tour-profile-control">
      <button type="button" className="s360-tour-link" onClick={show} data-testid="button-tour-profile">{label("profile")}</button>
      {controller.storageError && <p role="alert" className="s360-tour-error">{label("storage")}</p>}
      {controller.open && <div className="s360-profile-dialog" role="dialog" aria-modal="true" aria-label={label("profile")} data-testid="dialog-tour-profile">
        <h3>{label("profile")}</h3>
        <p className="s360-tour-fine">{label("privacy")}</p>
        {tourActive && <p className="s360-tour-fine">{label("nextTour")}</p>}
        <label>{label("age")} <input type="number" min="1" max="110" inputMode="numeric" value={draft.age ?? ""} onChange={e => update({ age: e.target.value ? Number(e.target.value) : undefined })} data-testid="input-tour-age" /></label>
        <label>{label("sex")} <select value={draft.sex ?? ""} onChange={e => update({ sex: e.target.value as TourProfile["sex"] || undefined })} data-testid="select-tour-sex">
          <option value="">{label("optional")}</option><option value="female">{label("female")}</option><option value="male">{label("male")}</option>
        </select></label>
        <label>{label("weight")} <input type="number" min="20" max="350" step="0.1" inputMode="decimal" value={draft.weightKg ?? ""} onChange={e => update({ weightKg: e.target.value ? Number(e.target.value) : undefined })} data-testid="input-tour-weight" /></label>
        {activity === "cycling" && <>
          <label>{label("bike")} <select value={draft.bike ?? ""} onChange={e => update({ bike: e.target.value as TourProfile["bike"] || undefined })} data-testid="select-tour-bike">
            <option value="">{label("optional")}</option>{(["road", "mtb", "trekking-city", "electric"] as const).map(b => <option key={b} value={b}>{label(b)}</option>)}
          </select></label>
          {draft.bike === "electric" && <label>{label("assist")} <select value={draft.assist ?? ""} onChange={e => update({ assist: e.target.value as TourProfile["assist"] || undefined })} data-testid="select-tour-assist">
            <option value="">{label("optional")}</option>{(["low", "medium", "high"] as const).map(a => <option key={a} value={a}>{label(a)}</option>)}
          </select></label>}
        </>}
        <div className="s360-tour-row">
          <button type="button" className="s360-tour-btn s360-tour-btn--primary" onClick={() => controller.complete(draft)} data-testid="button-tour-profile-save">{label("save")}</button>
          <button type="button" className="s360-tour-btn" onClick={close} data-testid="button-tour-profile-skip">{controller.pending ? label("skip") : label("cancel")}</button>
        </div>
      </div>}
    </div>
  );
}