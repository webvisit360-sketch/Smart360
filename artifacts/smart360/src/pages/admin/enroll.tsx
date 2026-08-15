import { useState } from "react";
import { useLocation } from "wouter";
import { useGetEnrollOptions, useVerifyEnroll } from "@workspace/api-client-react";
import { startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, KeyRound, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminEnroll() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token");
  const { toast } = useToast();

  const [deviceName, setDeviceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const getOptionsMutation = useGetEnrollOptions();
  const verifyMutation = useVerifyEnroll();

  if (!token) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md text-center py-6">
          <CardHeader>
            <CardTitle>Neveljavna povezava</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">V povezavi manjka žeton za registracijo.</p>
            <div className="p-3 bg-muted-foreground/10 rounded-md text-xs font-mono text-left">
              $ npm run cli enroll pi4.doo@gmail.com
            </div>
            <Button onClick={() => setLocation("/admin/login")} className="w-full">
              Nazaj na prijavo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsProcessing(true);

    try {
      // 1. Get options
      const optionsRes = await getOptionsMutation.mutateAsync({ data: { token } });
      const { challengeId, options } = optionsRes;

      // 2. Start WebAuthn registration
      const response = await startRegistration({ optionsJSON: options as any });

      // 3. Verify
      const verifyRes = await verifyMutation.mutateAsync({
        data: {
          token,
          challengeId,
          deviceName: deviceName.trim() || "Nova naprava",
          response: response as any,
        }
      });

      if (verifyRes.recoveryCodes && verifyRes.recoveryCodes.length > 0) {
        setRecoveryCodes(verifyRes.recoveryCodes);
      } else {
        toast({ title: "Uspešna registracija", description: "Vaš ključ je dodan." });
        setLocation("/admin");
      }

    } catch (err: any) {
      if (err?.response?.status === 400 || err?.response?.status === 401) {
        setError("Povezava je neveljavna ali je že potekla. Ustvarite novo povezavo.");
      } else {
        setError("Napaka pri registraciji ključa. Preverite brskalnik in poskusite znova.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const copyCodes = () => {
    if (recoveryCodes) {
      navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Kopirano", description: "Obnovitvene kode so kopirane v odložišče." });
    }
  };

  if (recoveryCodes) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl text-destructive">Pomembno!</CardTitle>
            <CardDescription className="text-sm font-medium text-foreground">
              Registracija uspešna. Shranite te obnovitvene kode. Prikazane so samo enkrat. Uporabite jih lahko za dostop do računa, če izgubite svoj ključ.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-xl font-mono text-sm tracking-wider grid grid-cols-2 gap-2 text-center border shadow-inner">
              {recoveryCodes.map(code => (
                <div key={code}>{code}</div>
              ))}
            </div>
            <Button onClick={copyCodes} variant="outline" className="w-full">
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              Kopiraj vse
            </Button>
            <Button onClick={() => setLocation("/admin")} className="w-full" variant="default">
              Nadaljuj v nadzorno ploščo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Registracija ključa</CardTitle>
          <CardDescription>
            Ustvarite nov passkey za prijavo. Povezava je za enkratno uporabo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEnroll} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deviceName">Ime naprave (neobvezno)</Label>
              <Input
                id="deviceName"
                placeholder="npr. iPhone"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            {error && (
              <div className="text-sm font-medium text-destructive pt-1 space-y-2">
                <p>{error}</p>
                {error.includes("potekla") && (
                  <div className="p-3 bg-destructive/10 rounded-md text-xs font-mono text-left text-foreground">
                    $ npm run cli enroll pi4.doo@gmail.com
                  </div>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full mt-4"
              disabled={isProcessing}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registriraj passkey
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}