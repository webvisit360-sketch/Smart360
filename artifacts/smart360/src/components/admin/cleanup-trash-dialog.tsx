import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCleanupRuns,
  getListCleanupRunsQueryKey,
  useRestoreCleanupFiles,
  getGetStorageUsageQueryKey,
} from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";
import { fmtMediaSize } from "@/lib/format-bytes";

function fmtSize(bytes: number): string {
  return fmtMediaSize(bytes);
}

/**
 * "Koš in dnevnik čiščenja" — audit list of every cleanup run (when, scope,
 * files with sizes) with per-file Restore. Cleanup never hard-deletes:
 * objects live in trash for 30 days, then are purged; purged runs stay in
 * the log but can no longer be restored.
 */
export function CleanupTrashDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useListCleanupRuns({
    query: { queryKey: getListCleanupRunsQueryKey(), enabled: open, staleTime: 0 },
  });
  const restoreMutation = useRestoreCleanupFiles({
    mutation: {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getListCleanupRunsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetStorageUsageQueryKey() }),
        ]);
      },
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Koš in dnevnik čiščenja</DialogTitle>
          <DialogDescription>
            Vsako čiščenje je zabeleženo. Datoteke se ne izbrišejo dokončno —
            30 dni ostanejo v košu in jih lahko obnovite; nato so trajno
            odstranjene.
          </DialogDescription>
        </DialogHeader>

        {isError ? (
          <p className="text-sm text-destructive py-4">Napaka pri nalaganju. Poskusite znova.</p>
        ) : isLoading || !data ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : data.runs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Še ni bilo nobenega čiščenja.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-4 pr-1">
            {data.runs.map((run) => (
              <div key={run.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {new Date(run.createdAt).toLocaleString("sl-SI")}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {run.scope === "orphans" ? "izbrisane namestitve" : run.tenantSlug ?? "namestitev"}
                    {" • "}{run.fileCount} datotek • {fmtSize(run.totalBytes)}
                    {run.purged ? " • koš izpraznjen" : ""}
                  </span>
                </div>
                {run.files.length > 0 && (
                  <div className="space-y-1">
                    {run.files.map((f) => (
                      <div key={f.key} className="flex items-center gap-2 text-xs">
                        <span className="truncate flex-1">{decodeURIComponent(f.key)}</span>
                        <span className="text-muted-foreground shrink-0">{fmtSize(f.bytes)}</span>
                        {f.restored ? (
                          <span className="text-green-700 shrink-0">obnovljeno</span>
                        ) : run.purged ? (
                          <span className="text-muted-foreground shrink-0">ni več v košu</span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs shrink-0"
                            disabled={restoreMutation.isPending}
                            onClick={() => restoreMutation.mutate({ data: { runId: run.id, key: f.key } })}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" /> Obnovi
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Zapri</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
