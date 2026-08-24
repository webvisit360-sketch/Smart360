import { FormEvent, useLayoutEffect, useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TokenMode = "invite" | "reset";

function takeTokenFromAddressBar(): string {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token")?.trim() || "";
  url.searchParams.delete("token");
  const clean = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", clean);
  return token;
}

export function PasswordTokenPage({ mode }: { mode: TokenMode }) {
  const [, setLocation] = useLocation();
  // The initializer runs during the first render: the secret is copied into
  // memory once and removed from the visible/history URL before any effect.
  const [token] = useState(takeTokenFromAddressBar);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
    if (meta) meta.content = "no-referrer";
    document.title = mode === "invite" ? "Nastavite geslo · Smart360" : "Novo geslo · Smart360";
  }, [mode]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("Povezava ni veljavna ali je potekla.");
      return;
    }
    if (password !== confirm) {
      setError("Gesli se ne ujemata.");
      return;
    }
    setBusy(true);
    try {
      const endpoint =
        mode === "invite"
          ? "/api/admin/host/invite/confirm"
          : "/api/admin/host/reset/confirm";
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || "Povezava ni veljavna ali je potekla.");
      }
      setLocation("/admin/login");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Povezava ni veljavna ali je potekla.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#F5F5F7] flex items-center justify-center p-5">
      <section className="w-full max-w-md rounded-[22px] border bg-white p-[22px] shadow-sm">
        <div className="h-12 w-12 rounded-[14px] bg-primary text-primary-foreground flex items-center justify-center mb-5">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <p className="text-sm font-extrabold text-primary mb-2">Smart360</p>
        <h1 className="text-[26px] font-extrabold tracking-tight">
          {mode === "invite" ? "Nastavite geslo" : "Nastavite novo geslo"}
        </h1>
        <p className="text-muted-foreground mt-2 mb-6">
          {mode === "invite"
            ? "S tem enkratnim povabilom aktivirate svoj gostiteljski račun."
            : "Ponastavitev je enkratna. Po uspehu bodo vse prejšnje prijave odjavljene."}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Novo geslo</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Ponovite geslo</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-[14px] bg-destructive/10 text-destructive p-3 text-sm font-semibold">
              {error}
            </p>
          )}
          <Button className="w-full" type="submit" disabled={busy || !token}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "invite" ? "Aktiviraj račun" : "Shrani novo geslo"}
          </Button>
          {!token && (
            <p className="text-sm text-muted-foreground text-center">
              Povezava ni veljavna ali je že potekla. Zahtevajte novo.
            </p>
          )}
        </form>
      </section>
    </main>
  );
}