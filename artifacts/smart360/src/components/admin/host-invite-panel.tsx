import { useEffect, useState } from "react";
import { Loader2, Mail, RefreshCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type HostAccount = {
  email: string;
  hasPassword: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string };
    return body.error || `Napaka ${response.status}`;
  } catch {
    return `Napaka ${response.status}`;
  }
}

export function HostInvitePanel({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const [account, setAccount] = useState<HostAccount | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "welcome" | "guide-ready" | "reset" | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/host`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json() as HostAccount | null;
      setAccount(data);
      setEmail(data?.email || "");
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
  }, [tenantId]);

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
      const data = await response.json() as HostAccount;
      setAccount(data);
      setEmail(data.email);
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

  const sendInvite = async (template: "welcome" | "guide-ready") => {
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
        title: "Vabilo je poslano",
        description:
          "Povezava velja 72 ur in enkrat. Novo vabilo je razveljavilo prejšnjega.",
      });
    } catch (error) {
      toast({
        title: "Vabila ni bilo mogoče poslati",
        description: error instanceof Error ? error.message : "Poskusite znova.",
        variant: "destructive",
      });
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
        <CardTitle>Gostiteljski račun in povabila</CardTitle>
        <CardDescription>
          Geslo nastavi gostitelj sam. Smart360 ga nikoli ne vidi in ga ne pošilja po e-pošti.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Nalagam račun …
          </div>
        ) : (
          <>
            <div className="space-y-2">
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

            {account && !account.hasPassword && (
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
                  <Button
                    variant="outline"
                    onClick={() => void sendInvite("guide-ready")}
                    disabled={busy !== null}
                  >
                    {busy === "guide-ready" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                    Vodnik je pripravljen
                  </Button>
                </div>
              </div>
            )}

            {account?.hasPassword && (
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