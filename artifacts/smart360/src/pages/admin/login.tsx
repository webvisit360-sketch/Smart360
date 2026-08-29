import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useGetPasskeyLoginOptions, useVerifyPasskeyLogin, useUseRecoveryCode } from "@workspace/api-client-react";
import { startAuthentication, WebAuthnAbortService } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, KeyRound } from "lucide-react";
import loginDesignHtml from "@assets/Smart360-prijava_1787872268224.html?raw";
import "./login.css";
import { withAbortTimeout } from "@/lib/passkey-timeout";

const suppliedLogoSvg =
  loginDesignHtml.match(/<div class="brand"><div class="lk">([\s\S]*?<\/svg>)<\/div><\/div>/)?.[1] ?? "";
const PASSKEY_TIMEOUT_MS = 60_000;
const PASSKEY_CANCEL_OFFER_MS = 10_000;
const PASSKEY_BROWSER_HELP =
  "Prijava s ključem v tem brskalniku ni uspela. Poskusite znova ali odprite administracijo v drugem brskalniku.";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isProcessingLogin, setIsProcessingLogin] = useState(false);
  const [showPasskeyCancel, setShowPasskeyCancel] = useState(false);
  const [hostEmail, setHostEmail] = useState("");
  const [hostPassword, setHostPassword] = useState("");
  const [hostBusy, setHostBusy] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const passkeyAbortRef = useRef<AbortController | null>(null);

  const getLoginOptionsMutation = useGetPasskeyLoginOptions();
  const verifyLoginMutation = useVerifyPasskeyLogin();

  useEffect(() => () => {
    passkeyAbortRef.current?.abort();
  }, []);
  
  const useRecoveryMutation = useUseRecoveryCode({
    mutation: {
      onSuccess: (data) => {
        setLocation(`/admin/enroll?token=${data.enrollToken}`);
      },
      onError: (err: any) => {
        if (err?.response?.status === 429) {
          toast({
            title: "Preveč poskusov",
            description: "Prosimo, poskusite znova kasneje.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Napaka",
            description: "Obnovitvena koda ni veljavna.",
            variant: "destructive",
          });
        }
      }
    }
  });

  const handlePasskeyLogin = async () => {
    passkeyAbortRef.current?.abort();
    const controller = new AbortController();
    passkeyAbortRef.current = controller;
    setLoginError(null);
    setIsProcessingLogin(true);
    setShowPasskeyCancel(false);
    let cancelOfferId: number | undefined;
    const cancelBrowserCeremony = () => WebAuthnAbortService.cancelCeremony();
    controller.signal.addEventListener("abort", cancelBrowserCeremony, { once: true });
    try {
      const optionsRes = await getLoginOptionsMutation.mutateAsync();
      const { challengeId, options } = optionsRes;
      cancelOfferId = window.setTimeout(
        () => setShowPasskeyCancel(true),
        PASSKEY_CANCEL_OFFER_MS,
      );

      const response = await withAbortTimeout(
        startAuthentication({ optionsJSON: options as any }),
        controller,
        PASSKEY_TIMEOUT_MS,
      );

      await verifyLoginMutation.mutateAsync({
        data: {
          challengeId,
          response: response as any,
        }
      });
      
      setLocation("/admin");
    } catch (err: any) {
      if (controller.signal.aborted || err?.name === "TimeoutError" || err?.name === "AbortError") {
        setLoginError(PASSKEY_BROWSER_HELP);
      } else if (err?.response?.status === 429) {
        setLoginError("Preveč poskusov. Prosimo, poskusite znova kasneje.");
      } else {
        setLoginError(PASSKEY_BROWSER_HELP);
      }
    } finally {
      if (cancelOfferId !== undefined) window.clearTimeout(cancelOfferId);
      controller.signal.removeEventListener("abort", cancelBrowserCeremony);
      if (passkeyAbortRef.current === controller) passkeyAbortRef.current = null;
      setShowPasskeyCancel(false);
      setIsProcessingLogin(false);
    }
  };

  const cancelPasskeyLogin = () => {
    passkeyAbortRef.current?.abort(
      new DOMException("Passkey login was cancelled", "AbortError"),
    );
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    useRecoveryMutation.mutate({ data: { code: recoveryCode } });
  };

  const handleHostLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setHostError(null);
    setResetSent(false);
    setHostBusy(true);
    try {
      const response = await fetch("/api/admin/host/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: hostEmail, password: hostPassword }),
      });
      const body = await response.json().catch(() => ({})) as {
        error?: string;
        tenantId?: string;
      };
      if (!response.ok || !body.tenantId) {
        throw new Error(body.error || "Napačen e-naslov ali geslo.");
      }
      setLocation(`/admin/tenants/${body.tenantId}`);
    } catch (error) {
      setHostError(error instanceof Error ? error.message : "Prijava ni uspela.");
    } finally {
      setHostBusy(false);
    }
  };

  const requestHostReset = async () => {
    if (!hostEmail.trim()) {
      setHostError("Najprej vnesite svoj e-poštni naslov.");
      return;
    }
    setHostError(null);
    setHostBusy(true);
    try {
      await fetch("/api/admin/host/reset/request", {
        method: "POST",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: hostEmail }),
      });
      // Uniform confirmation: never reveal whether the address has an account.
      setResetSent(true);
    } catch {
      setHostError("Zahteve trenutno ni bilo mogoče poslati. Poskusite znova.");
    } finally {
      setHostBusy(false);
    }
  };

  if (isRecoveryMode) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-2 text-center pb-8">
            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Obnovitev dostopa</CardTitle>
            <CardDescription>Vnesite obnovitveno kodo v obliki XXXX-XXXX-XXXX</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recoveryCode">Obnovitvena koda</Label>
                <Input
                  id="recoveryCode"
                  type="text"
                  placeholder="XXXX-XXXX-XXXX"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  required
                  disabled={useRecoveryMutation.isPending}
                />
              </div>
              <Button
                type="submit"
                className="w-full mt-4"
                disabled={useRecoveryMutation.isPending || !recoveryCode.trim()}
              >
                {useRecoveryMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Obnovi dostop
              </Button>
              <div className="text-center pt-2">
                <Button type="button" variant="link" onClick={() => setIsRecoveryMode(false)} className="text-muted-foreground text-sm">
                  Nazaj na prijavo
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="smart-login">
      <img className="smart-login__ring" src="/brand/smart360-kolobar-temno.svg" alt="" aria-hidden="true" />
      <main className="smart-login__card">
        <header className="smart-login__header">
          <div
            className="smart-login__logo"
            role="img"
            aria-label="Smart360"
            dangerouslySetInnerHTML={{ __html: suppliedLogoSvg }}
          />
          <h1>Portal za gostitelje</h1>
          <p>Prijavite se in uredite vodnik za svoje goste.</p>
        </header>
        <form onSubmit={handleHostLogin} className="smart-login__form">
            <div className="smart-login__field">
              <Label htmlFor="host-login-email">E-poštni naslov</Label>
              <Input id="host-login-email" type="email" autoComplete="email" placeholder="ime@primer.si" required value={hostEmail} onChange={(event) => setHostEmail(event.target.value)} />
            </div>
            <div className="smart-login__field">
              <Label htmlFor="host-login-password">Geslo</Label>
              <Input id="host-login-password" type="password" autoComplete="current-password" placeholder="••••••••" required value={hostPassword} onChange={(event) => setHostPassword(event.target.value)} />
            </div>
            {hostError && (
              <p role="alert" className="text-sm font-semibold text-destructive text-center">
                {hostError}
              </p>
            )}
            {resetSent && (
              <p className="text-sm font-semibold text-primary text-center">
                Če račun obstaja, smo poslali 60-minutno povezavo za ponastavitev.
              </p>
            )}
            <Button type="submit" className="smart-login__primary" disabled={hostBusy}>
              {hostBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Prijava za gostitelja
            </Button>
            <Button
              type="button"
              variant="link"
              className="smart-login__forgot"
              onClick={() => void requestHostReset()}
              disabled={hostBusy}
            >
              Pozabljeno geslo?
            </Button>
        </form>
          <div className="smart-login__separator">
            <span className="h-px bg-border flex-1" />
            Smart360 ekipa
            <span className="h-px bg-border flex-1" />
          </div>

          <div className="smart-login__team">
          <Button
            variant="outline"
            className="smart-login__passkey"
            onClick={handlePasskeyLogin}
            disabled={isProcessingLogin}
          >
            {isProcessingLogin && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Prijava s ključem
          </Button>

          {isProcessingLogin && showPasskeyCancel && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>Se nič ne zgodi?</span>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-sm font-semibold"
                onClick={cancelPasskeyLogin}
              >
                Prekliči poskus
              </Button>
            </div>
          )}

          {loginError && (
            <div className="text-sm font-medium text-destructive text-center">
              {loginError}
            </div>
          )}

          <div>
            <Button type="button" variant="link" onClick={() => setIsRecoveryMode(true)} className="smart-login__recovery">
              Obnovitev dostopa
            </Button>
          </div>
          </div>
      </main>
      <footer className="smart-login__footer">
        <a href="/pogoji">Pogoji uporabe</a><span>·</span><a href="/pogoji#priloga">Obdelava podatkov</a>
      </footer>
    </div>
  );
}