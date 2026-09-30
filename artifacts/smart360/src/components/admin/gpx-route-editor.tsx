import { useEffect, useRef, useState } from "react";
import { deleteItemGpx, uploadItemGpx } from "@workspace/api-client-react";
import { Loader2, Route as RouteIcon, Trash2, Upload } from "lucide-react";
import { GPX_MAX_BYTES, type GpxActivity, type GpxRoute } from "@/lib/gpx-route";

type Props = {
  /** null while the item is not yet persisted. */
  itemId: string | null;
  initialRoute?: GpxRoute | null;
  /** e.g. host form: flush autosave before writing. */
  onBeforeWrite?: () => Promise<unknown> | void;
  /** e.g. host form: serialize with the autosave queue. */
  serializeWrite?: <T>(write: () => Promise<T>) => Promise<T>;
  /** Refresh data after a persisted change. */
  onAfterWrite?: (route: GpxRoute | null) => Promise<unknown> | void;
  disabled?: boolean;
};

const ACTIVITY_LABEL: Record<GpxActivity, string> = { cycling: "Kolesarjenje", hiking: "Pohodništvo", running: "Tek" };

function fmt(value: number | null | undefined, unit: string, digits = 0) {
  return value == null || !Number.isFinite(value) ? "ni podatka" : `${value.toFixed(digits).replace(".", ",")} ${unit}`;
}

function errorText(error: unknown): string {
  const e = error as { status?: number; data?: unknown; message?: string };
  const data = e?.data as { error?: unknown; message?: unknown } | null | undefined;
  const server = typeof data?.error === "string" ? data.error : typeof data?.message === "string" ? data.message : "";
  if (e?.status === 413) return "Datoteka je prevelika (največ 5 MiB).";
  if (e?.status === 401 || e?.status === 403) return "Za to dejanje nimate dovoljenja.";
  if (e?.status === 404) return "Vnosa ni bilo mogoče najti. Osvežite stran.";
  if (e?.status === 400 || e?.status === 422) return server || "Datoteka ni veljavna GPX sled.";
  if (server) return server;
  return "Shranjevanje GPX ni uspelo. Preverite povezavo in poskusite znova.";
}

export function GpxRouteEditor({ itemId, initialRoute = null, onBeforeWrite, serializeWrite, onAfterWrite, disabled }: Props) {
  const [route, setRoute] = useState<GpxRoute | null>(initialRoute);
  const [activity, setActivity] = useState<GpxActivity | "">(initialRoute?.activity ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"upload" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const localWrite = useRef(false);

  // Adopt server data on refresh, but never overwrite a route we just wrote
  // with a stale snapshot from a concurrent autosave response.
  const serverKey = initialRoute?.fileId ?? "none";
  useEffect(() => {
    if (localWrite.current) return;
    setRoute(initialRoute);
    if (initialRoute) setActivity(initialRoute.activity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const run = async <T,>(write: () => Promise<T>) => {
    if (onBeforeWrite) await onBeforeWrite();
    return serializeWrite ? serializeWrite(write) : write();
  };

  const handleUpload = async () => {
    setError(""); setSuccess("");
    if (!itemId) { setError("Najprej shranite vnos, nato dodajte GPX."); return; }
    if (!activity) { setError("Izberite dejavnost: kolesarjenje, pohodništvo ali tek."); return; }
    if (!file) { setError("Izberite datoteko .gpx."); return; }
    if (file.size > GPX_MAX_BYTES) { setError("Datoteka je prevelika (največ 5 MiB)."); return; }
    if (!/\.gpx$/i.test(file.name)) { setError("Dovoljene so samo datoteke .gpx."); return; }
    setBusy("upload");
    localWrite.current = true;
    try {
      const next = await run(() => uploadItemGpx(itemId, { file, activity }));
      setRoute(next);
      setActivity(next.activity);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setSuccess(route ? "GPX sled je zamenjana in shranjena." : "GPX sled je shranjena.");
      await onAfterWrite?.(next);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
      localWrite.current = false;
    }
  };

  const handleDelete = async () => {
    if (!itemId || !route) return;
    if (!confirm("Odstranim GPX sled s tega vnosa?")) return;
    setError(""); setSuccess("");
    setBusy("delete");
    localWrite.current = true;
    try {
      await run(() => deleteItemGpx(itemId));
      setRoute(null);
      setSuccess("GPX sled je odstranjena.");
      await onAfterWrite?.(null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
      localWrite.current = false;
    }
  };

  const locked = disabled || busy !== null;

  return (
    <div className="space-y-3 rounded-[10px] border border-[#E8EBE6] bg-white p-3" data-testid="gpx-route-editor">
      <div className="flex items-center gap-2 text-[13px] font-[700] uppercase text-[#66716A]">
        <RouteIcon className="h-4 w-4 text-[#157347]" aria-hidden="true" /> GPX sled
      </div>

      {route ? (
        <div className="rounded-lg bg-[#F4F6F2] p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="min-w-0 break-all">{route.filename}</b>
            <span className="rounded-full bg-[#157347]/10 px-2 py-0.5 text-xs font-semibold text-[#157347]">{ACTIVITY_LABEL[route.activity]}</span>
          </div>
          <p className="mt-1 text-xs text-[#66716A]">
            {fmt(route.distanceKm, "km", 1)} · vzpon {fmt(route.ascentM, "m")} · spust {fmt(route.descentM, "m")} · ocena časa {route.durationMinutes == null ? "ni podatka" : `${Math.round(route.durationMinutes)} min`}
          </p>
          <p className="mt-1 text-xs text-[#66716A]">Sled je shranjena v osnutku; gostje jo vidijo po objavi.</p>
        </div>
      ) : (
        <p className="text-xs text-[#66716A]">Dodajte GPX sled (največ 5 MiB). Gost bo videl zemljevid, višinski profil in prenos izvirne datoteke.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]">
        <label className="space-y-1 text-xs font-semibold text-[#66716A]">
          Dejavnost *
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value as GpxActivity | "")}
            disabled={locked}
            data-testid="select-gpx-activity"
            className="block w-full rounded-[10px] border border-[#E8EBE6] bg-white px-3 py-2 text-sm text-[#121A14] outline-none focus:border-[#157347]"
          >
            <option value="">Izberite …</option>
            <option value="cycling">Kolesarjenje</option>
            <option value="hiking">Pohodništvo</option>
            <option value="running">Tek</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-[#66716A]">
          {route ? "Nova datoteka (zamenjava)" : "Datoteka .gpx *"}
          <input
            ref={inputRef}
            type="file"
            accept=".gpx,application/gpx+xml"
            disabled={locked || !itemId}
            data-testid="input-gpx-file"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(""); setSuccess(""); }}
            className="block w-full rounded-[10px] border border-[#E8EBE6] bg-white px-2 py-1.5 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-[#157347]/10 file:px-2 file:py-1 file:font-semibold file:text-[#157347]"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={locked || !itemId}
          data-testid="button-gpx-upload"
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#157347] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {route ? "Zamenjaj GPX" : "Naloži GPX"}
        </button>
        {route && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={locked}
            data-testid="button-gpx-delete"
            className="inline-flex items-center gap-2 rounded-[10px] border border-[#E8EBE6] px-3 py-2 text-sm font-bold text-destructive disabled:opacity-50"
          >
            {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Odstrani
          </button>
        )}
      </div>

      {!itemId && <p className="text-xs text-[#66716A]">GPX lahko dodate, ko je vnos shranjen.</p>}
      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
      {success && <p role="status" className="text-sm font-semibold text-[#157347]">{success}</p>}
    </div>
  );
}
