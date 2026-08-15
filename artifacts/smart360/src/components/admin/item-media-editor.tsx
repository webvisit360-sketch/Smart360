import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetTenantQueryKey } from "@workspace/api-client-react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Media = { id: string; url: string; alt?: string | null; position: number };

/**
 * Photo strip for one content item in the admin content tree.
 * Position 0 is the tile image (the rule: image above text, first image wins).
 * Supports: add (upload — the server resizes to 620/1400), reorder by dragging, delete.
 */
export function ItemMediaEditor({ itemId, tenantId, media }: { itemId: string; tenantId: string; media: Media[] }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);

  const sorted = [...media].sort((a, b) => a.position - b.position);
  const shown = order ? order.map(id => sorted.find(m => m.id === id)!).filter(Boolean) : sorted;

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetTenantQueryKey(tenantId) });

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/items/${itemId}/media/upload`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      await refresh();
    } catch {
      alert("Nalaganje fotografije ni uspelo.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Odstranim fotografijo?")) return;
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

  const thumb = (url: string) => (url.startsWith("/api/storage/img/") ? `${url}?w=620` : url);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {shown.map((m, i) => (
          <div
            key={m.id}
            draggable={!busy}
            onDragStart={() => { setDragId(m.id); setOrder(shown.map(x => x.id)); }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!dragId || dragId === m.id || !order) return;
              const next = order.filter(id => id !== dragId);
              next.splice(next.indexOf(m.id) < 0 ? next.length : next.indexOf(m.id), 0, dragId);
              setOrder(next);
            }}
            onDragEnd={() => { if (order) commitOrder(order); setDragId(null); }}
            className={`relative group rounded-lg overflow-hidden border ${i === 0 ? "ring-2 ring-primary" : ""} ${dragId === m.id ? "opacity-50" : ""}`}
            style={{ width: 72, height: 54, cursor: "grab" }}
            title={i === 0 ? "Ploščica (prva slika)" : "Povleci za razvrstitev"}
          >
            <img src={thumb(m.url)} alt={m.alt || ""} className="w-full h-full object-cover" loading="lazy" />
            {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-primary/90 text-primary-foreground text-[9px] text-center leading-3 py-0.5">ploščica</span>}
            <button
              type="button"
              onClick={() => remove(m.id)}
              className="absolute top-0.5 right-0.5 hidden group-hover:grid place-items-center w-5 h-5 rounded bg-black/60 text-white"
              aria-label="Odstrani fotografijo"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-[54px] w-[72px] border-dashed p-0"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          aria-label="Dodaj fotografijo"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
        />
      </div>
      {shown.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-1">Prva slika je ploščica razdelka in prva slika galerije. Povlecite za vrstni red.</p>
      )}
    </div>
  );
}
