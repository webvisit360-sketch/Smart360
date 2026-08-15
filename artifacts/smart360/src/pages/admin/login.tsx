import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminLogin, useForgotAdminPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const loginMutation = useAdminLogin({
    mutation: {
      onSuccess: () => {
        setLocation("/admin");
      },
      onError: () => {
        toast({
          title: "Napaka pri prijavi",
          description: "Preverite uporabniško ime in geslo.",
          variant: "destructive",
        });
      },
    },
  });

  const forgotMutation = useForgotAdminPassword({
    mutation: {
      onSuccess: () => {
        setForgotSuccess(true);
      },
      onError: (err: any) => {
        if (err?.response?.status === 429) {
          toast({
            title: "Preveč poskusov",
            description: "Prosimo, poskusite znova kasneje.",
            variant: "destructive",
          });
        } else {
          // Always show success message to prevent email enumeration,
          // except for explicit rate limits
          setForgotSuccess(true);
        }
      }
    }
  });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { username, password } });
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSuccess(false);
    forgotMutation.mutate({ data: { email: forgotEmail } });
  };

  if (isForgotMode) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-2 text-center pb-8">
            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <CardTitle className="text-2xl">Pozabljeno geslo</CardTitle>
            <CardDescription>Vnesite svoj email za ponastavitev gesla</CardDescription>
          </CardHeader>
          <CardContent>
            {forgotSuccess ? (
              <div className="space-y-4 text-center">
                <div className="p-4 bg-muted rounded-md text-sm">
                  Če račun obstaja, smo poslali navodila na vnesen e-naslov.
                </div>
                <Button variant="link" onClick={() => setIsForgotMode(false)} className="w-full">
                  Nazaj na prijavo
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">Email</Label>
                  <Input
                    id="forgotEmail"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    disabled={forgotMutation.isPending}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full mt-4"
                  disabled={forgotMutation.isPending}
                >
                  {forgotMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Pošlji navodila
                </Button>
                <div className="text-center pt-2">
                  <Button type="button" variant="link" onClick={() => setIsForgotMode(false)} className="text-muted-foreground text-sm">
                    Nazaj na prijavo
                  </Button>
                </div>
              </form>
            )}
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
          <CardDescription>Prijavite se za upravljanje namestitev</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Uporabniško ime</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loginMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Geslo</Label>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loginMutation.isPending}
              />
            </div>
            <Button
              type="submit"
              className="w-full mt-4"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Prijava
            </Button>
            <div className="text-center pt-2">
              <Button type="button" variant="link" onClick={() => setIsForgotMode(true)} className="text-muted-foreground text-sm">
                Pozabljeno geslo?
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}