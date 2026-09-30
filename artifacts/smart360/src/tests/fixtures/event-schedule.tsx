/**
 * DEV-ONLY isolated browser fixture. This mounts the production editor and
 * its validation/serialization helpers; no admin API, database or auth.
 * Not included in the production Vite build.
 */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../index.css";
import {
  EventScheduleEditor,
  scheduleDraft,
  scheduleFromDraft,
  validateSchedule,
  type EventSchedule,
  type ScheduleDraft,
} from "../../components/admin/event-schedule-editor";

type Scenario = "new-once" | "new-weekly" | "legacy" | "existing";
const legacyStart = "2026-06-14T22:05:00Z";
const existingSchedule: EventSchedule = {
  type: "weekly",
  days: ["thu", "fri", "sat", "sun"],
  timeFrom: "09:00",
  timeTo: "10:00",
  validFrom: "2026-06-01",
  validTo: "2026-09-30",
  locationText: "Healthy Corner",
  ageText: "18+",
  inCamp: true,
};

function initialDraft(scenario: Scenario): ScheduleDraft {
  if (scenario === "existing") return scheduleDraft(existingSchedule);
  if (scenario === "legacy") return scheduleDraft(null, legacyStart);
  const draft = scheduleDraft();
  return scenario === "new-weekly" ? { ...draft, type: "weekly" } : draft;
}

function Fixture() {
  const [scenario, setScenario] = useState<Scenario>("new-once");
  const [draft, setDraft] = useState<ScheduleDraft>(() => initialDraft("new-once"));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<{ eventSchedule: EventSchedule } | null>(null);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initialDraft(scenario));

  const changeScenario = (next: Scenario) => {
    setScenario(next);
    setDraft(initialDraft(next));
    setError("");
    setSaved(null);
  };
  const save = () => {
    const message = validateSchedule(draft);
    setError(message ?? "");
    if (message) return;
    // This is the real item mutation's schedule field; no eventStart write.
    // Keep the result in React memory only, never call the API.
    setSaved({ eventSchedule: scheduleFromDraft(draft) });
  };

  return (
    <main className="mx-auto max-w-[600px] space-y-5 px-4 py-8 text-[#17241C]">
      <div className="rounded-xl border-2 border-[#DD9A2B] bg-[#FFF3D8] p-4">
        <strong className="text-lg">FIXTURE · razvojni preizkus</strong>
        <p className="mt-1 text-sm">Izoliran urejevalnik Termin. Podatki so zgolj primeri; Shrani preveri in prikaže telo zahtevka samo v pomnilniku brskalnika. Brez prijave, omrežja ali zapisov v bazo.</p>
      </div>
      <div className="space-y-1">
        <label htmlFor="fixture-scenario" className="text-sm font-semibold">Scenarij</label>
        <select id="fixture-scenario" data-testid="fixture-scenario" value={scenario}
          onChange={(event) => changeScenario(event.target.value as Scenario)}
          className="flex h-10 w-full rounded-md border border-[#D7DAD3] bg-white px-3">
          <option value="new-once">Nov enkratni dogodek</option>
          <option value="new-weekly">Nov tedenski dogodek</option>
          <option value="legacy">Obstoječi eventStart (brez konca)</option>
          <option value="existing">Obstoječi tedenski termin</option>
        </select>
      </div>
      {scenario === "legacy" && (
        <p data-testid="fixture-legacy" className="rounded-xl bg-[#F4F6F2] p-3 text-sm">
          Izvirni eventStart: <code>{legacyStart}</code> · v urejevalniku je predizpolnjen lokalni datum in začetek; konec ni izmišljen.
        </p>
      )}
      <EventScheduleEditor draft={draft} onChange={setDraft} error={error} />
      <div className="flex items-center gap-3">
        <button type="button" data-testid="fixture-save" onClick={save}
          className="rounded-full bg-[#157347] px-5 py-2.5 font-bold text-white">Shrani (samo predogled)</button>
        <span data-testid="fixture-dirty" className="text-sm">{isDirty ? "Spremenjen osnutek" : "Nespremenjen osnutek"}</span>
      </div>
      <section aria-label="Predogled shranjevanja" className="rounded-xl border border-[#D7DAD3] bg-white p-4">
        <h2 className="font-semibold">Predogled zahtevka · samo pomnilnik</h2>
        <pre data-testid="fixture-payload" className="mt-2 overflow-auto whitespace-pre-wrap break-words text-sm">
          {saved ? JSON.stringify(saved, null, 2) : "Ni shranjeno — odpiranje ne pretvori podatkov."}
        </pre>
        {saved && scenario === "legacy" && <p className="mt-2 text-sm">Izvirni eventStart ostane nespremenjen: {legacyStart}</p>}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);