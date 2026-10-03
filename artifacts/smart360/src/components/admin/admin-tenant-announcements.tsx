import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetTenantAnnouncementsQueryKey,
  useGetTenantAnnouncements, useCreateTenantAnnouncement,
  useUpdateTenantAnnouncement, useDeleteTenantAnnouncement,
  useUploadTenantAnnouncementImage, type AnnouncementResult,
} from "@workspace/api-client-react";
import { Bell, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { AdminButton as Button } from "@/components/ui/button";
import { AdminCard as Card, AdminCardContent as CardContent, AdminCardHeader as CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ANNOUNCEMENT_LANGUAGES, ANNOUNCEMENT_TIME_ZONE,
  announcementAdminStatus, announcementAdminTitle, announcementDraft,
  announcementSavePayload, announcementWallClockCandidates,
  type AdminAnnouncement, type AnnouncementDraft,
} from "@/lib/announcements-admin-model";

import { LANGUAGE_REGISTRY } from "@workspace/guide-languages";
const languageNames = Object.fromEntries(LANGUAGE_REGISTRY.map(l => [l.code[0].toUpperCase() + l.code.slice(1), l.name]));
const formatDate = (date: string) => new Intl.DateTimeFormat("sl-SI", {
  timeZone: ANNOUNCEMENT_TIME_ZONE, dateStyle: "medium", timeStyle: "short",
}).format(new Date(date));

/** Runtime editor: its mutations never save/publish a guide draft. */
export function AdminTenantAnnouncements({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const queryKey = getGetTenantAnnouncementsQueryKey(tenantId);
  const [editing, setEditing] = useState<AdminAnnouncement | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const [operationError, setOperationError] = useState("");
  const [clock, setClock] = useState(Date.now);
  const form = useForm<AnnouncementDraft>({ defaultValues: announcementDraft() });
  const query = useGetTenantAnnouncements(tenantId, {
    query: {
      queryKey, enabled: Boolean(tenantId), staleTime: 0,
      refetchInterval: 30_000, refetchOnWindowFocus: true,
    },
    request: { credentials: "include", cache: "no-store" },
  });
  const rows = query.data?.announcements ?? [];
  const editingRow = editing && editing !== "new" ? editing : undefined;
  const draft = form.watch();
  const isDirty = form.formState.isDirty;
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);
  const saved = ({ announcement }: AnnouncementResult) => {
    queryClient.setQueryData<{ announcements: AdminAnnouncement[] }>(queryKey, (previous) => ({
      announcements: [announcement, ...(previous?.announcements ?? []).filter((row) => row.id !== announcement.id)]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    }));
    void queryClient.invalidateQueries({ queryKey });
    form.reset(announcementDraft());
    setEditing(null);
    setOperationError("");
    setNotice("Obvestilo je shranjeno. Veljavna obvestila so gostom vidna takoj.");
  };
  const createMutation = useCreateTenantAnnouncement({
    mutation: {
      mutationKey: ["admin-announcements", "create", tenantId],
      onSuccess: saved,
      onError: (error) => setOperationError(error.message),
    },
    request: { credentials: "include", cache: "no-store" },
  });
  const updateMutation = useUpdateTenantAnnouncement({
    mutation: {
      mutationKey: ["admin-announcements", "update", tenantId],
      onSuccess: saved,
      onError: (error) => setOperationError(error.message),
    },
    request: { credentials: "include", cache: "no-store" },
  });
  const deleteMutation = useDeleteTenantAnnouncement({
    mutation: {
      mutationKey: ["admin-announcements", "delete", tenantId],
      onSuccess: (_response, { announcementId }) => {
        queryClient.setQueryData<{ announcements: AdminAnnouncement[] }>(queryKey, (previous) => ({
          announcements: (previous?.announcements ?? []).filter((row) => row.id !== announcementId),
        }));
        void queryClient.invalidateQueries({ queryKey });
        if (editingRow?.id === announcementId) {
          form.reset(announcementDraft());
          setEditing(null);
        }
        setOperationError("");
        setNotice("Obvestilo je izbrisano in ni več vidno gostom.");
      },
      onError: (error) => setOperationError(error.message),
    },
    request: { credentials: "include", cache: "no-store" },
  });
  const imageMutation = useUploadTenantAnnouncementImage({
    mutation: {
      mutationKey: ["admin-announcements", "image", tenantId],
      onSuccess: ({ imageUrl }) => {
        form.setValue("imageUrl", imageUrl, { shouldDirty: true });
        setOperationError("");
      },
      onError: (error) => setOperationError(`Nalaganje slike ni uspelo: ${error.message}`),
    },
    request: { credentials: "include", cache: "no-store" },
  });
  const saving = createMutation.isPending || updateMutation.isPending;
  const busy = saving || deleteMutation.isPending || imageMutation.isPending;
  const openEditor = (row: AdminAnnouncement | "new") => {
    if (isDirty && !window.confirm("Zavržem neshranjene spremembe obvestila?")) return;
    form.reset(announcementDraft(row === "new" ? undefined : row));
    setEditing(row);
    setOperationError("");
    setNotice("");
  };
  const closeEditor = () => {
    if (isDirty && !window.confirm("Zavržem neshranjene spremembe obvestila?")) return;
    form.reset(announcementDraft());
    setEditing(null);
    setOperationError("");
  };
  const save = form.handleSubmit((values) => {
    try {
      // Validate before touching the network; a rejected save keeps every field.
      const data = announcementSavePayload(values, editingRow);
      setOperationError("");
      if (editingRow) updateMutation.mutate({ tenantId, announcementId: editingRow.id, data });
      else createMutation.mutate({ tenantId, data });
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Preverite podatke obvestila.");
    }
  });
  return (
    <section className="space-y-5" data-testid="admin-announcements-editor">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold flex items-center gap-2"><Bell className="h-5 w-5" />Obvestila</h2>
          <p className="mt-1 text-sm text-muted-foreground">Živa obvestila za goste v Living Guide.</p>
        </div>
        <Button onClick={() => openEditor("new")} disabled={busy} data-testid="button-announcement-create">
          <Plus className="h-4 w-4 mr-2" />Novo obvestilo
        </Button>
      </div>
      <p className="rounded-xl border border-[#157347]/20 bg-[#157347]/5 p-4 text-sm font-semibold" data-testid="text-announcements-live-notice">
        Obvestilo je vidno gostom takoj po shranjevanju.
      </p>
      {notice && <p role="status" className="text-sm text-[#157347]" data-testid="status-announcement-saved">{notice}</p>}
      {operationError && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" data-testid="error-announcement-operation">{operationError}</p>}
      {editing && (
        <Card data-testid="form-announcement-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{editing === "new" ? "Novo obvestilo" : "Uredi obvestilo"}</CardTitle>
            <Button variant="ghost" size="icon" onClick={closeEditor} disabled={busy} aria-label="Zapri urejanje" data-testid="button-announcement-close"><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={save} className="space-y-5" data-testid="form-announcement">
                <fieldset disabled={busy} className="space-y-5">
                  <p className="text-sm text-muted-foreground">Naslov in besedilo vnesite vsaj v enem jeziku. Gost vidi izbrani jezik, sicer prvi izpolnjeni jezik (SL, EN, DE, IT).</p>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {ANNOUNCEMENT_LANGUAGES.map((language) => (
                      <fieldset key={language} className="space-y-3 rounded-xl border p-4">
                        <legend className="px-1 text-sm font-bold">{languageNames[language]}</legend>
                        <FormField control={form.control} name={`title${language}`} render={({ field }) => (
                          <FormItem><FormLabel>Naslov ({language.toUpperCase()})</FormLabel>
                            <Input {...field} maxLength={250} data-testid={`input-announcement-title-${language.toLowerCase()}`} />
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name={`body${language}`} render={({ field }) => (
                          <FormItem><FormLabel>Besedilo ({language.toUpperCase()})</FormLabel>
                            <Textarea {...field} rows={5} maxLength={20000} data-testid={`input-announcement-body-${language.toLowerCase()}`} />
                            <FormMessage /></FormItem>
                        )} />
                      </fieldset>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {(["validFrom", "validTo"] as const).map((name) => {
                      const occurrence = name === "validFrom" ? "fromOccurrence" : "toOccurrence";
                      const ambiguous = announcementWallClockCandidates(draft[name]).length > 1;
                      return (
                        <div key={name} className="space-y-2">
                          <FormField control={form.control} name={name} render={({ field }) => (
                            <FormItem><FormLabel>{name === "validFrom" ? "Velja od" : "Velja do (neobvezno)"} · Europe/Ljubljana</FormLabel>
                              <Input {...field} type="datetime-local" required={name === "validFrom"} data-testid={`input-announcement-${name}`} />
                              <FormMessage /></FormItem>
                          )} />
                          {ambiguous && <FormField control={form.control} name={occurrence} render={({ field }) => (
                            <FormItem><FormLabel>Ura se ob prehodu na zimski čas ponovi. Izberite pojavitev.</FormLabel>
                              <select {...field} className="w-full rounded-md border bg-background px-3 py-2 text-sm" data-testid={`select-announcement-${occurrence}`}>
                                <option value="earlier">Prva pojavitev (poletni čas, UTC+2)</option>
                                <option value="later">Druga pojavitev (zimski čas, UTC+1)</option>
                              </select><FormMessage /></FormItem>
                          )} />}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">Brez končnega datuma obvestilo velja do izbrisa. Potekla obvestila gostom samodejno izginejo.</p>
                  <div className="space-y-3 rounded-xl border p-4">
                    <p className="text-sm font-bold">Slika (neobvezno)</p>
                    <label className="block text-sm font-medium" htmlFor="announcement-image-file">
                      <span className="flex items-center gap-2 mb-2"><ImagePlus className="h-4 w-4" />Naloži fotografijo</span>
                      <Input id="announcement-image-file" type="file" accept="image/*" data-testid="input-announcement-image-file"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) imageMutation.mutate({ tenantId, data: { file } });
                          event.target.value = "";
                        }} />
                    </label>
                    {imageMutation.isPending && <p role="status" className="text-sm">Nalaganje slike …</p>}
                    <FormField control={form.control} name="imageUrl" render={({ field }) => (
                      <FormItem><FormLabel>URL slike</FormLabel><Input {...field} maxLength={2000} data-testid="input-announcement-image-url" /><FormMessage /></FormItem>
                    )} />
                    {draft.imageUrl && <div className="flex flex-wrap items-start gap-3">
                      <img src={draft.imageUrl} alt="Predogled slike obvestila" className="max-h-40 max-w-full rounded-xl object-cover" data-testid="img-announcement-preview" />
                      <Button type="button" variant="outline" onClick={() => form.setValue("imageUrl", "", { shouldDirty: true })} data-testid="button-announcement-image-remove">Odstrani sliko</Button>
                    </div>}
                  </div>
                </fieldset>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={busy} data-testid="button-announcement-save">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Shrani obvestilo
                  </Button>
                  <Button type="button" variant="outline" onClick={closeEditor} disabled={busy} data-testid="button-announcement-cancel">Prekliči</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
      {query.isLoading ? (
        <p role="status" className="flex items-center gap-2 text-sm" data-testid="status-announcements-loading"><Loader2 className="h-4 w-4 animate-spin" />Nalagam obvestila …</p>
      ) : query.error ? (
        <div role="alert" className="space-y-2" data-testid="error-announcements-load">
          <p className="text-sm">Obvestil ni mogoče naložiti: {query.error.message}</p>
          <Button variant="outline" onClick={() => void query.refetch()} data-testid="button-announcements-retry">Poskusi znova</Button>
        </div>
      ) : (
        <div className="space-y-3" data-testid="list-admin-announcements">
          {!rows.length && <p className="rounded-xl border p-6 text-sm text-muted-foreground" data-testid="empty-admin-announcements">Za to nastanitev še ni obvestil.</p>}
          {rows.map((row) => (
            <Card key={row.id} data-testid={`card-admin-announcement-${row.id}`}>
              <CardContent className="p-4 flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 gap-3">
                  {row.imageUrl && <img src={row.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
                  <div className="min-w-0">
                    <h3 className="font-bold break-words" data-testid={`text-announcement-title-${row.id}`}>{announcementAdminTitle(row)}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Objavljeno: {formatDate(row.createdAt)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Velja od: {formatDate(row.validFrom)}{row.validTo ? ` · do: ${formatDate(row.validTo)}` : " · brez končnega datuma"}</p>
                    <p className="mt-2 text-xs font-semibold" data-testid={`status-announcement-${row.id}`}>{announcementAdminStatus(row, clock)}</p>
                  </div>
                </div>
                {!row.deletedAt && <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => openEditor(row)} data-testid={`button-announcement-edit-${row.id}`}>Uredi</Button>
                  <Button variant="outline" size="sm" disabled={busy} data-testid={`button-announcement-delete-${row.id}`} onClick={() => {
                    if (window.confirm(`Izbrišem obvestilo »${announcementAdminTitle(row)}«? Gostom bo takoj skrito.`)) {
                      setOperationError("");
                      deleteMutation.mutate({ tenantId, announcementId: row.id });
                    }
                  }}><Trash2 className="h-4 w-4 mr-1" />Izbriši</Button>
                </div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}