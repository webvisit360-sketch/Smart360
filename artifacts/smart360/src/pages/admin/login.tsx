import { useState } from "react";
import { useLocation } from "wouter";
import { useGetPasskeyLoginOptions, useVerifyPasskeyLogin, useUseRecoveryCode } from "@workspace/api-client-react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, KeyRound } from "lucide-react";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isProcessingLogin, setIsProcessingLogin] = useState(false);

  const getLoginOptionsMutation = useGetPasskeyLoginOptions();
  const verifyLoginMutation = useVerifyPasskeyLogin();
  
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
    setLoginError(null);
    setIsProcessingLogin(true);
    try {
      const optionsRes = await getLoginOptionsMutation.mutateAsync();
      const { challengeId, options } = optionsRes;

      const response = await startAuthentication({ optionsJSON: options as any });

      await verifyLoginMutation.mutateAsync({
        data: {
          challengeId,
          response: response as any,
        }
      });
      
      setLocation("/admin");
    } catch (err: any) {
      if (err?.response?.status === 429) {
        setLoginError("Preveč poskusov. Prosimo, poskusite znova kasneje.");
      } else {
        setLoginError("Prijava ni uspela. Preverite brskalnik ali uporabite drugo napravo.");
      }
    } finally {
      setIsProcessingLogin(false);
    }
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    useRecoveryMutation.mutate({ data: { code: recoveryCode } });
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
    <div className="min-h-[100dvh] flex items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2 text-center pb-8">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <CardTitle className="text-2xl">Smart360 Admin</CardTitle>
          <CardDescription>Prijavite se v nadzorno ploščo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            size="lg"
            className="w-full text-base"
            onClick={handlePasskeyLogin}
            disabled={isProcessingLogin}
          >
            {isProcessingLogin && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Prijava s passkeyjem
          </Button>

          {loginError && (
            <div className="text-sm font-medium text-destructive text-center">
              {loginError}
            </div>
          )}

          <div className="text-center pt-2">
            <Button type="button" variant="link" onClick={() => setIsRecoveryMode(true)} className="text-muted-foreground text-sm">
              Obnovitev dostopa
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}