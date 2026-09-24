import { useEffect, useRef, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { AdminButton as Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ManagementMode } from "./management-mode-setting";

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

export function WelcomePreview({
  tenantId,
  managementMode = "self_service",
}: {
  tenantId: string;
  managementMode?: ManagementMode;
}) {
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
            {managementMode === "self_service" && " Povezava za geslo je vzorčna in ne deluje."}
            {" "}Povezave v predogledu niso klikljive.
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

type ReadyPreviewData = Preview & { message: string; guideUrl: string };

export function ReadyPreview({ tenantId, onSent }: { tenantId: string; onSent: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ReadyPreviewData | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [rendered, setRendered] = useState<{ html: string; subject: string; message: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setPreview(null);
    setRendered(null);
    setError("");
    void (async () => {
      try {
        const response = await fetch(`/api/admin/tenants/${tenantId}/host/ready-preview`, {
          credentials: "include", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Predogleda ni bilo mogoče naložiti.");
        const data = await response.json() as ReadyPreviewData;
        if (!controller.signal.aborted) {
          setPreview(data);
          setSubject(data.subject);
          setMessage(data.message);
          setRendered({ html: data.html, subject: data.subject, message: data.message });
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Napaka pri nalaganju.");
      }
    })();
    return () => controller.abort();
  }, [open, tenantId]);

  useEffect(() => {
    if (!open || !preview || (subject === rendered?.subject && message === rendered.message)) return;
    setRendered(null);
    if (!subject.trim() || !message.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/admin/tenants/${tenantId}/host/ready-preview`, {
            method: "POST", credentials: "include", headers: { "content-type": "application/json" },
            body: JSON.stringify({ subject, message }), signal: controller.signal,
          });
          if (!response.ok) throw new Error("Predogleda urejenega besedila ni bilo mogoče prikazati.");
          const data = await response.json() as { html: string; subject: string; message: string };
          if (!controller.signal.aborted) { setRendered(data); setError(""); }
        } catch (reason) {
          if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Napaka predogleda.");
        }
      })();
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, tenantId, preview, subject, message, rendered]);

  async function send() {
    if (!preview || !window.confirm(`Pošljem sporočilo na ${preview.recipient}?`)) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/host/send-ready`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      const result = await response.json() as { error?: string; archiveStatus?: string };
      if (!response.ok) throw new Error(result.error ?? "Pošiljanje ni uspelo.");
      await onSent();
      setOpen(false);
      if (result.archiveStatus === "failed") window.alert("Sporočilo je bilo poslano gostitelju, arhivska kopija pa ni uspela. Preverite zgodovino.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pošiljanje ni uspelo.");
      await onSent();
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button data-testid="send-ready-preview" variant="outline" onClick={() => setOpen(true)}>
        <Eye className="h-4 w-4 mr-2" />Pošlji obvestilo: vodnik je pripravljen
      </Button>
      <DialogContent className="w-[calc(100%-2rem)] max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Predogled: vodnik je pripravljen</DialogTitle>
          <DialogDescription>Preglejte ali začasno uredite besedilo in zadevo. Spremembe veljajo samo za to pošiljanje. Nalepka QR je priložena kot PDF.</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        {!preview ? (!error && <p role="status">Nalagam predogled …</p>) : (
          <div className="space-y-4">
            <p className="text-sm">Prejemnik: <strong>{preview.recipient ?? "Ni e-naslova — pošiljanje ni mogoče"}</strong></p>
            <label className="block text-sm font-bold">Zadeva
              <input className="mt-1 w-full rounded-md border p-2 font-normal" value={subject} maxLength={180} onChange={e => setSubject(e.target.value)} />
            </label>
            <label className="block text-sm font-bold">Besedilo
              <textarea className="mt-1 w-full rounded-md border p-2 font-normal" rows={12} maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} />
            </label>
            <p className="text-xs text-muted-foreground">Predogled se osveži po urejanju. Gumba, naslov vodnika in QR-koda ostanejo nespremenjeni.</p>
            {rendered ? <EmailPreviewFrame html={rendered.html} /> : <p role="status">Osvežujem predogled …</p>}
            <Button data-testid="confirm-send-ready" disabled={sending || !preview.recipient || !rendered || rendered.subject !== subject || rendered.message !== message} onClick={() => void send()}>
              {sending ? "Pošiljam …" : "Potrdi in pošlji"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}