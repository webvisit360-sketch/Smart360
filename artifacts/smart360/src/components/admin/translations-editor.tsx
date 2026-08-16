// Zavihek "Prevodi": EN·DE·IT prevodi vsebine in UI nizov.
// Dvokolonski urejevalnik (izvirnik levo, prevod desno), pokritost "142/272",
// filter vse / manjka / izvirnik se je spremenil, uvoz/izvoz JSON.
import { useMemo, useRef, useState } from "react";
import {
  useListTenantTranslations,
  useGetTranslationOverview,
  useUpsertTranslation,
  useImportTranslations,
  exportTranslations,
  getListTenantTranslationsQueryKey,
  getGetTranslationOverviewQueryKey,
  type TranslationEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download, Upload, Check } from "lucide-react";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const LANGS = [
  { code: "en", label: "Angleščina (EN)" },
  { code: "de", label: "Nemščina (DE)" },
  { code: "it", label: "Italijanščina (IT)" },
];

type Filter = "vse" | "manjka" | "spremenjen";

export function TranslationsEditor({ tenantId }: { tenantId: string }) {
  const [lang, setLang] = useState("en");
  const [filter, setFilter] = useState<Filter>("vse");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: overview } = useGetTranslationOverview(tenantId, {
    query: { enabled: !!tenantId, queryKey: getGetTranslationOverviewQueryKey(tenantId) },
  });
  const { data: entries, isLoading } = useListTenantTranslations(
    tenantId,
    { lang },
    { query: { enabled: !!tenantId, queryKey: getListTenantTranslationsQueryKey(tenantId, { lang }) } }
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTenantTranslationsQueryKey(tenantId, { lang }) });
    queryClient.invalidateQueries({ queryKey: getGetTranslationOverviewQueryKey(tenantId) });
  };

  const upsert = useUpsertTranslation({
    mutation: {
      onSuccess: invalidate,
      onError: () => toast({ title: "Napaka", description: "Prevoda ni bilo mogoče shraniti.", variant: "destructive" }),
    },
  });

  const importMutation = useImportTranslations({
    mutation: {
      onSuccess: (report) => {
        invalidate();
        toast({
          title: "Uvoz končan",
          description: `Zapisano: ${report.set} · preskočeno (neznani ključi): ${report.skippedUnknown} · nespremenjeno: ${report.unchanged} · ohranjeni ročni prevodi: ${report.kept}`,
        });
      },
      onError: () => toast({ title: "Napaka", description: "Uvoz ni uspel. Preverite obliko datoteke.", variant: "destructive" }),
    },
  });

  const filtered = useMemo(() => {
    const list = entries ?? [];
    if (filter === "manjka") return list.filter((e) => !e.value);
    if (filter === "spremenjen") return list.filter((e) => e.stale);
    return list;
  }, [entries, filter]);

  const ov = overview?.find((o) => o.lang === lang);

  const handleExport = async () => {
    try {
      const data = await exportTranslations(tenantId, { lang });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `prevodi-${lang}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast({ title: "Napaka", description: "Izvoz ni uspel.", variant: "destructive" });
    }
  };

  const handleImportFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || !parsed.lang) throw new Error("bad");
      if (parsed.lang !== lang) {
        toast({
          title: "Napačen jezik",
          description: `Datoteka je za "${parsed.lang}", odprt pa je zavihek "${lang}". Preklopite zavihek ali izberite drugo datoteko.`,
          variant: "destructive",
        });
        return;
      }
      importMutation.mutate({ id: tenantId, data: parsed });
    } catch {
      toast({ title: "Napaka", description: "Datoteka ni veljaven JSON s prevodi.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={lang} onValueChange={setLang}>
          <TabsList>
            {LANGS.map((l) => (
              <TabsTrigger key={l.code} value={l.code}>{l.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {ov && (
          <span className="text-sm text-muted-foreground">
            Prevedeno {ov.translated}/{ov.total}
            {ov.stale > 0 && <span className="text-amber-600"> · {ov.stale} zastarelih</span>}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" /> Izvozi JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importMutation.isPending}>
            {importMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Uvozi JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void handleImportFile(f);
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {([
          ["vse", "Vse"],
          ["manjka", "Manjka prevod"],
          ["spremenjen", "Izvirnik se je spremenil"],
        ] as [Filter, string][]).map(([val, label]) => (
          <Button key={val} variant={filter === val ? "default" : "outline"} size="sm" onClick={() => setFilter(val)}>
            {label}
          </Button>
        ))}
        <span className="text-muted-foreground ml-2">{filtered.length} vrstic</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          {filter === "vse" ? "Ni vsebine za prevajanje." : "Ni vrstic za izbrani filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <TranslationRow
              // Row identity includes the language AND the server value, so a
              // tab switch or an import refetch re-initializes the draft
              // instead of showing a stale one from another language.
              key={`${lang}:${entry.key}:${entry.value ?? ""}`}
              entry={entry}
              saving={upsert.isPending}
              onSave={(value) =>
                upsert.mutate({
                  data: { model: entry.model, recordId: entry.recordId, field: entry.field, lang, value },
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TranslationRow({
  entry,
  saving,
  onSave,
}: {
  entry: TranslationEntry;
  saving: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(entry.value ?? "");
  const dirty = value !== (entry.value ?? "");

  return (
    <Card className={entry.stale ? "border-amber-400" : undefined}>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <code className="bg-muted px-1.5 py-0.5 rounded">{entry.key}</code>
          {entry.stale && <span className="text-amber-600 font-medium">izvirnik se je spremenil</span>}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="text-sm bg-muted/50 rounded-md p-3">
            {entry.rich ? (
              <div dangerouslySetInnerHTML={{ __html: entry.source }} className="prose prose-sm max-w-none" />
            ) : (
              <span className="whitespace-pre-wrap">{entry.source}</span>
            )}
          </div>
          <div className="space-y-2">
            {entry.rich ? (
              <RichTextEditor value={value} onChange={setValue} placeholder="Prevod ..." />
            ) : (
              <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Prevod ..."
                rows={Math.min(6, Math.max(1, Math.ceil(entry.source.length / 60)))}
              />
            )}
            {dirty && (
              <Button size="sm" onClick={() => onSave(value)} disabled={saving || !value.trim()}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Shrani prevod
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
