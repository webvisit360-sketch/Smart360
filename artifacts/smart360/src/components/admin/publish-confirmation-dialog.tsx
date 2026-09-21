import { AlertTriangle, Loader2 } from "lucide-react";
import type { TenantPublicationPreview } from "@workspace/api-client-react";
import { AdminButton as Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PublicationPreview = TenantPublicationPreview;

type PublishConfirmationDialogProps = {
  open: boolean;
  preview: PublicationPreview | null;
  loading: boolean;
  publishing: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onRetry: () => void;
};

function ChangeGroup({
  title,
  items,
  warning = false,
}: {
  title: string;
  items: string[];
  warning?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section
      className={[
        "rounded-[14px] border p-3.5",
        warning
          ? "border-[#DD9A2B]/60 bg-[#DD9A2B]/10"
          : "border-black/10 bg-muted/30",
      ].join(" ")}
    >
      <h3 className={warning ? "font-[800] text-[#9A6818]" : "font-[800] text-foreground"}>
        {title}
      </h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function PublishConfirmationDialog({
  open,
  preview,
  loading,
  publishing,
  error,
  onOpenChange,
  onConfirm,
  onRetry,
}: PublishConfirmationDialogProps) {
  const busy = loading || publishing;
  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!publishing) onOpenChange(next);
    }}>
      <DialogContent
        className="w-[calc(100%-1.5rem)] max-w-[640px] overflow-hidden p-0 sm:max-h-[min(86dvh,760px)]"
        data-testid="publish-confirmation-dialog"
      >
        <DialogHeader className="border-b px-5 pb-4 pt-5 pr-12 sm:px-6 sm:pt-6">
          <DialogTitle className="text-xl font-[850]">Potrditev objave</DialogTitle>
          <DialogDescription>
            {preview
              ? `Ta objava vsebuje ${preview.total} sprememb.`
              : "Pripravljam natančen pregled sprememb …"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6" data-testid="publish-change-list">
          {loading && (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Primerjam osnutek z objavljeno različico …
            </div>
          )}

          {!loading && error && (
            <div className="rounded-[14px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="font-semibold">{error}</p>
              </div>
              <Button type="button" variant="outline" className="mt-3" onClick={onRetry}>
                Poskusi znova
              </Button>
            </div>
          )}

          {!loading && !error && preview && (
            <div className="space-y-3">
              <ChangeGroup title="Novo:" items={preview.added} />
              <ChangeGroup title="Spremenjeno:" items={preview.changed} />
              <ChangeGroup
                title="Izbrisano ali odstranjeno:"
                items={preview.removed}
                warning
              />
              {preview.total === 0 && (
                <p className="rounded-[14px] border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Shranjene so administrativne spremembe, ki ne spreminjajo vsebine za goste.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t bg-white px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={publishing}
            onClick={() => onOpenChange(false)}
          >
            Prekliči
          </Button>
          <Button
            type="button"
            disabled={busy || !preview || Boolean(error)}
            onClick={onConfirm}
            className="bg-[#DD9A2B] text-white hover:bg-[#C88720]"
          >
            {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {publishing ? "Objavljam …" : "Objavi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}