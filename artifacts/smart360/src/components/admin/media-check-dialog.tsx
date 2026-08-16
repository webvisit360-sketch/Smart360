import { useState } from "react";
import { Link } from "wouter";
import { useCheckTenantMedia, getCheckTenantMediaQueryKey } from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const REASON: Record<string, string> = {
  missing: "datoteka ne obstaja",
  wrong_type: "napačna vrsta datoteke",
  no_alpha: "logotip ni prosojen",
};

/**
 * "Preveri datoteke" — read-only consistency check for one tenant: lists
 * every media reference whose file is missing, of the wrong type, or lacks
 * transparency where the cover logo requires it. Nothing is changed here;
 * each row links to the place where the admin can re-upload.
 */
export function MediaCheckDialog({ tenantId, tenantName, trigger }: {
  tenantId: string;
  tenantName: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useCheckTenantMedia(tenantId, {
    query: { queryKey: getCheckTenantMediaQueryKey(tenantId), enabled: open, staleTime: 0 },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Preveri datoteke — {tenantName}</DialogTitle>
          <DialogDescription>
            Preverjanje, ali vse fotografije, videi in logotipi te namestitve
            kažejo na obstoječe in pravilne datoteke. Nič se ne spreminja.
            {/* The check reads THIS environment's database only — a green
                result in dev says nothing about production. Say so. */}
            <span className="block mt-1 font-medium">
              Preverjam: {import.meta.env.PROD ? "produkcija" : "razvoj"} (podatki tega okolja).
            </span>
          </DialogDescription>
        </DialogHeader>

        {isError ? (
          <p className="text-sm text-destructive py-4">Napaka pri preverjanju. Poskusite znova.</p>
        ) : isLoading || !data ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : data.issues.length === 0 ? (
          <p className="text-sm py-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Vse datoteke so v redu — ni manjkajočih ali napačnih referenc.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {data.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <Link href={issue.adminPath} className="font-medium underline underline-offset-2 hover:text-primary" onClick={() => setOpen(false)}>
                    {issue.label}
                  </Link>
                  <p className="text-xs text-muted-foreground break-all">
                    {REASON[issue.reason] ?? issue.reason} — {issue.url}
                  </p>
                </div>
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
