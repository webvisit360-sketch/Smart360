import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Mail, MailCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { getAdminTenantHostAccount } from "@workspace/api-client-react";
import { AdminButton as Button } from "@/components/ui/button";
import { AdminCard as Card, AdminCardContent as CardContent, CardDescription, AdminCardHeader as CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ReadyPreview, WelcomePreview } from "./welcome-preview";
import type { ManagementMode } from "./management-mode-setting";

type InviteHistoryEntry = {
  kind?: "invitation";
  label?: "povabilo z dostopom";
  createdAt: string;
  invalidatedAt: string | null;
  usedAt: string | null;
  deliveryStatus: "pending" | "accepted" | "failed" | "delivered" | "bounced" | "complained";
  providerMessageId: string | null;
  providerEventName: string | null;
  providerEventAt: string | null;
  deliveryAttemptedAt: string | null;
  deliveryFailure: {
    stage: "configuration" | "provider" | "transport";
    code: string;
    message: string;
    httpStatus: number | null;
  } | null;
};

type WelcomeWithoutAccessHistoryEntry = {
  kind: "welcome_without_access";
  label?: "dobrodošlica brez dostopa";
  createdAt: string;
};

type LifecycleHistoryEntry = {
  kind: "welcome_with_access" | "welcome_without_access" | "guide_ready";
  label: string;
  createdAt: string;
  deliveryStatus: "accepted" | "failed";
  archiveStatus: "accepted" | "failed" | "not_attempted";
  deliveryFailure: string | null;
  archiveFailure: string | null;
};

type WelcomeHistoryEntry = InviteHistoryEntry | WelcomeWithoutAccessHistoryEntry | LifecycleHistoryEntry;

type HostAccount = {
  email: string;
  hasPassword: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  inviteHistory?: WelcomeHistoryEntry[];
};

const inviteDeliveryDetails = {
  pending: { label: "Dostava še ni potrjena", icon: Loader2, className: "text-amber-700" },
  accepted: { label: "Sprejeto pri ponudniku — čaka na končni izid", icon: CheckCircle2, className: "text-emerald-700" },
  failed: { label: "E-pošte ni bilo mogoče poslati", icon: AlertTriangle, className: "text-red-700" },
  delivered: { label: "E-pošta dostavljena", icon: MailCheck, className: "text-emerald-700" },
  bounced: { label: "E-pošta zavrnjena — Pokličite stranko", icon: AlertTriangle, className: "text-red-800 font-bold" },
  complained: { label: "Prejemnik je označil e-pošto kot neželeno", icon: ShieldAlert, className: "text-red-800 font-bold" },
} as const;

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string };
    return body.error || `Napaka ${response.status}`;
  } catch {
    return `Napaka ${response.status}`;
  }
}

export function HostInvitePanel({
  tenantId,
  managementMode,
}: {
  tenantId: string;
  managementMode: ManagementMode;
}) {
  const { toast } = useToast();
  const [account, setAccount] = useState<HostAccount | null>(null);
  const [inviteHistory, setInviteHistory] = useState<WelcomeHistoryEntry[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "welcome" | "reset" | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAdminTenantHostAccount(tenantId, { cache: "no-store" });
      const accountData = data.account as HostAccount | null;
      const history = data.inviteHistory as WelcomeHistoryEntry[];
      setAccount(accountData);
      setInviteHistory(history ?? accountData?.inviteHistory ?? []);
      setEmail(accountData?.email || "");
    } catch (error) {
      toast({
        title: "Gostiteljskega računa ni bilo mogoče prebrati",
        description: error instanceof Error ? error.message : "Poskusite znova.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [tenantId, managementMode]);

  const saveAccount = async () => {
    setBusy("save");
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/host`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error(await readError(response));
      await response.json();
      await load();
      toast({ title: account ? "E-poštni naslov je shranjen" : "Gostiteljski račun je ustvarjen" });
    } catch (error) {
      toast({
        title: "Shranjevanje ni uspelo",
        description: error instanceof Error ? error.message : "Poskusite znova.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const sendInvite = async (template: "welcome") => {
    setBusy(template);
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/host/send-invite`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template }),
      });
      if (!response.ok) throw new Error(await readError(response));
      toast({
        title: managementMode === "concierge" ? "Dobrodošlica je poslana" : "Vabilo je poslano",
        description:
          managementMode === "concierge"
            ? "Gostitelj je prejel dobrodošlico brez povezave za dostop."
            : "Povezava velja 72 ur in enkrat. Novo vabilo je razveljavilo prejšnjega.",
      });
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Poskusite znova.";
      toast({
        title: managementMode === "concierge"
          ? "Dobrodošlice ni bilo mogoče poslati"
          : "Vabila ni bilo mogoče poslati",
        description: message,
        variant: "destructive",
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const sendReset = async () => {
    setBusy("reset");
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/host/send-reset`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await readError(response));
      toast({
        title: "Ponastavitev je poslana gostitelju",
        description: "Povezava velja 60 minut in jo je mogoče uporabiti enkrat.",
      });
    } catch (error) {
      toast({
        title: "Ponastavitve ni bilo mogoče poslati",
        description: error instanceof Error ? error.message : "Poskusite znova.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {managementMode === "concierge" ? "Dobrodošlica gostitelju" : "Gostiteljski račun in povabila"}
        </CardTitle>
        <CardDescription>
          {managementMode === "concierge"
            ? "Pošljite dobrodošlico brez ustvarjanja računa, gesla ali dostopa."
            : "Geslo nastavi gostitelj sam. Smart360 ga nikoli ne vidi in ga ne pošilja po e-pošti."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Nalagam račun …
          </div>
        ) : (
          <>
            {managementMode === "concierge" && (
              <div className="rounded-[18px] border bg-muted/30 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-bold">Gostitelj nima dostopa do administracije</p>
                    <p className="text-sm text-muted-foreground">
                      Dobrodošlica ne vsebuje gesla ali povezave za prijavo. Vsebino ureja Smart360.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    data-testid="send-concierge-welcome"
                    onClick={() => void sendInvite("welcome")}
                    disabled={busy !== null}
                  >
                    {busy === "welcome" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                    Pošlji dobrodošlico
                  </Button>
                  <WelcomePreview tenantId={tenantId} managementMode={managementMode} />
                   <ReadyPreview tenantId={tenantId} onSent={load} />
                </div>
              </div>
            )}

            {managementMode === "self_service" && (
            <div className="space-y-2" data-testid="host-access-controls">
              <Label htmlFor="host-email">E-poštni naslov gostitelja</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="host-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="gostitelj@example.com"
                />
                <Button
                  variant="outline"
                  onClick={saveAccount}
                  disabled={busy !== null || !email.trim()}
                >
                  {busy === "save" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {account ? "Shrani naslov" : "Ustvari račun"}
                </Button>
              </div>
            </div>
            )}

            {managementMode === "self_service" && account && !account.hasPassword && (
              <div className="rounded-[18px] border bg-muted/30 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-bold">Račun še ni aktiviran</p>
                    <p className="text-sm text-muted-foreground">
                      Vabilo velja 72 ur in enkrat. Vsako novo vabilo samodejno razveljavi prejšnjega.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void sendInvite("welcome")} disabled={busy !== null}>
                    {busy === "welcome" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                    Pošlji dobrodošlico
                  </Button>
                  <WelcomePreview key={tenantId} tenantId={tenantId} managementMode={managementMode} />
                  <ReadyPreview tenantId={tenantId} onSent={load} />
                </div>
              </div>
            )}

            {managementMode === "self_service" && (!account || account.hasPassword) && (
              <div className="flex flex-wrap gap-2">
                <WelcomePreview key={tenantId} tenantId={tenantId} managementMode={managementMode} />
                <ReadyPreview tenantId={tenantId} onSent={load} />
              </div>
            )}

            {inviteHistory.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-bold">Zgodovina poslanih dobrodošlic in vabil</p>
                {inviteHistory.map((invite, index) => {
                  if ("archiveStatus" in invite) {
                    return (
                      <div key={`${invite.createdAt}-${index}`} data-testid={`row-welcome-history-${index}`} className="rounded-[18px] border bg-muted/30 p-4 text-sm space-y-1">
                        <p className="font-bold">{invite.label}</p>
                        <p>{invite.deliveryStatus === "accepted" ? "Gostitelju: sprejeto pri ponudniku" : `Gostitelju: ni uspelo (${invite.deliveryFailure ?? "napaka"})`}</p>
                        <p>{invite.archiveStatus === "accepted" ? "Arhivska kopija: sprejeta pri ponudniku" : invite.archiveStatus === "failed" ? `Arhivska kopija: ni uspela (${invite.archiveFailure ?? "napaka"})` : "Arhivska kopija: ni bila poslana"}</p>
                        <time className="text-xs text-muted-foreground">{new Date(invite.createdAt).toLocaleString("sl-SI", { dateStyle: "medium", timeStyle: "short" })}</time>
                      </div>
                    );
                  }
                  if (invite.kind === "welcome_without_access") {
                    return (
                      <div
                        key={`${invite.createdAt}-${index}`}
                        data-testid={`row-welcome-history-${index}`}
                        className="rounded-[18px] border bg-muted/30 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">dobrodošlica brez dostopa</p>
                          <time className="text-xs text-muted-foreground">
                            {new Date(invite.createdAt).toLocaleString("sl-SI", { dateStyle: "medium", timeStyle: "short" })}
                          </time>
                        </div>
                      </div>
                    );
                  }
                  const delivery = inviteDeliveryDetails[invite.deliveryStatus];
                  const DeliveryIcon = delivery.icon;
                  const critical = invite.deliveryStatus === "bounced" || invite.deliveryStatus === "complained";
                  return (
                    <div
                      key={`${invite.createdAt}-${index}`}
                      data-testid={`row-welcome-history-${index}`}
                      className={`rounded-[18px] border p-4 space-y-2 ${critical ? "border-red-300 bg-red-50" : "bg-muted/30"}`}
                    >
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        povabilo z dostopom
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className={`flex items-center gap-2 ${delivery.className}`}>
                          <DeliveryIcon className={`h-4 w-4 ${invite.deliveryStatus === "pending" ? "animate-spin" : ""}`} />
                          <p className="font-medium">{delivery.label}</p>
                        </div>
                        <time className="text-xs text-muted-foreground">
                          {new Date(invite.createdAt).toLocaleString("sl-SI", { dateStyle: "medium", timeStyle: "short" })}
                        </time>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ID ponudnika: <span className="font-mono">{invite.providerMessageId || "—"}</span>
                      </p>
                      {invite.deliveryAttemptedAt && (
                        <p className="text-xs text-muted-foreground">
                          Poskus dostave: {new Date(invite.deliveryAttemptedAt).toLocaleString("sl-SI", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      )}
                      {invite.deliveryFailure && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                          <p className="font-medium">{invite.deliveryFailure.message}</p>
                          <p className="mt-1 font-mono">
                            {invite.deliveryFailure.stage} · {invite.deliveryFailure.code}
                            {invite.deliveryFailure.httpStatus ? ` · HTTP ${invite.deliveryFailure.httpStatus}` : ""}
                          </p>
                        </div>
                      )}
                      {invite.providerEventName && invite.providerEventAt && (
                        <p className="text-xs text-muted-foreground">
                          Zadnji dogodek ponudnika: <span className="font-medium">{invite.providerEventName}</span> · {new Date(invite.providerEventAt).toLocaleString("sl-SI", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      )}
                      {(invite.usedAt || invite.invalidatedAt) && (
                        <p className="text-xs text-muted-foreground">
                          {invite.usedAt ? "Vabilo je bilo uporabljeno." : "Vabilo je bilo razveljavljeno."}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {managementMode === "self_service" && account?.hasPassword && (
              <div className="rounded-[18px] border bg-muted/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-bold">Račun je aktiviran</p>
                    <p className="text-sm text-muted-foreground">
                      Za pozabljeno geslo pošljite ločeno 60-minutno ponastavitev.
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => void sendReset()} disabled={busy !== null}>
                  {busy === "reset" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Pošlji ponastavitev
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}