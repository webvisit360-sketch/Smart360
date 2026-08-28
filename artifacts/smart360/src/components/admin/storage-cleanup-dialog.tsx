import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetStorageCleanupPreview,
  useRunStorageCleanup,
  getGetStorageUsageQueryKey,
  getGetStorageCleanupPreviewQueryKey,
} from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Play } from "lucide-react";
import { fmtMediaSize } from "@/lib/format-bytes";

function fmtSize(bytes: number): string {
  return fmtMediaSize(bytes);
}

/**
 * Explicit cleanup of unreferenced storage files ("Sprosti neuporabljene
 * datoteke"). Always shows the dry-run list first — file, size, thumbnail,
 * date — with the total to be freed; nothing is deleted without the
 * confirmation click. Files still referenced by ANY tenant (duplicates!)
 * never appear in the list; the server re-checks references on execute.
 */
export function StorageCleanupDialog({
  scope,
  tenantId,
  tenantName,
  trigger,
}: {
  scope: "tenant" | "orphans";
  tenantId?: string;
  tenantName?: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<{ freedBytes: number; deletedFiles: number } | null>(null);
  const queryClient = useQueryClient();

  const params = scope === "tenant" ? { scope, tenantId: tenantId! } : { scope };
  const { data: preview, isLoading, isError } = useGetStorageCleanupPreview(params, {
    query: { queryKey: getGetStorageCleanupPreviewQueryKey(params), enabled: open, staleTime: 0 },
  });

  const runMutation = useRunStorageCleanup({
    mutation: {
      onSuccess: async (res) => {
        setDone(res);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetStorageUsageQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetStorageCleanupPreviewQueryKey(params) }),
        ]);
      },
    },
  });

  const title = scope === "orphans"
    ? "Sprosti datoteke izbrisanih namestitev"
    : `Sprosti neuporabljene datoteke — ${tenantName ?? ""}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setDone(null); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Prikazane so samo datoteke, na katere ne kaže nobena namestitev več
            (tudi podvojene ne). Datoteke, mlajše od 7 dni, so iz varnosti
            izpuščene. Nič se ne izbriše brez potrditve.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <p className="text-sm py-4">
            {done.deletedFiles === 0
              ? "Ni bilo česa sprostiti — vse datoteke so še v uporabi."
              : `Sproščeno: ${fmtSize(done.freedBytes)} (${done.deletedFiles} datotek).`}
          </p>
        ) : isError || runMutation.isError ? (
          <p className="text-sm text-destructive py-4">
            Napaka pri preverjanju datotek. Poskusite znova.
          </p>
        ) : isLoading || !preview ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : preview.files.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Ni česa sprostiti — vse shranjene datoteke so še v uporabi.
          </p>
        ) : (
          <>
            <p className="text-sm font-medium">
              Za sprostitev: {fmtSize(preview.totalBytes)} ({preview.files.length} datotek)
            </p>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {preview.files.map((f) => (
                <div key={`${f.slug}/${f.name}`} className="flex items-center gap-3 text-sm">
                  {f.thumbUrl ? (
                    <img src={f.thumbUrl} alt="" className="w-10 h-10 rounded object-cover bg-muted shrink-0" loading="lazy" />
                  ) : (
                    <span className="w-10 h-10 rounded bg-muted grid place-items-center shrink-0">
                      <Play className="w-4 h-4 text-muted-foreground" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{decodeURIComponent(f.name)}</p>
                    <p className="text-xs text-muted-foreground">
                      {scope === "orphans" ? `${f.slug} • ` : ""}
                      {f.lastModified ? new Date(f.lastModified).toLocaleDateString("sl-SI") : "datum neznan"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{fmtSize(f.bytes)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {done ? "Zapri" : "Prekliči"}
          </Button>
          {!done && (preview?.files.length ?? 0) > 0 && (
            <Button
              variant="destructive"
              disabled={runMutation.isPending}
              onClick={() => runMutation.mutate({ data: scope === "tenant" ? { scope, tenantId } : { scope } })}
            >
              {runMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Trash2 className="h-4 w-4 mr-2" />Sprosti {preview ? fmtSize(preview.totalBytes) : ""}</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
