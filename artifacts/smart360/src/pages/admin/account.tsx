import { useState } from "react";
import { useLocation } from "wouter";
import { 
  useListPasskeys, 
  useRenamePasskey, 
  useDeletePasskey, 
  useGetAddPasskeyOptions, 
  useVerifyAddPasskey, 
  useRevokeAllSessions,
  useGetAdminSessionsStatus,
  useGetRecoveryCodeStatus,
  useRotateRecoveryCodes,
  useListAuthEvents, useGetAdminSession,
  getGetRecoveryCodeStatusQueryKey,
  getListAuthEventsQueryKey,
  useGetAdminPasswordStatus,
  useSetAdminPassword,
  getGetAdminPasswordStatusQueryKey,
} from "@workspace/api-client-react";
import { startRegistration } from "@simplewebauthn/browser";
import { AdminButton as Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminCard as Card, AdminCardContent as CardContent, CardDescription, AdminCardHeader as CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, LogOut, KeyRound, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useHostSession } from "@/hooks/use-host-session";
import { getListPasskeysQueryKey } from "@workspace/api-client-react";
import { recoveryCodeCountSl } from "@/lib/recovery-code-plural";


export default function AdminAccount() {
  const { data: session, isLoading: sessionLoading } = useGetAdminSession();
  const { data: hostSession, isLoading: hostLoading } = useHostSession();

  if (sessionLoading || hostLoading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isOwner = Boolean(session?.authenticated);

  if (isOwner) {
    return <OwnerAccount />;
  }

  return <HostAccount />;
}

function HostAccount() {
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const { toast } = useToast();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdCurrent || !pwdNew || !pwdConfirm) return;
    if (pwdNew !== pwdConfirm) {
      toast({ title: "Napaka", description: "Novi gesli se ne ujemata.", variant: "destructive" });
      return;
    }
    if (pwdNew.length < 12) {
      toast({ title: "Napaka", description: "Geslo mora biti dolgo vsaj 12 znakov.", variant: "destructive" });
      return;
    }
    setPwdBusy(true);
    try {
      const res = await fetch("/api/admin/host/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwdCurrent, newPassword: pwdNew }),
        credentials: "include"
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Sprememba gesla ni uspela.");
      }
      toast({ title: "Geslo spremenjeno", description: "Vaše geslo je bilo uspešno posodobljeno." });
      setPwdCurrent("");
      setPwdNew("");
      setPwdConfirm("");
    } catch (err: any) {
      toast({ title: "Napaka", description: err.message, variant: "destructive" });
    } finally {
      setPwdBusy(false);
    }
  };

  return (
    <div className="admin-page admin-page--form space-y-6" data-surface="admin">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Moj račun</h1>
          <p className="text-sm text-muted-foreground">Upravljanje nastavitev vašega računa</p>
        </div>
      </div>
      <Card data-testid="card-password-rotation">
        <CardHeader>
          <CardTitle>Sprememba gesla</CardTitle>
          <CardDescription>Zamenjajte svoje trenutno geslo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <Label htmlFor="pwd-current">Trenutno geslo</Label>
              <Input
                id="pwd-current"
                type="password"
                required
                autoComplete="current-password"
                value={pwdCurrent}
                onChange={(e) => setPwdCurrent(e.target.value)}
                data-testid="input-pwd-current"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwd-new">Novo geslo</Label>
              <Input
                id="pwd-new"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={pwdNew}
                onChange={(e) => setPwdNew(e.target.value)}
                data-testid="input-pwd-new"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwd-confirm">Ponovite novo geslo</Label>
              <Input
                id="pwd-confirm"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={pwdConfirm}
                onChange={(e) => setPwdConfirm(e.target.value)}
                data-testid="input-pwd-confirm"
              />
            </div>
            <Button type="submit" disabled={pwdBusy || !pwdCurrent || !pwdNew || !pwdConfirm} data-testid="button-submit-password-change">
              {pwdBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Spremeni geslo
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerAccount() {

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: passwordStatus } = useGetAdminPasswordStatus();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passwordMutation = useSetAdminPassword({
    mutation: {
      onSuccess: () => {
        toast({
          title: passwordStatus?.hasPassword ? "Geslo spremenjeno" : "Geslo nastavljeno",
          description: "Druge upravljavske seje so bile odjavljene.",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        queryClient.invalidateQueries({ queryKey: getGetAdminPasswordStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAuthEventsQueryKey() });
      },
      onError: (error: any) => {
        toast({
          title: "Gesla ni bilo mogoče shraniti",
          description: error?.data?.error ?? "Preverite vnesena gesla in poskusite znova.",
          variant: "destructive",
        });
      },
    },
  });

  const handleOwnerPassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Gesli se ne ujemata", variant: "destructive" });
      return;
    }
    passwordMutation.mutate({
      data: {
        newPassword,
        ...(passwordStatus?.hasPassword ? { currentPassword } : {}),
      },
    });
  };

  const { data: passkeyData, isLoading: isLoadingPasskeys } = useListPasskeys();
  
  const renameMutation = useRenamePasskey({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPasskeysQueryKey() })
    }
  });
  
  const deleteMutation = useDeletePasskey({
    mutation: {
      onSuccess: () => {
        toast({ title: "Ključ izbrisan", description: "Passkey je bil uspešno izbrisan." });
        queryClient.invalidateQueries({ queryKey: getListPasskeysQueryKey() });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || "Napaka pri brisanju ključa.";
        toast({ title: "Napaka", description: msg, variant: "destructive" });
      }
    }
  });

  const revokeMutation = useRevokeAllSessions({
    mutation: {
      onSuccess: (result) => {
        toast({
          title: "Seje odjavljene",
          description: `Preklicanih aktivnih sej: ${result.revokedCount}.`,
        });
        setLocation("/admin/login");
      }
    }
  });
  const { data: sessionsStatus, isLoading: sessionsLoading } = useGetAdminSessionsStatus();

  const getAddOptionsMutation = useGetAddPasskeyOptions();
  const verifyAddMutation = useVerifyAddPasskey();

  const [isAdding, setIsAdding] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isNormalizing, setIsNormalizing] = useState(false);

  // Recovery codes: counts always available, plaintext only right after rotation.
  const { data: codeStatus } = useGetRecoveryCodeStatus();
  const { data: authEvents, isLoading: isLoadingEvents } = useListAuthEvents();
  const [rotatedCodes, setRotatedCodes] = useState<string[] | null>(null);
  const rotateMutation = useRotateRecoveryCodes({
    mutation: {
      onSuccess: (res) => {
        setRotatedCodes(res.recoveryCodes);
        queryClient.invalidateQueries({ queryKey: getGetRecoveryCodeStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListPasskeysQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAuthEventsQueryKey() });
      },
      onError: () => {
        toast({ title: "Napaka", description: "Kod ni bilo mogoče zamenjati.", variant: "destructive" });
      },
    },
  });

  const copyRotatedCodes = () => {
    if (!rotatedCodes) return;
    navigator.clipboard.writeText(rotatedCodes.join("\n"));
    toast({ title: "Kopirano", description: "Kode so v odložišču. Shranite jih na varno mesto." });
  };

  const printRotatedCodes = () => {
    if (!rotatedCodes) return;
    const w = window.open("", "_blank", "width=600,height=700");
    if (!w) return;
    w.document.write(
      `<html><head><title>Smart360 — obnovitvene kode</title></head><body style="font-family:monospace;padding:2rem">` +
        `<h3 style="font-family:sans-serif">Smart360 — obnovitvene kode (${new Date().toLocaleDateString("sl-SI")})</h3>` +
        `<p style="font-family:sans-serif;font-size:12px">Vsaka koda deluje samo enkrat. Hranite na varnem mestu.</p>` +
        rotatedCodes.map((c) => `<div style="font-size:16px;line-height:2">${c}</div>`).join("") +
        `</body></html>`,
    );
    w.document.close();
    w.print();
  };

  const handleAddPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setIsAdding(true);

    try {
      const optionsRes = await getAddOptionsMutation.mutateAsync();
      const { challengeId, options } = optionsRes;

      const response = await startRegistration({ optionsJSON: options as any });

      await verifyAddMutation.mutateAsync({
        data: {
          challengeId,
          deviceName: newDeviceName.trim() || "Nova naprava",
          response: response as any,
        }
      });
      
      toast({ title: "Ključ dodan", description: "Nov passkey je bil uspešno dodan." });
      setNewDeviceName("");
      queryClient.invalidateQueries({ queryKey: getListPasskeysQueryKey() });
    } catch (err: any) {
      setAddError("Napaka pri dodajanju ključa. Preverite brskalnik in poskusite znova.");
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const saveEdit = (id: string) => {
    if (editName.trim()) {
      renameMutation.mutate({ id, data: { deviceName: editName.trim() } });
    }
    setEditingId(null);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("sl-SI", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="admin-page admin-page--form space-y-6" data-surface="admin">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Varnost in ključi</h1>
          <p className="text-sm text-muted-foreground">Upravljanje vaših dostopov s passkeyji in sej</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
              <LogOut className="w-4 h-4 mr-2" />
              Odjavi povsod{sessionsLoading ? "" : ` (${sessionsStatus?.activeCount ?? 0})`}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Odjava vseh sej</AlertDialogTitle>
              <AlertDialogDescription>
                Ali ste prepričani, da želite odjaviti vseh {sessionsStatus?.activeCount ?? 0} aktivnih sej?
                Odjavljeni boste iz vseh naprav, tudi te.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Prekliči</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => revokeMutation.mutate()} 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Da, odjavi vse
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Geslo upravljavca</CardTitle>
          <CardDescription>
            {passwordStatus?.hasPassword
              ? "Spremenite glavno geslo za prijavo Smart360 ekipe."
              : "Nastavite glavno geslo za prijavo Smart360 ekipe."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleOwnerPassword} className="space-y-4 max-w-sm">
            {passwordStatus?.hasPassword && (
              <div className="space-y-2">
                <Label htmlFor="owner-current-password">Trenutno geslo</Label>
                <Input
                  id="owner-current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="owner-new-password">Novo geslo</Label>
              <Input
                id="owner-new-password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={200}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner-confirm-password">Ponovite novo geslo</Label>
              <Input
                id="owner-confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={200}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={
                passwordMutation.isPending ||
                newPassword.length < 12 ||
                !confirmPassword ||
                Boolean(passwordStatus?.hasPassword && !currentPassword)
              }
            >
              {passwordMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {passwordStatus?.hasPassword ? "Spremeni geslo" : "Nastavi geslo"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Registrirani ključi (Passkeys)
          </CardTitle>
          <CardDescription>
            Tukaj so navedene vse naprave, s katerimi se lahko prijavite v administracijo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoadingPasskeys ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ime naprave</TableHead>
                      <TableHead>Ustvarjeno</TableHead>
                      <TableHead>Zadnja uporaba</TableHead>
                      <TableHead className="text-right">Dejanja</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {passkeyData?.credentials?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          Ni registriranih ključev.
                        </TableCell>
                      </TableRow>
                    ) : (
                      passkeyData?.credentials?.map(key => (
                        <TableRow key={key.id}>
                          <TableCell className="font-medium">
                            {editingId === key.id ? (
                              <div className="flex items-center gap-2">
                                <Input 
                                  value={editName} 
                                  onChange={e => setEditName(e.target.value)} 
                                  className="h-8 max-w-[200px]"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveEdit(key.id);
                                    if (e.key === 'Escape') setEditingId(null);
                                  }}
                                />
                                <Button size="sm" onClick={() => saveEdit(key.id)}>Shrani</Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 cursor-pointer group" onClick={() => startEdit(key.id, key.deviceName)}>
                                {key.deviceName}
                                <span className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground underline">Uredi</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDate(key.createdAt)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDate(key.lastUsedAt)}</TableCell>
                          <TableCell className="text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                                  Odstrani
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Odstranitev ključa</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Ali res želite odstraniti ključ "{key.deviceName}"? 
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Prekliči</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => deleteMutation.mutate({ id: key.id })}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Odstrani
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-muted p-4 rounded-lg flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm">Obnovitvene kode</h4>
                  <p className="text-xs text-muted-foreground">
                    Število neuporabljenih kod: <strong className="text-foreground">{passkeyData?.unusedRecoveryCodes || 0}</strong>
                  </p>
                </div>
                {(passkeyData?.unusedRecoveryCodes ?? 10) <= 5 && (
                  <div className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {recoveryCodeCountSl(passkeyData?.unusedRecoveryCodes ?? 0)}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="pt-4 border-t border-border">
            <h3 className="font-semibold mb-4">Dodaj novo napravo</h3>
            <form onSubmit={handleAddPasskey} className="flex items-end gap-4 max-w-md">
              <div className="space-y-2 flex-1">
                <Label htmlFor="newDeviceName">Ime naprave</Label>
                <Input
                  id="newDeviceName"
                  placeholder="npr. Službeni prenosnik"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  disabled={isAdding}
                />
              </div>
              <Button type="submit" disabled={isAdding}>
                {isAdding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Dodaj ključ
              </Button>
            </form>
            {addError && <p className="text-sm text-destructive mt-2">{addError}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Obnovitvene kode
          </CardTitle>
          <CardDescription>
            Kode so shranjene samo kot zgoščene vrednosti — prikažejo se natanko enkrat, ob zamenjavi.
            Vsaka koda deluje samo enkrat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Aktivnih kod: <strong>{codeStatus?.active ?? "—"}</strong>
            {" · "}Porabljenih: <strong>{codeStatus?.consumed ?? "—"}</strong>
          </p>

          {rotatedCodes ? (
            <div className="space-y-3 border border-destructive/30 rounded-lg p-4">
              <p className="text-sm font-semibold text-destructive flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Te kode so prikazane SAMO ENKRAT. Zapišite jih na papir ali natisnite.
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {rotatedCodes.map((c) => (
                  <div key={c} className="bg-muted rounded px-2 py-1">{c}</div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyRotatedCodes}>Kopiraj vse</Button>
                <Button variant="outline" size="sm" onClick={printRotatedCodes}>Natisni</Button>
                <Button size="sm" onClick={() => setRotatedCodes(null)}>Shranil sem jih — skrij</Button>
              </div>
            </div>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={rotateMutation.isPending}>
                  {rotateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Zamenjaj in prikaži enkrat
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Zamenjava obnovitvenih kod</AlertDialogTitle>
                  <AlertDialogDescription>
                    VSE obstoječe kode bodo takoj razveljavljene in ustvarjenih bo 10 novih.
                    Nove kode se prikažejo samo enkrat — pripravite papir ali tiskalnik.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Prekliči</AlertDialogCancel>
                  <AlertDialogAction onClick={() => rotateMutation.mutate()}>
                    Zamenjaj kode
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revizijska sled prijav</CardTitle>
          <CardDescription>Zadnji varnostni dogodki (prijave, obnovitve, zamenjave kod).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingEvents ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-md max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Čas</TableHead>
                    <TableHead>Dogodek</TableHead>
                    <TableHead>Podrobnost</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!authEvents?.events?.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        Ni zabeleženih dogodkov.
                      </TableCell>
                    </TableRow>
                  ) : (
                    authEvents.events.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(e.createdAt)}</TableCell>
                        <TableCell className="text-sm">{e.type}</TableCell>
                        <TableCell className="text-sm">{e.detail ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.ip ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vzdrževanje</CardTitle>
          <CardDescription>
            Enkratna normalizacija oblikovanja besedil: vsa obstoječa vsebina in prevodi gredo
            skozi isti čistilec kot pri shranjevanju (npr. &lt;b&gt; → &lt;strong&gt;). Varno
            ponoviti — drugi zagon ne spremeni ničesar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            disabled={isNormalizing}
            onClick={async () => {
              setIsNormalizing(true);
              try {
                const res = await fetch("/api/admin/maintenance/normalize-content", {
                  method: "POST",
                  credentials: "include",
                });
                if (!res.ok) throw new Error(String(res.status));
                const data = await res.json();
                toast({
                  title: "Normalizacija končana",
                  description: `Spremenjenih polj: ${data.count}. Podrobnosti so v dnevniku sprememb.`,
                });
              } catch {
                toast({ title: "Napaka", description: "Normalizacija ni uspela.", variant: "destructive" });
              } finally {
                setIsNormalizing(false);
              }
            }}
          >
            {isNormalizing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Normaliziraj oblikovanje besedil
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}