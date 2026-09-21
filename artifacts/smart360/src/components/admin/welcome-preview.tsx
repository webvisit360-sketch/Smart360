import { useEffect, useRef, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { AdminButton as Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Preview = {
  propertyName: string;
  recipient: string | null;
  subject: string;
  html: string;
  text: string;
};

function EmailPreviewFrame({ html }: { html: string }) {
  const [height, setHeight] = useState(1100);
  const observer = useRef<ResizeObserver | null>(null);
  useEffect(() => () => observer.current?.disconnect(), []);
  return (
    <div className="rounded-lg border overflow-hidden" inert>
      <iframe
        title="Vsebina dobrodošlice"
        sandbox="allow-same-origin"
        referrerPolicy="no-referrer"
        srcDoc={html}
        tabIndex={-1}
        className="w-full border-0 pointer-events-none"
        style={{ height }}
        onLoad={(event) => {
          observer.current?.disconnect();
          const body = event.currentTarget.contentDocument?.body;
          if (!body) return;
          const resize = () => setHeight(Math.ceil(body.getBoundingClientRect().height));
          // Same-origin permits measurement only; scripts/forms/popups remain blocked.
          observer.current = new ResizeObserver(resize);
          observer.current.observe(body);
          resize();
        }}
      />
    </div>
  );
}

export function WelcomePreview({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setPreview(null);
    setError("");
    void (async () => {
      try {
        const response = await fetch(`/api/admin/tenants/${tenantId}/host/welcome-preview`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Predogleda ni bilo mogoče naložiti. Zaprite ga in poskusite znova.");
        const data = await response.json() as Preview;
        if (!controller.signal.aborted) setPreview(data);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Napaka pri nalaganju.");
      }
    })();
    return () => controller.abort();
  }, [open, tenantId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Eye className="h-4 w-4 mr-2" />Predogled dobrodošlice
      </Button>
      <DialogContent className="w-[calc(100%-2rem)] max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Predogled dobrodošlice</DialogTitle>
          <DialogDescription>
            Nič ne bo poslano. Povabila se ne ustvarijo ali razveljavijo.
            Povezava za geslo je vzorčna in ne deluje. Povezave v predogledu niso klikljive.
          </DialogDescription>
        </DialogHeader>
        {error ? <p role="alert" className="text-destructive">{error}</p> : !preview ? (
          <p role="status" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Nalagam predogled …</p>
        ) : (
          <div className="space-y-4 min-w-0">
            <dl className="text-sm space-y-2 break-words">
              <div><dt className="font-bold">Nastanitev</dt><dd>{preview.propertyName}</dd></div>
              <div><dt className="font-bold">Prejemnik</dt><dd>{preview.recipient ?? "Gostiteljski račun še ni ustvarjen."}</dd></div>
              <div><dt className="font-bold">Zadeva</dt><dd>{preview.subject}</dd></div>
            </dl>
            <EmailPreviewFrame html={preview.html} />
            <details>
              <summary className="cursor-pointer font-semibold text-sm">Celotno besedilo</summary>
              <pre className="mt-3 whitespace-pre-wrap break-words text-sm font-sans">{preview.text}</pre>
            </details>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}