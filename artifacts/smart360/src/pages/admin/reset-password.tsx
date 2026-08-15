import { useState } from "react";
import { useLocation } from "wouter";
import { useResetAdminPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function AdminResetPassword() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetMutation = useResetAdminPassword({
    mutation: {
      onSuccess: () => {
        setSuccess(true);
      },
      onError: (err: any) => {
        if (err?.response?.status === 400) {
          setError("Povezava za ponastavitev je neveljavna ali potekla.");
        } else {
          setError("Prišlo je do napake. Prosimo, poskusite znova.");
        }
      }
    }
  });

  if (!token) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-sm text-center py-6">
          <CardHeader>
            <CardTitle>Neveljavna povezava</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">V povezavi manjka žeton za ponastavitev.</p>
            <Button onClick={() => setLocation("/admin/login")} className="w-full">
              Nazaj na prijavo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (newPassword.length < 12) {
      setError("Novo geslo mora vsebovati vsaj 12 znakov.");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError("Novi gesli se ne ujemata.");
      return;
    }

    resetMutation.mutate({ data: { token, newPassword } });
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <CardTitle className="text-2xl">Ponastavitev gesla</CardTitle>
          <CardDescription>
            {success ? "Geslo je uspešno nastavljeno." : "Vnesite novo močno geslo."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4 text-center">
              <Button onClick={() => setLocation("/admin/login")} className="w-full">
                Nadaljuj na prijavo
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Novo geslo</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={resetMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Ponovite novo geslo</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={resetMutation.isPending}
                />
              </div>

              {error && (
                <div className="text-sm font-medium text-destructive pt-1 text-center space-y-2">
                  <p>{error}</p>
                  {error.includes("potekla") && (
                    <Button type="button" variant="link" onClick={() => setLocation("/admin/login")} className="text-xs h-auto p-0">
                      Zahtevajte novo povezavo
                    </Button>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full mt-4"
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Nastavi novo geslo
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}