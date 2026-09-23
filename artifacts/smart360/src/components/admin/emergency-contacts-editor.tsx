import { useEffect, useMemo, useRef, useState } from "react";
import {
  listTranslations,
  getGetTenantEmergencyContactsQueryKey,
  upsertTranslation,
  useGetTenantEmergencyContacts,
  useTranslateMissingItemFields,
  useUpdateTenantEmergencyContacts,
} from "@workspace/api-client-react";
import { Languages, Loader2, Plus } from "lucide-react";
import { AdminButton as Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { refreshTenantAfterAdminWrite } from "@/lib/tenant-publication-state";

type ContactRow = {
  key: string;
  id?: string;
  title: string;
  phone: string;
};

function normalized(rows: ContactRow[]) {
  return rows.map(({ id, title, phone }) => ({ id, title, phone }));
}

export function EmergencyContactsEditor({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const translateMissing = useTranslateMissingItemFields();
  const contactsQuery = useGetTenantEmergencyContacts(tenantId, {
    query: { retry: false, queryKey: getGetTenantEmergencyContactsQueryKey(tenantId) },
    request: { cache: "no-store" },
  });
  const updateContacts = useUpdateTenantEmergencyContacts();
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [baseline, setBaseline] = useState("[]");
  const [saving, setSaving] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const dirty = useMemo(
    () => JSON.stringify(normalized(rows)) !== baseline,
    [baseline, rows],
  );

  useEffect(() => {
    if (!contactsQuery.data) return;
    const loaded = contactsQuery.data.rows.map((row) => ({ ...row, key: row.id }));
    setRows(loaded);
    setBaseline(JSON.stringify(normalized(loaded)));
  }, [contactsQuery.data]);

  const addRow = () => {
    const key = crypto.randomUUID();
    setRows((current) => [...current, { key, title: "", phone: "" }]);
    requestAnimationFrame(() => inputRefs.current.get(key)?.focus());
  };

  const save = async () => {
    if (rows.some((row) => !row.title.trim() || !row.phone.trim())) {
      toast({
        title: "Dopolnite kontakte",
        description: "Vsak kontakt potrebuje naziv in telefonsko številko.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const data = await updateContacts.mutateAsync({
        id: tenantId,
        data: { rows: normalized(rows) },
      });
      const saved = data.rows.map((row) => ({ ...row, key: row.id }));
      setRows(saved);
      setBaseline(JSON.stringify(normalized(saved)));
      await refreshTenantAfterAdminWrite(queryClient, tenantId);
      toast({
        title: "Kontakti so shranjeni",
        description: "Spremembe so v osnutku. Za prikaz gostom jih objavite.",
      });
    } catch (error) {
      toast({
        title: "Shranjevanje ni uspelo",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const translateTitle = async (row: ContactRow) => {
    if (!row.id || dirty) return;
    setTranslatingId(row.id);
    try {
      const existing = await listTranslations({ model: "item", recordId: row.id });
      const manualTitles = existing.filter((entry) =>
        entry.field === "title" && entry.lang !== "sl" && entry.value.trim());
      if (manualTitles.length && !confirm(
        `Obstoječi prevodi naziva (${manualTitles.map((entry) => entry.lang.toUpperCase()).join(", ")}) bodo zamenjani. Želite nadaljevati?`,
      )) return;
      const result = await translateMissing.mutateAsync({
        id: row.id,
        data: {
          translations: [
            { language: "sl", title: row.title, description: "" },
            { language: "en", title: "", description: "" },
            { language: "de", title: "", description: "" },
            { language: "it", title: "", description: "" },
          ],
        },
      });
      await Promise.all(result.translations
        .filter((entry) => entry.language !== "sl" && entry.title)
        .map((entry) => upsertTranslation({
          model: "item",
          recordId: row.id!,
          field: "title",
          lang: entry.language,
          value: entry.title!,
        })));
      await refreshTenantAfterAdminWrite(queryClient, tenantId);
      toast({
        title: "Naziv je preveden",
        description: "Prevodi so shranjeni v osnutku.",
      });
    } catch (error) {
      toast({
        title: "Prevajanje ni uspelo",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setTranslatingId(null);
    }
  };

  if (contactsQuery.isLoading) {
    return <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Nalagam kontakte …</div>;
  }
  if (contactsQuery.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm font-semibold text-destructive">Kontaktov ni bilo mogoče naložiti.</p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => void contactsQuery.refetch()}>
          Poskusi znova
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="text-sm font-semibold">Enotna evropska številka za klic v sili</p>
          <p className="mt-1 text-xl font-extrabold">112</p>
        </div>
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="text-sm font-semibold">Policija</p>
          <p className="mt-1 text-xl font-extrabold">113</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Številki 112 in 113 sta vedno prikazani in se ne shranjujeta med podatke namestitve.
      </p>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.key} className="grid items-end gap-3 rounded-xl border p-3 md:grid-cols-[1fr_1fr_auto_auto]">
            <div className="space-y-1.5">
              <Label htmlFor={`emergency-title-${row.key}`}>Naziv kontakta</Label>
              <Input
                id={`emergency-title-${row.key}`}
                ref={(node) => {
                  if (node) inputRefs.current.set(row.key, node);
                  else inputRefs.current.delete(row.key);
                }}
                value={row.title}
                disabled={saving}
                onChange={(event) => setRows((current) => current.map((entry, at) =>
                  at === index ? { ...entry, title: event.target.value } : entry))}
                placeholder="npr. Dežurni zdravnik"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`emergency-phone-${row.key}`}>Telefon</Label>
              <Input
                id={`emergency-phone-${row.key}`}
                type="tel"
                value={row.phone}
                disabled={saving}
                onChange={(event) => setRows((current) => current.map((entry, at) =>
                  at === index ? { ...entry, phone: event.target.value } : entry))}
                placeholder="+386 …"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving || !row.id || dirty || translatingId !== null}
              onClick={() => void translateTitle(row)}
              title={dirty ? "Najprej shranite spremembe." : "Prevedi naziv v jezike vodnika"}
            >
              {translatingId === row.id
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Languages className="mr-2 h-4 w-4" />}
              Prevedi naziv
            </Button>
            <button
              type="button"
              className="h-9 px-2 text-xl text-muted-foreground hover:text-foreground"
              aria-label={`Odstrani kontakt ${row.title || index + 1}`}
              disabled={saving}
              onClick={() => setRows((current) => current.filter((_, at) => at !== index))}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={saving} onClick={addRow}>
          <Plus className="mr-2 h-4 w-4" /> Dodaj kontakt
        </Button>
        <Button type="button" disabled={!dirty || saving || translatingId !== null} onClick={() => void save()}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Shrani kontakte
        </Button>
        {dirty && <span className="text-xs font-medium text-amber-700">Neshranjene spremembe</span>}
      </div>
    </div>
  );
}