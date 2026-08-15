import { useState } from "react";
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
} from "@workspace/api-client-react";
import { Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      await refresh();
      onDone();
    } catch {
      alert("Shranjevanje ni uspelo.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!section) return;
    if (!confirm(`Izbrišem sekcijo "${section.title}"? Vse kategorije in vnosi v njej bodo trajno izbrisani.`)) return;
    setBusy(true);
    try {
      await deleteSection(section.id);
      await refresh();
      onDone();
    } catch {
      alert("Brisanje ni uspelo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
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
      <DialogFooter className="gap-2 flex-wrap">
        {mode === "edit" && (
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy} className="mr-auto">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Izbriši sekcijo
          </Button>
        )}
        <Button onClick={handleSave} disabled={busy}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {mode === "create" ? "Ustvari" : "Shrani"}
        </Button>
      </DialogFooter>
    </div>
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
      await refresh();
      onDone();
    } catch {
      alert("Shranjevanje ni uspelo.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!category) return;
    if (!confirm(`Izbrišem kategorijo "${category.label}"? Vsi vnosi v njej bodo trajno izbrisani.`)) return;
    setBusy(true);
    try {
      await deleteCategory(category.id);
      await refresh();
      onDone();
    } catch {
      alert("Brisanje ni uspelo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_80px] gap-3">
        <div className="space-y-1">
          <Label>Ime kategorije *</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="npr. Restavracije"
            disabled={busy}
          />
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
      <DialogFooter className="gap-2 flex-wrap">
        {mode === "edit" && (
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy} className="mr-auto">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Izbriši kategorijo
          </Button>
        )}
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
      await refresh();
      onDone();
    } catch {
      alert("Shranjevanje ni uspelo.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!confirm(`Izbrišem vnos "${item.title || "(Brez naslova)"}"?`)) return;
    setBusy(true);
    try {
      await deleteItem(item.id);
      await refresh();
      onDone();
    } catch {
      alert("Brisanje ni uspelo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Naslov</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="npr. Pizzeria Napoli"
          disabled={busy}
        />
      </div>
      <div className="space-y-1">
        <Label>Opis / besedilo</Label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Kratko besedilo ali opis…"
          rows={3}
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
      <DialogFooter className="gap-2 flex-wrap">
        {mode === "edit" && (
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy} className="mr-auto">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Izbriši
          </Button>
        )}
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
            {!item.isVisible && <EyeOff className="w-3 h-3 ml-1 text-muted-foreground shrink-0" aria-label="Skrito" />}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uredi vnos</DialogTitle>
          </DialogHeader>
          <ItemDialog
            mode="edit"
            tenantId={tenantId}
            categoryId={categoryId}
            item={item}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
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
            {!category.isVisible && <EyeOff className="w-3 h-3 text-muted-foreground" aria-label="Skrito" />}
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
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uredi kategorijo</DialogTitle>
          </DialogHeader>
          <CategoryDialog
            mode="edit"
            tenantId={tenantId}
            sectionId={category.id /* unused in edit */}
            category={category}
            onDone={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Add item dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nov element</DialogTitle>
          </DialogHeader>
          <ItemDialog
            mode="create"
            tenantId={tenantId}
            categoryId={category.id}
            onDone={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>
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
              <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                <EyeOff className="w-3 h-3" /> skrita
              </span>
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
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uredi sekcijo</DialogTitle>
          </DialogHeader>
          <SectionDialog
            mode="edit"
            tenantId={tenantId}
            section={section}
            onDone={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Add category dialog */}
      <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova kategorija</DialogTitle>
          </DialogHeader>
          <CategoryDialog
            mode="create"
            tenantId={tenantId}
            sectionId={section.id}
            onDone={() => setAddCatOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
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

      <Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova sekcija</DialogTitle>
          </DialogHeader>
          <SectionDialog
            mode="create"
            tenantId={tenantId}
            onDone={() => setAddSectionOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
