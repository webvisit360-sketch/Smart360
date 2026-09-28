import { CheckCircle2, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type ReadinessCheck = { key: string; label: string; done: boolean };

type TenantReadinessPopoverProps = {
  checks: ReadinessCheck[];
  readinessPct: number;
  tenantName: string;
  tenantSubtitle: string | null | undefined;
  missingPhotos: number;
};

function missingHint(
  check: ReadinessCheck,
  name: string,
  subtitle: string | null | undefined,
  missingPhotos: number,
): string {
  switch (check.key) {
    case "basics": {
      const missing = [
        !name.trim() && "ime",
        !subtitle?.trim() && "podnaslov",
      ].filter(Boolean);
      return missing.length
        ? `Dodajte ${missing.join(" in ")} nastanitve.`
        : "Preverite ime in podnaslov nastanitve.";
    }
    case "visual": return "Dodajte logotip ali naslovno fotografijo.";
    case "contact": return "Dodajte e-pošto ali telefon.";
    case "location": return "Nastavite koordinate nastanitve.";
    case "content": return "Dodajte vsaj en viden vnos vsebine.";
    case "photos":
      return missingPhotos === 0
        ? "Dodajte kategorije s fotografijami."
        : "Dodajte fotografije ali barvne ploščice kategorijam.";
    case "locationsConfirmed": return "Potrdite čakajoče predloge lokacij.";
    case "published": return "Objavite vodnik.";
    default: return check.label;
  }
}

export function TenantReadinessPopover({
  checks,
  readinessPct,
  tenantName,
  tenantSubtitle,
  missingPhotos,
}: TenantReadinessPopoverProps) {
  const completed = checks.filter(check => check.done).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded text-xs font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#157347]"
          aria-label={`${tenantName}: ${readinessPct} % pripravljen — prikaži kontrolni seznam`}
        >
          {readinessPct} % pripravljen
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="w-[min(380px,calc(100vw-24px))] overflow-y-auto rounded-[22px] border-[#E8EBE6] bg-[#F4F6F2] p-4 text-[#121A14]"
        style={{ maxHeight: "min(680px, calc(100dvh - 24px), var(--radix-popover-content-available-height))" }}
        aria-label={`Pripravljenost: ${tenantName}`}
      >
        <h3 className="text-[17px] font-[800] tracking-tight">Pripravljenost vodnika</h3>
        <p className="mt-1 text-[13px] text-[#66716A]">
          {tenantName} · {completed}/{checks.length} korakov · {readinessPct} %
        </p>
        <p className="mb-3 mt-1 text-[12px] text-[#66716A]">
          Vsak od 8 korakov prispeva 12,5 odstotne točke. Skupni odstotek je zaokrožen.
        </p>
        <ul className="space-y-2">
          {checks.map(check => (
            <li key={check.key}>
              <Card className="flex gap-3 rounded-[13px] border border-[#E8EBE6] bg-white p-3">
                {check.done
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#157347]" />
                  : <Circle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#9AA69E]" />}
                <div className="min-w-0">
                  <div className={`text-[13px] font-[700] ${check.done ? "text-[#121A14]" : "text-[#66716A]"}`}>{check.label}</div>
                  <div className="text-[12px] text-[#66716A]">
                    {check.done ? "Urejeno" : missingHint(check, tenantName, tenantSubtitle, missingPhotos)}
                    {!check.done && check.key === "photos" && missingPhotos > 0 && ` (${missingPhotos} brez fotografij ali barvnih ploščic)`}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}