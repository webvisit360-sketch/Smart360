import { useEffect, useMemo, useState } from "react";
import { Check, Copy, QrCode, Wand2, Loader2, ExternalLink } from "lucide-react";
import { useCheckSlug } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

/** Mirrors the backend slugify() (lib/slug.ts): lowercase, strip diacritics,
 *  non-alnum → '-', trim '-', max 40 chars. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const REASON_MESSAGES: Record<string, string> = {
  invalid_format: "Dovoljene so male črke, številke in vezaj (3–40 znakov).",
  reserved: "Ta naslov je rezerviran.",
  taken: "Ta naslov je že zaseden.",
};

export function SlugField({
  tenantId,
  name,
  slug,
  originalSlug,
  onChange,
}: {
  tenantId: string;
  name: string;
  slug: string;
  originalSlug: string;
  onChange: (slug: string) => void;
}) {
  const { toast } = useToast();
  const [debounced, setDebounced] = useState(slug);
  const [copied, setCopied] = useState(false);

  // Debounce ~400ms so the availability check doesn't fire on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(slug), 400);
    return () => clearTimeout(t);
  }, [slug]);

  const enabled = debounced.length > 0 && debounced !== originalSlug;
  const { data: check, isFetching } = useCheckSlug(
    { slug: debounced, tenantId },
    { query: { enabled, queryKey: ["slug-check", debounced, tenantId] } },
  );

  const guestUrl = useMemo(() => `${window.location.origin}/g/${slug}`, [slug]);
  const displayUrl = useMemo(() => `smart360.info/${slug}`, [slug]);

  const changed = slug !== originalSlug;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(guestUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast({ title: "Kopirano", description: "Naslov je kopiran v odložišče." });
    } catch {
      toast({ title: "Napaka", description: "Kopiranje ni uspelo.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2">
      <Label>Slug (URL naslov)</Label>
      <div className="flex items-center gap-2">
        <Input value={slug} onChange={(e) => onChange(e.target.value)} className="flex-1" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(slugify(name))}
          disabled={!name}
        >
          <Wand2 className="w-3.5 h-3.5 mr-2" />
          Predlagaj iz imena
        </Button>
      </div>

      {/* Live availability verdict */}
      {enabled && (
        <div className="text-xs min-h-[1rem]">
          {isFetching ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Preverjanje…
            </span>
          ) : check?.available ? (
            <span className="text-green-600 font-medium">{displayUrl} — na voljo</span>
          ) : check ? (
            <span className="text-red-600 font-medium">
              {REASON_MESSAGES[check.reason ?? ""] ?? "Tega naslova ni mogoče uporabiti."}
            </span>
          ) : null}
        </div>
      )}

      {/* Live guest address + copy + QR download */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <a
          href={guestUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1 break-all"
        >
          {guestUrl}
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={copyLink}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" asChild>
          <a href={`/api/admin/tenants/${tenantId}/qr.png`} download>
            <QrCode className="w-3.5 h-3.5 mr-1.5" /> Prenesi QR
          </a>
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" asChild>
          <a href={`/api/admin/tenants/${tenantId}/label.pdf`} download>
            <QrCode className="w-3.5 h-3.5 mr-1.5" /> Nalepka (PDF, A6)
          </a>
        </Button>
      </div>

      {changed && (
        <p className="text-xs text-amber-600">Stari naslov bo za vedno preusmerjen na novega.</p>
      )}
    </div>
  );
}
