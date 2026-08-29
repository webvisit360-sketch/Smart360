import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetTenantQueryKey, useGetStorageUsage, getGetStorageUsageQueryKey } from "@workspace/api-client-react";
import { fmtMediaUsage, usagePct } from "@/lib/format-bytes";
import { Loader2, Plus, Play, RotateCcw, X } from "lucide-react";
import { AdminButton as Button } from "@/components/ui/button";

type Media = {
  id: string;
  url: string;
  alt?: string | null;
  position: number;
  kind?: string;
  posterUrl?: string | null;
  durationSec?: number | null;
  /** Žariščna točka izreza v odstotkih (izrez-wifi-eposta.md §1a). */
  focusX?: number | null;
  focusY?: number | null;
};

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const MAX_BYTES = 100 * 1024 * 1024;

type QueueEntry = {
  key: string;
  file: File;
  pct: number;
  status: "pending" | "uploading" | "error";
  error?: string;
  /** Client-side validation failure (too big / wrong type) — never retried. */
  permanent?: boolean;
  /** Object URL for the local thumbnail of a not-yet-uploaded file. */
  previewUrl?: string;
};

/** Imperative API for the deferred (new item) mode. */
export type ItemMediaEditorHandle = {
  /** Files chosen but not uploaded yet (pending or failed). */
  hasPending: () => boolean;
  /**
   * Upload every pending/failed file to the given item, one at a time,
   * in selection order. Resolves true when ALL succeeded.
   */
  uploadAllTo: (itemId: string) => Promise<boolean>;
  /** Drop all queued files (cancel path) and release their object URLs. */
  discardPending: () => void;
};

function fmtDuration(sec: number | null | undefined): string {
  if (!sec || !isFinite(sec)) return "";
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Media strip for one content item: ONE ordered list of photos and videos
 * (spec admin-slicice-in-video.md). Position 0 is the tile in the guest app —
 * for a video, its poster frame. 96 px thumbnails from the 200 px derivative,
 * drag to reorder, multi-upload with per-file progress and retry, drag-and-drop
 * onto the grid.
 */
export const ItemMediaEditor = forwardRef<ItemMediaEditorHandle, {
  /** null = deferred mode (new item): files queue locally until uploadAllTo(). */
  itemId: string | null;
  tenantId: string;
  media: Media[];
  /** Reports how many local files wait for upload (dirty tracking). */
  onPendingChange?: (count: number) => void;
  /** CSS aspect-ratio okvirja vnosa — predogled izreza v pravem razmerju. */
  frameRatio?: string;
}>(function ItemMediaEditor({ itemId, tenantId, media, onPendingChange, frameRatio }, handleRef) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const didDragRef = useRef(false);
  const [order, setOrder] = useState<string[] | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [dropActive, setDropActive] = useState(false);
  /* Žariščna točka: klik na fotografijo odpre urejevalnik izreza namesto
     odpiranja polne velikosti (polna velikost ostane na povezavi pod sličico). */
  const [focusEdit, setFocusEdit] = useState<Media | null>(null);

  // Upload target: the itemId prop, or — in deferred mode — the id passed
  // to uploadAllTo() once the item has been created.
  const targetIdRef = useRef<string | null>(itemId);
  if (itemId) targetIdRef.current = itemId;

  // Live mirror of the queue so async flows can read the current state.
  const queueRef = useRef<QueueEntry[]>(queue);
  queueRef.current = queue;

  // The dialog can close past handleCancel (X, Escape, backdrop) — revoke
  // any remaining local previews on unmount so blob URLs never leak.
  useEffect(() => () => {
    for (const e of queueRef.current) {
      if (e.previewUrl) URL.revokeObjectURL(e.previewUrl);
    }
  }, []);

  const reportPending = (q: QueueEntry[]) =>
    onPendingChange?.(q.filter(e => e.status === "pending" || e.status === "error").length);
  const setQueueReported = (updater: (q: QueueEntry[]) => QueueEntry[]) =>
    setQueue(q => { const next = updater(q); reportPending(next); return next; });

  const sorted = [...media].sort((a, b) => a.position - b.position);
  const shown = order ? order.map(id => sorted.find(m => m.id === id)!).filter(Boolean) : sorted;

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: getGetTenantQueryKey(tenantId) }),
    queryClient.invalidateQueries({ queryKey: getGetStorageUsageQueryKey() }),
  ]);

  // Soft quota (see /admin/storage/usage): warn from 80 %, block the add
  // controls at 100 % — the server refuses the upload anyway, this just
  // saves the host a pointless 100 MB transfer.
  const { data: storageUsage } = useGetStorageUsage();
  const tenantUsage = storageUsage?.tenants.find(t => t.tenantId === tenantId);
  const quotaPct = tenantUsage ? usagePct(tenantUsage.usedBytes, tenantUsage.quotaBytes) : 0;
  const quotaFull = quotaPct >= 100;

  const patchQueue = (key: string, patch: Partial<QueueEntry>) =>
    setQueueReported(q => q.map(e => (e.key === key ? { ...e, ...patch } : e)));

  // Uploads run ONE at a time, in selection order — the server assigns
  // gallery positions at completion time, so parallel uploads would let a
  // small photo overtake a large video and scramble the order.
  const chainRef = useRef<Promise<void>>(Promise.resolve());

  const uploadOneNow = (entry: QueueEntry) =>
    new Promise<boolean>((resolve) => {
      const target = targetIdRef.current;
      if (!target) {
        // Deferred mode without a created item yet — keep the file queued.
        resolve(false);
        return;
      }
      const fd = new FormData();
      fd.append("file", entry.file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/admin/items/${target}/media/upload`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) patchQueue(entry.key, { pct: Math.round((e.loaded / e.total) * 100) });
      };
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
          setQueueReported(q => q.filter(e => e.key !== entry.key));
          await refresh();
          resolve(true);
        } else {
          let msg = "Nalaganje ni uspelo.";
          try { msg = JSON.parse(xhr.responseText).error || msg; } catch { /* keep default */ }
          patchQueue(entry.key, { status: "error", error: msg });
          resolve(false);
        }
      };
      xhr.onerror = () => { patchQueue(entry.key, { status: "error", error: "Povezava je bila prekinjena." }); resolve(false); };
      xhr.send(fd);
    });

  const uploadOne = (entry: QueueEntry) => {
    if (!targetIdRef.current) return; // deferred: wait for uploadAllTo()
    chainRef.current = chainRef.current.then(() => uploadOneNow(entry).then(() => undefined));
  };

  useImperativeHandle(handleRef, () => ({
    hasPending: () =>
      queueRef.current.some(e => e.status === "pending" || e.status === "error"),
    uploadAllTo: async (id: string) => {
      targetIdRef.current = id;
      const entries = queueRef.current.filter(e => e.status === "pending" || (e.status === "error" && !e.permanent));
      let allOk = true;
      for (const entry of entries) {
        patchQueue(entry.key, { status: "uploading", pct: 0, error: undefined });
        const ok = await uploadOneNow(entry);
        if (!ok) allOk = false;
      }
      return allOk;
    },
    discardPending: () => {
      for (const e of queueRef.current) {
        if (e.previewUrl) URL.revokeObjectURL(e.previewUrl);
      }
      setQueueReported(() => []);
    },
  }));

  const enqueue = (files: FileList | File[]) => {
    if (quotaFull && tenantUsage) {
      alert(`Prostor za medije je poln (${fmtMediaUsage(tenantUsage.usedBytes, tenantUsage.quotaBytes)}). Novo nalaganje ni mogoče — povečajte kvoto v nastavitvah namestitve.`);
      return;
    }
    const deferred = !targetIdRef.current;
    for (const file of Array.from(files)) {
      const key = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      // Refuse over the limit BEFORE the upload runs, with a clear message.
      if (file.size > MAX_BYTES) {
        setQueueReported(q => [...q, { key, file, pct: 0, status: "error", permanent: true, error: `Datoteka je prevelika (${Math.round(file.size / 1024 / 1024)} MB). Omejitev je 100 MB.` }]);
        continue;
      }
      const isMedia = file.type.startsWith("image/") || file.type.startsWith("video/") || VIDEO_EXT.test(file.name);
      if (!isMedia) {
        setQueueReported(q => [...q, { key, file, pct: 0, status: "error", permanent: true, error: "Podprte so fotografije in video (mp4, webm, mov)." }]);
        continue;
      }
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      const entry: QueueEntry = { key, file, pct: 0, status: deferred ? "pending" : "uploading", previewUrl };
      setQueueReported(q => [...q, entry]);
      if (!deferred) uploadOne(entry);
    }
  };

  const retry = (entry: QueueEntry) => {
    if (!targetIdRef.current) {
      // Deferred mode: the size/type errors cannot succeed on retry; a failed
      // upload retries through Shrani (uploadAllTo). Nothing to do here.
      return;
    }
    patchQueue(entry.key, { status: "uploading", pct: 0, error: undefined });
    uploadOne(entry);
  };

  const remove = async (id: string) => {
    if (!confirm("Odstranim to fotografijo/video iz galerije? Datoteka bo trajno izbrisana in je ne bo mogoče povrniti.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/media/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok && res.status !== 204) throw new Error();
      await refresh();
    } catch {
      alert("Brisanje ni uspelo.");
    } finally {
      setBusy(false);
    }
  };

  const commitOrder = async (ids: string[]) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/media/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
      await refresh();
    } catch {
      alert("Razvrščanje ni uspelo.");
    } finally {
      setOrder(null);
      setBusy(false);
    }
  };

  // Thumbnails come from the 200 px derivative — never the full photo.
  const thumb = (m: Media) => {
    const src = m.kind === "video" ? m.posterUrl : m.url;
    if (!src) return "";
    return src.startsWith("/api/storage/img/") ? `${src}?w=200` : src;
  };
  const fullSize = (m: Media) =>
    m.kind === "video" ? m.url : (m.url.startsWith("/api/storage/img/") ? `${m.url}?w=1400` : m.url);

  return (
    <div
      className={`mt-2 rounded-lg ${dropActive ? "ring-2 ring-primary ring-offset-2" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDropActive(true); }
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDropActive(false);
        enqueue(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-start gap-2">
        {shown.map((m, i) => (
          <div key={m.id} className="w-24">
            <div
              draggable={!busy}
              onDragStart={() => { didDragRef.current = true; setDragId(m.id); setOrder(shown.map(x => x.id)); }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!dragId || dragId === m.id || !order) return;
                const next = order.filter(id => id !== dragId);
                next.splice(next.indexOf(m.id) < 0 ? next.length : next.indexOf(m.id), 0, dragId);
                setOrder(next);
              }}
              onDragEnd={() => { if (order) commitOrder(order); setDragId(null); setTimeout(() => { didDragRef.current = false; }, 0); }}
              onClick={() => {
                if (didDragRef.current || busy) return;
                if (m.kind === "video") {
                  window.open(fullSize(m), "_blank", "noopener,noreferrer");
                } else {
                  setFocusEdit(m);
                }
              }}
              className={`relative group rounded-xl overflow-hidden border bg-muted ${i === 0 ? "ring-2 ring-primary" : ""} ${dragId === m.id ? "opacity-50" : ""}`}
              style={{ width: 96, height: 96, aspectRatio: "1 / 1", cursor: "grab" }}
              title={i === 0 ? "Ploščica (prva v galeriji)" : "Povlecite za vrstni red"}
            >
              <img
                src={thumb(m)}
                alt={m.alt || ""}
                className="w-full h-full object-cover"
                loading="lazy"
                style={{ objectPosition: `${m.focusX ?? 50}% ${m.focusY ?? 50}%` }}
              />
              {m.kind === "video" && (
                <>
                  <span className="absolute inset-0 grid place-items-center pointer-events-none">
                    <span className="grid place-items-center w-8 h-8 rounded-full bg-black/55">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </span>
                  </span>
                  {m.durationSec ? (
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 text-white text-[10px] px-1 leading-4 pointer-events-none">
                      {fmtDuration(m.durationSec)}
                    </span>
                  ) : null}
                </>
              )}
              {i === 0 && (
                <span className="absolute top-0 left-0 rounded-br-lg bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 pointer-events-none">
                  1 · ploščica
                </span>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); remove(m.id); }}
                className="absolute top-1 right-1 grid place-items-center w-5 h-5 rounded bg-black/60 text-white hover:bg-black/80"
                aria-label="Odstrani"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <a
              href={fullSize(m)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[10px] text-muted-foreground truncate mt-0.5 hover:underline"
              title="Odpri v polni velikosti"
            >
              {decodeURIComponent(m.url.split("/").pop() || "")}
            </a>
          </div>
        ))}

        {queue.map((q, qi) => (
          <div key={q.key} className="w-24">
            <div
              className={`relative rounded-xl overflow-hidden border grid place-items-center ${q.status === "error" ? "border-destructive bg-destructive/10" : "bg-muted"}`}
              style={{ width: 96, height: 96 }}
            >
              {q.status === "pending" ? (
                <>
                  {q.previewUrl ? (
                    <img src={q.previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <span className="grid place-items-center w-8 h-8 rounded-full bg-black/55">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </span>
                  )}
                  {shown.length === 0 && qi === 0 && (
                    <span className="absolute top-0 left-0 rounded-br-lg bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 pointer-events-none">
                      1 · ploščica
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (q.previewUrl) URL.revokeObjectURL(q.previewUrl);
                      setQueueReported(qq => qq.filter(e => e.key !== q.key));
                    }}
                    className="absolute top-1 right-1 grid place-items-center w-5 h-5 rounded bg-black/60 text-white hover:bg-black/80"
                    aria-label="Odstrani"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : q.status === "uploading" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
                    <div className="h-full bg-primary transition-all" style={{ width: `${q.pct}%` }} />
                  </div>
                  <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-muted-foreground">{q.pct}%</span>
                </>
              ) : (
                <div className="p-1 text-center">
                  <button
                    type="button"
                    onClick={() => retry(q)}
                    className="inline-grid place-items-center w-7 h-7 rounded-full bg-destructive text-white mb-1"
                    aria-label="Poskusi znova"
                    title="Poskusi znova"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (q.previewUrl) URL.revokeObjectURL(q.previewUrl);
                      setQueueReported(qq => qq.filter(e => e.key !== q.key));
                    }}
                    className="absolute top-1 right-1 grid place-items-center w-5 h-5 rounded bg-black/50 text-white"
                    aria-label="Odstrani iz seznama"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <p className="text-[9px] leading-tight text-destructive line-clamp-3">{q.error}</p>
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{q.file.name}</p>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="h-24 w-24 border-dashed p-0 flex-col gap-1"
          disabled={busy || quotaFull}
          title={quotaFull ? "Prostor za medije je poln" : undefined}
          onClick={() => fileRef.current?.click()}
          aria-label="Dodaj fotografije ali video"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[10px] leading-tight">Dodaj</span>
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) enqueue(e.target.files); e.target.value = ""; }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">
        Prva datoteka je ploščica in prva v galeriji — povlecite za vrstni red. Fotografije ali video
        (mp4, webm, mov) — video do 100 MB in 3 minute. Datoteke lahko tudi povlečete sem.
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">
        Prvi vidni vnos določa fotografijo in barvo ploščice kategorije.
      </p>
      {tenantUsage && quotaPct >= 80 && (
        <p className={`text-[11px] mt-1 font-medium ${quotaFull ? "text-destructive" : "text-amber-600"}`}>
          {quotaFull
            ? `Prostor za medije je poln: ${fmtMediaUsage(tenantUsage.usedBytes, tenantUsage.quotaBytes)}. Nova nalaganja so zavrnjena — povečajte kvoto v nastavitvah namestitve. Nič se ne briše samodejno.`
            : `Porabljenega ${quotaPct} % prostora za medije (${fmtMediaUsage(tenantUsage.usedBytes, tenantUsage.quotaBytes)}).`}
        </p>
      )}
      {focusEdit && (
        <FocusEditor
          media={focusEdit}
          frameRatio={frameRatio || "5 / 3"}
          onClose={() => setFocusEdit(null)}
          onSaved={async () => { setFocusEdit(null); await refresh(); }}
        />
      )}
    </div>
  );
});


/* =========================================================
   UREJEVALNIK ŽARIŠČNE TOČKE (izrez-wifi-eposta.md §1a)
   Klik na fotografijo pove, katera točka mora ostati vidna,
   ne glede na obliko okvirja. Desno predogled v razmerju
   okvirja vnosa — točno to vidi gost.
   ========================================================= */
function FocusEditor({ media, frameRatio, onClose, onSaved }: {
  media: Media;
  frameRatio: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fx, setFx] = useState(media.focusX ?? 50);
  const [fy, setFy] = useState(media.focusY ?? 50);
  const [saving, setSaving] = useState(false);
  const src = media.url.startsWith("/api/storage/img/") ? `${media.url}?w=620` : media.url;

  const pick = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setFx(Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))));
    setFy(Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/media/${media.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focusX: fx, focusY: fy }),
      });
      if (!res.ok) throw new Error();
      onSaved();
    } catch {
      alert("Shranjevanje ni uspelo.");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-label="Žariščna točka fotografije"
    >
      <div
        className="w-full max-w-md rounded-xl bg-background p-4 shadow-lg space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="font-medium">Žariščna točka</div>
          <p className="text-xs text-muted-foreground">
            Kliknite na fotografijo tam, kjer je glavni motiv — ta točka ostane vidna v vseh okvirjih.
          </p>
        </div>
        <div className="relative cursor-crosshair select-none" onClick={pick}>
          <img src={src} alt={media.alt || ""} className="block w-full rounded-md" draggable={false} />
          <span
            className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.6)]"
            style={{ left: `${fx}%`, top: `${fy}%` }}
          >
            <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
          </span>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Predogled v okvirju vnosa</div>
          <div className="overflow-hidden rounded-md border" style={{ aspectRatio: frameRatio, maxWidth: 220 }}>
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: `${fx}% ${fy}%` }}
              draggable={false}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Prekliči
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Shrani
          </Button>
        </div>
      </div>
    </div>
  );
}
