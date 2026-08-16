import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createSection,
  updateSection,
  deleteSection,
  createCategory,
  updateCategory,
  deleteCategory,
  createItem,
  updateItem,
  deleteItem,
  getGetTenantQueryKey,
  useGetTrash,
  restoreCategory,
  restoreItem,
  purgeCategory,
  purgeItem,
  getGetTrashQueryKey,
} from "@workspace/api-client-react";
import { Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronRight, EyeOff, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ItemMediaEditor } from "@/components/admin/item-media-editor";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

// ---------- Types ----------

type MediaEntry = { id: string; url: string; alt?: string | null; position: number };

type Item = {
  id: string;
  title?: string | null;
  body?: string | null;
  price?: string | null;
  priceUnit?: string | null;
  phone?: string | null;
  isVisible: boolean;
  position: number;
  media: MediaEntry[];
};

type Category = {
  id: string;
  label: string;
  icon: string;
  layout: string;
  isVisible: boolean;
  position: number;
  items?: Item[];
};

type Section = {
  id: string;
  key: string;
  title: string;
  subtitle?: string | null;
  icon: string;
  isVisible: boolean;
  position: number;
  categories?: Category[];
};

// ---------- Layout options ----------

const LAYOUT_OPTIONS = [
  { value: "text", label: "Besedilo (text)" },
  { value: "poi", label: "Točke interesa (poi)" },
  { value: "routes", label: "Poti (routes)" },
  { value: "products", label: "Izdelki / ponudba (products)" },
  { value: "svcs", label: "Storitve (svcs)" },
  { value: "tabs", label: "Zavihki (tabs)" },
  { value: "rules", label: "Pravila (rules)" },
  { value: "wifi", label: "WiFi (wifi)" },
];

// ---------- Helper ----------

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[čć]/g, "c")
    .replace(/[šś]/g, "s")
    .replace(/[žź]/g, "z")
    .replace(/[đ]/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// ---------- Character budgets (warn only, never block) ----------

const BUDGET = {
  categoryLabel: 28,
  categorySublabel: 42,
  itemTitle: 48,
};

const TRUNCATE_HINT = "Daljše besedilo se lahko na telefonu odreže.";

function CharCounter({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const over = len > max;
  return (
    <p className={`text-xs ${over ? "text-destructive font-medium" : len > max * 0.85 ? "text-amber-600" : "text-muted-foreground"}`}>
      {len}/{max}
      {over && <span className="ml-1">— {TRUNCATE_HINT}</span>}
    </p>
  );
}

// ---------- Autosave drafts ----------

function draftKey(entityType: string, id: string): string {
  return `s360:draft:${entityType}:${id}`;
}

/**
 * Persists form state to localStorage (debounced) while a dialog is open.
 * Returns a restored draft (if any & differs from stored values) and helpers.
 */
function useDraft<T extends Record<string, unknown>>(
  entityType: string,
  id: string,
  current: T,
  baseline: T,
) {
  const key = draftKey(entityType, id);
  const [restored, setRestored] = useState<T | null>(null);
  const [checked, setChecked] = useState(false);

  // On mount, check for an existing draft that differs from the baseline.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        if (JSON.stringify(parsed) !== JSON.stringify(baseline)) {
          setRestored(parsed);
        }
      }
    } catch {
      // ignore malformed drafts
    }
    setChecked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Debounced save of current form state.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!checked) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        if (JSON.stringify(current) === JSON.stringify(baseline)) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, JSON.stringify(current));
        }
      } catch {
        // ignore quota errors
      }
    }, 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [current, baseline, key, checked]);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    setRestored(null);
  }, [key]);

  const discardRestored = useCallback(() => {
    setRestored(null);
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, [key]);

  return { restored, clear, discardRestored };
}

function DraftNotice({ onDiscard }: { onDiscard: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <span>Obnovljen neshranjen osnutek</span>
      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-amber-800 hover:text-amber-900" onClick={onDiscard}>
        Zavrzi
      </Button>
    </div>
  );
}

// ==========================================
// Section Dialog
// ==========================================

type SectionDialogProps =
  | { mode: "create"; tenantId: string; section?: undefined; onDone: () => void }
  | { mode: "edit"; tenantId: string; section: Section; onDone: () => void };

function SectionDialog({ mode, tenantId, section, onDone }: SectionDialogProps) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState(section?.title ?? "");
  const [icon, setIcon] = useState(section?.icon ?? "");
  const [subtitle, setSubtitle] = useState(section?.subtitle ?? "");
  const [key, setKey] = useState(section?.key ?? "");
  const [isVisible, setIsVisible] = useState(section?.isVisible ?? true);

  const baseline = {
    title: section?.title ?? "",
    icon: section?.icon ?? "",
    subtitle: section?.subtitle ?? "",
    key: section?.key ?? "",
    isVisible: section?.isVisible ?? true,
  };
  const current = { title, icon, subtitle, key, isVisible };
  const { restored, clear, discardRestored } = useDraft(
    "section",
    mode === "edit" ? section.id : "new",
    current,
    baseline,
  );

  useEffect(() => {
    if (restored) {
      setTitle(restored.title);
      setIcon(restored.icon);
      setSubtitle(restored.subtitle);
      setKey(restored.key);
      setIsVisible(restored.isVisible);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetTenantQueryKey(tenantId) });

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const trimmedKey = key.trim() || slugify(trimmedTitle);
    if (!trimmedTitle || !trimmedKey || !icon.trim()) {
      alert("Naslov, ključ in ikona so obvezni.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "create") {
        await createSection(tenantId, {
          title: trimmedTitle,
          key: trimmedKey,
          icon: icon.trim(),
          subtitle: subtitle.trim() || undefined,
        });
      } else {
        await updateSection(section.id, {
          title: trimmedTitle,
          key: trimmedKey,
          icon: icon.trim(),
          subtitle: subtitle.trim() || null,
          isVisible,
        });
      }
      clear();
      await refresh();
      onDone();
    } catch {
      alert("Shranjevanje ni uspelo.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    clear();
    onDone();
  };

  useReportDirty(JSON.stringify(current) !== JSON.stringify(baseline));

  const handleDelete = async () => {
    if (!section) return;
    if (!confirm(`Izbrišem sekcijo "${section.title}"? Vse kategorije in vnosi v njej bodo trajno izbrisani.`)) return;
    setBusy(true);
    try {
      await deleteSection(section.id);
      clear();
      await refresh();
      onDone();
    } catch {
      alert("Brisanje ni uspelo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <DialogScrollBody>
      {restored && <DraftNotice onDiscard={discardRestored} />}
      <div className="grid grid-cols-[1fr_80px] gap-3">
        <div className="space-y-1">
          <Label>Naslov *</Label>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (mode === "create") setKey(slugify(e.target.value));
            }}
            placeholder="npr. Informacije"
            disabled={busy}
          />
        </div>
        <div className="space-y-1">
          <Label>Ikona *</Label>
          <Input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🏠"
            disabled={busy}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Ključ (slug)</Label>
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="informacije"
          disabled={busy}
        />
        <p className="text-xs text-muted-foreground">Enolični identifikator za sekcijo (male črke, brez presledkov).</p>
      </div>
      <div className="space-y-1">
        <Label>Podnaslov</Label>
        <Input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Neobvezni podnaslov"
          disabled={busy}
        />
        <CharCounter value={subtitle} max={BUDGET.categorySublabel} />
      </div>
      {mode === "edit" && (
        <div className="flex items-center gap-2">
          <Switch
            id="section-visible"
            checked={isVisible}
            onCheckedChange={setIsVisible}
            disabled={busy}
          />
          <Label htmlFor="section-visible">Vidna gostom</Label>
        </div>
      )}
      </DialogScrollBody>
      <DialogFooter className="gap-2 flex-wrap shrink-0 border-t pt-3">
        {mode === "edit" && (
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy} className="mr-auto">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Izbriši sekcijo
          </Button>
        )}
        <Button variant="outline" onClick={handleCancel} disabled={busy}>
          Prekliči
        </Button>
        <Button onClick={handleSave} disabled={busy}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {mode === "create" ? "Ustvari" : "Shrani"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ==========================================
// EditDialog — shared shell for all content edit dialogs.
// Centred in the viewport (never anchored to the row), capped at
// min(86vh, 900px) with the BODY scrolling internally; on narrow windows it
// becomes a full-height sheet. Header (title + X) and footer stay fixed —
// the form dialogs render their fields inside <DialogScrollBody> and their
// buttons in a shrink-0 DialogFooter, so Save is always reachable.
// Escape / backdrop close it; with unsaved changes we ask first (the form
// reports dirtiness through DirtyCtx).
// ==========================================

const DirtyCtx = createContext<(dirty: boolean) => void>(() => {});

/** Form dialogs call this every render with their current dirty state. */
function useReportDirty(dirty: boolean) {
  const report = useContext(DirtyCtx);
  useEffect(() => {
    report(dirty);
    return () => report(false);
  }, [dirty, report]);
}

/** Scrollable middle part of an EditDialog. */
function DialogScrollBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto space-y-4 -mx-2 px-2 pb-1">
      {children}
    </div>
  );
}

function EditDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  const dirtyRef = useRef(false);
  const setDirty = useCallback((d: boolean) => {
    dirtyRef.current = d;
  }, []);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && dirtyRef.current && !confirm("Imate neshranjene spremembe. Zaprem brez shranjevanja?")) {
          return; // keep it open
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="overflow-hidden max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DirtyCtx.Provider value={setDirty}>{children}</DirtyCtx.Provider>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// Category Dialog
// ==========================================

type CategoryDialogProps =
  | { mode: "create"; tenantId: string; sectionId: string; category?: undefined; onDone: () => void }
  | { mode: "edit"; tenantId: string; sectionId: string; category: Category; onDone: () => void };

function CategoryDialog({ mode, tenantId, sectionId, category, onDone }: CategoryDialogProps) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const [label, setLabel] = useState(category?.label ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [layout, setLayout] = useState(category?.layout ?? "text");
  const [isVisible, setIsVisible] = useState(category?.isVisible ?? true);

  const baseline = {
    label: category?.label ?? "",
    icon: category?.icon ?? "",
    layout: category?.layout ?? "text",
    isVisible: category?.isVisible ?? true,
  };
  const current = { label, icon, layout, isVisible };
  const { restored, clear, discardRestored } = useDraft(
    "category",
    mode === "edit" ? category.id : `new-${sectionId}`,
    current,
    baseline,
  );

  useEffect(() => {
    if (restored) {
      setLabel(restored.label);
      setIcon(restored.icon);
      setLayout(restored.layout);
      setIsVisible(restored.isVisible);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetTenantQueryKey(tenantId) });

  const handleSave = async () => {
    if (!label.trim() || !icon.trim() || !layout) {
      alert("Ime, ikona in razporeditev so obvezni.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "create") {
        await createCategory(sectionId, { label: label.trim(), icon: icon.trim(), layout });
      } else {
        await updateCategory(category.id, { label: label.trim(), icon: icon.trim(), layout, isVisible });
      }
      clear();
      await refresh();
      onDone();
    } catch {
      alert("Shranjevanje ni uspelo.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    clear();
    onDone();
  };

  useReportDirty(JSON.stringify(current) !== JSON.stringify(baseline));

  const handleDelete = async () => {
    if (!category) return;
    if (!confirm(`Izbrišem kategorijo "${category.label}"? Premaknjena bo v "Nedavno izbrisano" in jo lahko obnovite še 30 dni (skupaj z vnosi v njej).`)) return;
    setBusy(true);
    try {
      await deleteCategory(category.id);
      clear();
      await refresh();
      onDone();
    } catch {
      alert("Brisanje ni uspelo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <DialogScrollBody>
      {restored && <DraftNotice onDiscard={discardRestored} />}
      <div className="grid grid-cols-[1fr_80px] gap-3">
        <div className="space-y-1">
          <Label>Ime kategorije *</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="npr. Restavracije"
            disabled={busy}
          />
          <CharCounter value={label} max={BUDGET.categoryLabel} />
        </div>
        <div className="space-y-1">
          <Label>Ikona *</Label>
          <Input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🍽️"
            disabled={busy}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Razporeditev *</Label>
        <Select value={layout} onValueChange={setLayout} disabled={busy}>
          <SelectTrigger>
            <SelectValue placeholder="Izberite razporeditev" />
          </SelectTrigger>
          <SelectContent>
            {LAYOUT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {mode === "edit" && (
        <div className="flex items-center gap-2">
          <Switch
            id="cat-visible"
            checked={isVisible}
            onCheckedChange={setIsVisible}
            disabled={busy}
          />
          <Label htmlFor="cat-visible">Vidna gostom</Label>
        </div>
      )}
      </DialogScrollBody>
      <DialogFooter className="gap-2 flex-wrap shrink-0 border-t pt-3">
        {mode === "edit" && (
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy} className="mr-auto">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Izbriši kategorijo
          </Button>
        )}
        <Button variant="outline" onClick={handleCancel} disabled={busy}>
          Prekliči
        </Button>
        <Button onClick={handleSave} disabled={busy}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {mode === "create" ? "Ustvari" : "Shrani"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ==========================================
// Item Dialog
// ==========================================

type ItemDialogProps =
  | { mode: "create"; tenantId: string; categoryId: string; item?: undefined; onDone: () => void }
  | { mode: "edit"; tenantId: string; categoryId: string; item: Item; onDone: () => void };

function ItemDialog({ mode, tenantId, categoryId, item, onDone }: ItemDialogProps) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [price, setPrice] = useState(item?.price ?? "");
  const [priceUnit, setPriceUnit] = useState(item?.priceUnit ?? "");
  const [phone, setPhone] = useState(item?.phone ?? "");
  const [isVisible, setIsVisible] = useState(item?.isVisible ?? true);

  const baseline = {
    title: item?.title ?? "",
    body: item?.body ?? "",
    price: item?.price ?? "",
    priceUnit: item?.priceUnit ?? "",
    phone: item?.phone ?? "",
    isVisible: item?.isVisible ?? true,
  };
  const current = { title, body, price, priceUnit, phone, isVisible };
  const { restored, clear, discardRestored } = useDraft(
    "item",
    mode === "edit" ? item.id : `new-${categoryId}`,
    current,
    baseline,
  );

  useEffect(() => {
    if (restored) {
      setTitle(restored.title);
      setBody(restored.body);
      setPrice(restored.price);
      setPriceUnit(restored.priceUnit);
      setPhone(restored.phone);
      setIsVisible(restored.isVisible);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetTenantQueryKey(tenantId) });

  const handleSave = async () => {
    setBusy(true);
    try {
      if (mode === "create") {
        await createItem(categoryId, {
          title: title.trim() || undefined,
          body: body.trim() || undefined,
          price: price.trim() || undefined,
          priceUnit: priceUnit.trim() || undefined,
          phone: phone.trim() || undefined,
        });
      } else {
        await updateItem(item.id, {
          title: title.trim() || null,
          body: body.trim() || null,
          price: price.trim() || null,
          priceUnit: priceUnit.trim() || null,
          phone: phone.trim() || null,
          isVisible,
        });
      }
      clear();
      await refresh();
      onDone();
    } catch {
      alert("Shranjevanje ni uspelo.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    clear();
    onDone();
  };

  useReportDirty(JSON.stringify(current) !== JSON.stringify(baseline));

  const handleDelete = async () => {
    if (!item) return;
    if (!confirm(`Izbrišem vnos "${item.title || "(Brez naslova)"}"? Premaknjen bo v "Nedavno izbrisano" in ga lahko obnovite še 30 dni.`)) return;
    setBusy(true);
    try {
      await deleteItem(item.id);
      clear();
      await refresh();
      onDone();
    } catch {
      alert("Brisanje ni uspelo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <DialogScrollBody>
      {restored && <DraftNotice onDiscard={discardRestored} />}
      <div className="space-y-1">
        <Label>Naslov</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="npr. Pizzeria Napoli"
          disabled={busy}
        />
        <CharCounter value={title} max={BUDGET.itemTitle} />
      </div>
      <div className="space-y-1">
        <Label>Opis / besedilo</Label>
        <RichTextEditor
          value={body}
          onChange={setBody}
          placeholder="Kratko besedilo ali opis…"
          disabled={busy}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Cena</Label>
          <Input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="npr. 12,50"
            disabled={busy}
          />
        </div>
        <div className="space-y-1">
          <Label>Enota cene</Label>
          <Input
            value={priceUnit}
            onChange={(e) => setPriceUnit(e.target.value)}
            placeholder="€ / noč"
            disabled={busy}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Telefon</Label>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+386 …"
          disabled={busy}
        />
      </div>
      {mode === "edit" && (
        <div className="flex items-center gap-2">
          <Switch
            id="item-visible"
            checked={isVisible}
            onCheckedChange={setIsVisible}
            disabled={busy}
          />
          <Label htmlFor="item-visible">Viden gostom</Label>
        </div>
      )}
      </DialogScrollBody>
      <DialogFooter className="gap-2 flex-wrap shrink-0 border-t pt-3">
        {mode === "edit" && (
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy} className="mr-auto">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Izbriši
          </Button>
        )}
        <Button variant="outline" onClick={handleCancel} disabled={busy}>
          Prekliči
        </Button>
        <Button onClick={handleSave} disabled={busy}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {mode === "create" ? "Dodaj vnos" : "Shrani"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ==========================================
// Item row
// ==========================================

function ItemRow({ item, tenantId, categoryId }: { item: Item; tenantId: string; categoryId: string }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className={`bg-background border rounded p-2 text-sm ${!item.isVisible ? "opacity-60" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 flex-1 text-left hover:text-primary transition-colors"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
            <span className="font-medium">{item.title || "(Brez naslova)"}</span>
            {!item.isVisible && (
              <Badge variant="secondary" className="ml-1 gap-1 px-1.5 py-0 text-[10px] shrink-0">
                <EyeOff className="w-2.5 h-2.5" />
                Skrito
              </Badge>
            )}
            {item.price && (
              <span className="text-muted-foreground text-xs ml-auto">
                {item.price}{item.priceUnit ? ` ${item.priceUnit}` : ""}
              </span>
            )}
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 shrink-0"
            onClick={() => setOpen(true)}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="sr-only">Uredi</span>
          </Button>
        </div>

        {expanded && (
          <div className="mt-2 pl-5">
            {item.body && (
              <p className="text-xs text-muted-foreground mb-2 whitespace-pre-line">{item.body}</p>
            )}
            {item.phone && (
              <p className="text-xs text-muted-foreground mb-2">📞 {item.phone}</p>
            )}
            <ItemMediaEditor itemId={item.id} tenantId={tenantId} media={item.media || []} />
          </div>
        )}
      </div>

      <EditDialog open={open} onOpenChange={setOpen} title="Uredi vnos">
          <ItemDialog
            mode="edit"
            tenantId={tenantId}
            categoryId={categoryId}
            item={item}
            onDone={() => setOpen(false)}
          />
      </EditDialog>
    </>
  );
}

// ==========================================
// Category block
// ==========================================

function CategoryBlock({ category, tenantId }: { category: Category; tenantId: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <div className={`bg-muted/50 rounded-lg p-3 ${!category.isVisible ? "opacity-70" : ""}`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold flex items-center gap-2 text-sm">
            {category.icon}
            <span>{category.label}</span>
            {!category.isVisible && (
              <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
                <EyeOff className="w-2.5 h-2.5" />
                Skrito
              </Badge>
            )}
            <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 bg-background rounded-full border">
              {category.layout}
            </span>
          </h4>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditOpen(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1" />
            Uredi
          </Button>
        </div>

        <div className="space-y-1.5 pl-2">
          {(category.items || []).map((item) => (
            <ItemRow key={item.id} item={item} tenantId={tenantId} categoryId={category.id} />
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="w-full border border-dashed mt-1 h-8 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Dodaj element
          </Button>
        </div>
      </div>

      {/* Edit category dialog */}
      <EditDialog open={editOpen} onOpenChange={setEditOpen} title="Uredi kategorijo">
          <CategoryDialog
            mode="edit"
            tenantId={tenantId}
            sectionId={category.id /* unused in edit */}
            category={category}
            onDone={() => setEditOpen(false)}
          />
      </EditDialog>

      {/* Add item dialog */}
      <EditDialog open={addOpen} onOpenChange={setAddOpen} title="Nov element">
          <ItemDialog
            mode="create"
            tenantId={tenantId}
            categoryId={category.id}
            onDone={() => setAddOpen(false)}
          />
      </EditDialog>
    </>
  );
}

// ==========================================
// Section block
// ==========================================

function SectionBlock({ section, tenantId }: { section: Section; tenantId: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const [addCatOpen, setAddCatOpen] = useState(false);

  return (
    <>
      <div className={`border-2 border-border rounded-xl p-4 ${!section.isVisible ? "opacity-70" : ""}`}>
        <div className="flex items-center justify-between mb-4 pb-2 border-b">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              {section.icon}
            </span>
            {section.title}
            {!section.isVisible && (
              <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
                <EyeOff className="w-2.5 h-2.5" />
                Skrito
              </Badge>
            )}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1" />
            Uredi sekcijo
          </Button>
        </div>

        <div className="pl-4 border-l-2 border-border/50 ml-4 space-y-3">
          {(section.categories || []).map((cat) => (
            <CategoryBlock key={cat.id} category={cat} tenantId={tenantId} />
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full border-dashed hover:border-foreground/30"
            onClick={() => setAddCatOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Dodaj kategorijo
          </Button>
        </div>
      </div>

      {/* Edit section dialog */}
      <EditDialog open={editOpen} onOpenChange={setEditOpen} title="Uredi sekcijo">
          <SectionDialog
            mode="edit"
            tenantId={tenantId}
            section={section}
            onDone={() => setEditOpen(false)}
          />
      </EditDialog>

      {/* Add category dialog */}
      <EditDialog open={addCatOpen} onOpenChange={setAddCatOpen} title="Nova kategorija">
          <CategoryDialog
            mode="create"
            tenantId={tenantId}
            sectionId={section.id}
            onDone={() => setAddCatOpen(false)}
          />
      </EditDialog>
    </>
  );
}

// ==========================================
// Trash panel ("Nedavno izbrisano")
// ==========================================

function TrashPanel({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useGetTrash(tenantId);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetTenantQueryKey(tenantId) }),
      queryClient.invalidateQueries({ queryKey: getGetTrashQueryKey(tenantId) }),
    ]);
  };

  const categories = data?.categories ?? [];
  const items = data?.items ?? [];
  const total = categories.length + items.length;
  const retentionDays = data?.retentionDays ?? 30;

  const run = async (id: string, fn: () => Promise<unknown>, failMsg: string) => {
    setBusyId(id);
    try {
      await fn();
      await refresh();
    } catch {
      alert(failMsg);
    } finally {
      setBusyId(null);
    }
  };

  const onRestoreCategory = (id: string) =>
    run(id, () => restoreCategory(id), "Obnovitev ni uspela.");
  const onPurgeCategory = (id: string, label: string) => {
    if (!confirm(`Kategorijo "${label}" trajno izbrišem? Tega ni mogoče razveljaviti.`)) return;
    run(id, () => purgeCategory(id), "Brisanje ni uspelo.");
  };
  const onRestoreItem = (id: string) =>
    run(id, () => restoreItem(id), "Obnovitev ni uspela.");
  const onPurgeItem = (id: string, title: string) => {
    if (!confirm(`Vnos "${title}" trajno izbrišem? Tega ni mogoče razveljaviti.`)) return;
    run(id, () => purgeItem(id), "Brisanje ni uspelo.");
  };

  return (
    <div className="mt-8 border rounded-xl">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Trash2 className="w-4 h-4 text-muted-foreground" />
          Nedavno izbrisano
          {total > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{total}</Badge>
          )}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Vnosi se trajno izbrišejo po {retentionDays} dneh.
          </p>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Nalaganje…
            </div>
          ) : total === 0 ? (
            <p className="text-sm text-muted-foreground">Koš je prazen.</p>
          ) : (
            <>
              {categories.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Kategorije</p>
                  {categories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between gap-2 bg-muted/40 border rounded p-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium truncate">{cat.label}</span>
                        <span className="text-xs text-muted-foreground ml-1">v „{cat.sectionTitle}“</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={busyId === cat.id}
                          onClick={() => onRestoreCategory(cat.id)}
                        >
                          {busyId === cat.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                          Obnovi
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          disabled={busyId === cat.id}
                          onClick={() => onPurgeCategory(cat.id, cat.label)}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Izbriši za vedno
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {items.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vnosi</p>
                  {items.map((it) => {
                    const title = it.title || "(Brez naslova)";
                    return (
                      <div key={it.id} className="flex items-center justify-between gap-2 bg-muted/40 border rounded p-2 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium truncate">{title}</span>
                          <span className="text-xs text-muted-foreground ml-1">v „{it.categoryLabel}“</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={busyId === it.id}
                            onClick={() => onRestoreItem(it.id)}
                          >
                            {busyId === it.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                            Obnovi
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            disabled={busyId === it.id}
                            onClick={() => onPurgeItem(it.id, title)}
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Izbriši za vedno
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Main export
// ==========================================

export function ContentEditor({
  sections,
  tenantId,
}: {
  sections: Section[];
  tenantId: string;
}) {
  const [addSectionOpen, setAddSectionOpen] = useState(false);

  return (
    <>
      {sections.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Trenutno ni nobenih sekcij. Ustvarite prvo sekcijo za začetek.
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <SectionBlock key={section.id} section={section} tenantId={tenantId} />
          ))}
        </div>
      )}

      <Button
        className="w-full mt-6"
        variant="secondary"
        onClick={() => setAddSectionOpen(true)}
      >
        <Plus className="w-4 h-4 mr-2" />
        Nova sekcija
      </Button>

      <TrashPanel tenantId={tenantId} />

      <EditDialog open={addSectionOpen} onOpenChange={setAddSectionOpen} title="Nova sekcija">
          <SectionDialog
            mode="create"
            tenantId={tenantId}
            onDone={() => setAddSectionOpen(false)}
          />
      </EditDialog>
    </>
  );
}
