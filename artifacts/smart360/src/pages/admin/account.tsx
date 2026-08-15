import { useState } from "react";
import { useChangeAdminPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function AdminAccount() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const changeMutation = useChangeAdminPassword({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Geslo je spremenjeno",
          description: "Uspešno ste spremenili geslo. Druge seje so odjavljene.",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setError(null);
      },
      onError: (err: any) => {
        if (err?.response?.status === 401) {
          setError("Trenutno geslo ni pravilno.");
        } else {
          toast({
            title: "Napaka",
            description: "Prišlo je do napake pri spremembi gesla.",
            variant: "destructive",
          });
        }
      },
    },
  });

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

    changeMutation.mutate({ data: { currentPassword, newPassword } });
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Moj račun</h1>
        <p className="text-sm text-muted-foreground">Upravljanje vašega uporabniškega računa</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prijavni podatki</CardTitle>
          <CardDescription>Email za prijavo in obvestila</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <Label>Email naslov</Label>
            <div className="text-sm font-medium py-2 px-3 bg-muted rounded-md w-full sm:w-1/2">
              pi4.doo@gmail.com
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sprememba gesla</CardTitle>
          <CardDescription>Izberite močno geslo, dolgo vsaj 12 znakov.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Trenutno geslo</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={changeMutation.isPending}
              />
            </div>
            
            <div className="pt-2 space-y-2">
              <Label htmlFor="newPassword">Novo geslo</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={changeMutation.isPending}
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
                disabled={changeMutation.isPending}
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="mt-4"
              disabled={changeMutation.isPending}
            >
              {changeMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Spremeni geslo
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}