import React, { useState, useEffect, useRef, useCallback, createContext, useContext, useMemo } from "react";
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
  useGetTrash,
  restoreCategory,
  restoreItem,
  purgeCategory,
  purgeItem,
  getGetTrashQueryKey,
  useGetAdminSession,
  useSearchAdminPlaces,
  useCreateAdminPlace,
  getSearchAdminPlacesQueryKey,
  getGetItemCreatorStatusQueryKey,
  useGetItemCreatorStatus,
  useRecomputeItemDistance,
  useListTranslations,
  useTranslateMissingItemFields,
  upsertTranslation,
  getListTranslationsQueryKey,
  getListTenantTranslationsQueryKey,
  getGetTranslationOverviewQueryKey,
  type ItemTranslationLanguageDraft,
} from "@workspace/api-client-react";
import { Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronRight, EyeOff, RotateCcw, XCircle, MapPin, Search, CheckCircle2 } from "lucide-react";
import { IconSprite } from "@/pages/guest/IconSprite";
import { AdminButton as Button } from "@/components/ui/button";
import type { ItemMediaEditorHandle } from "@/components/admin/item-media-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminBadge as Badge } from "@/components/ui/badge";
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
import { entryNamePlaceholder } from "@/lib/entry-name-placeholder";
import { ItemMediaEditor } from "@/components/admin/item-media-editor";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { formatDistanceMeters } from "@/pages/living-guide/living-guide-formatters";
import {
  EXPLORE_GROUPS,
} from "@/pages/living-guide/living-guide-explore";
import { sectionGroupDefs } from "@/pages/living-guide/living-guide-groups";
import type { CategoryInputExploreGroup } from "@workspace/api-client-react";
import { PinPlacementMap } from "@/components/admin/kreator-proposal-queue";
import { ItemCreatorPhotoProposals } from "@/components/admin/kreator-photo-proposals";
import {
  buildItemLanguageDrafts,
  changedItemTranslationWrites,
  hasTranslatableMissingItemField,
  mergeMissingItemLanguageDrafts,
} from "@/lib/item-translation-drafts";
import { refreshTenantAfterAdminWrite } from "@/lib/tenant-publication-state";
import { mutationErrorMessage } from "@/lib/manual-pin-feedback";
import { EmptyCategoryRow } from "@/components/admin/empty-category-row";
import { getHostOnboardingQueryKey } from "@/hooks/use-host-onboarding";
import { suggestCategoryIcon } from "@workspace/category-icons";
import { CategoryIcon } from "@/components/category-icon";
import { CategoryIconPicker } from "@/components/admin/category-icon-picker";

// ---------- Types ----------

type MediaEntry = { id: string; url: string; alt?: string | null; position: number };

type Item = {
  id: string;
  title?: string | null;
  body?: string | null;
  eventStart?: string | null;
  price?: string | null;
  priceUnit?: string | null;
  phone?: string | null;
  distanceMeters?: number | null;
  tint?: string | null;
  frame?: string | null;
  isVisible: boolean;
  position: number;
  media: MediaEntry[];
  orderEnabled?: boolean;
  soldOut?: boolean;
  producerName?: string | null;
  producerNote?: string | null;
};

type Category = {
  id: string;
  label: string;
  icon: string;
  layout: string;
  exploreGroup: string;
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

type SearchCandidateWithRouting = {
  osmType: "node" | "way" | "relation";
  osmId: number;
  name: string;
  address: string;
  osmCategory?: string;
  osmFeatureType?: string;
  osmAddressType?: string;
  duplicate?: boolean;
  straightLineDistanceM: number;
  roadDistanceM?: number | null;
  travelDurationS?: number | null;
  routeStatus?: "available" | "unavailable";
};

export const OKOLICA_SKELETON_KEYS = [
  "breakfast",
  "culinary",
  "night",
  "pizza",
  "act",
  "hike",
  "bike",
  "beach",
  "culture",
  "nature",
  "trips",
  "events",
  "shops",
  "bakery",
  "gas",
  "atm",
  "pharm",
  "hosp"
];

export function getSkeletonIndex(category: Category) {
  const key = (category as any).key as string | undefined;
  if (!key) return 999;
  const index = OKOLICA_SKELETON_KEYS.indexOf(key);
  return index === -1 ? 999 : index;
}

export function layoutToLabel(layout: string) {
  switch (layout) {
    case "text": return "Besedilo";
    case "poi": return "Kartice";
    case "cards": return "Kartice";
    case "routes": return "Poti";
    case "products": return "Izdelek";
    case "svcs": return "Storitve";
    case "tabs": return "Zavihki";
    case "rules": return "Pravila";
    case "wifi": return "WiFi";
    case "apartments": return "Apartmaji";
    case "events": return "Dogodki";
    case "contacts": return "Kontakti";
    case "help": return "Pomoč";
    default: return "";
  }
}

function getLayoutIcon(layout: string) {
  switch (layout) {
    case "text": return "i-book";
    case "poi": return "i-pin";
    case "routes": return "i-map";
    case "products": return "i-bag";
    case "svcs": return "i-sparkle";
    case "tabs": return "i-copy";
    case "rules": return "i-rules";
    case "wifi": return "i-wifi";
    default: return "i-chev";
  }
}

function IconRenderer({ icon, className }: { icon?: string | null; className?: string }) {
  return <CategoryIcon icon={icon} className={className} />;
}

function formatTravelTime(s: number | null) {
  if (s == null) return "";
  const min = Math.round(s / 60);
  return `${min} min`;
}

function formatKm(m: number | null) {
  if (m == null) return "";
  return `${(m / 1000).toFixed(1)} km`;
}

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

// Razčleni vneseno razdaljo v metrih. Vrne:
//   number  — veljavna nenegativna razdalja za shranjevanje,
//   null    — prazno polje (počisti razdaljo prek ItemUpdate),
//   NaN     — neveljaven vnos (ne shrani).
function parseDistanceMeters(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const meters = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(meters) || meters < 0) return Number.NaN;
  return meters;
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
  const [icon, setIcon] = useState(section?.icon ?? suggestCategoryIcon(""));
  const iconManuallyChosen = useRef(mode === "edit");
  const [subtitle, setSubtitle] = useState(section?.subtitle ?? "");
  const [key, setKey] = useState(section?.key ?? "");
  const [isVisible, setIsVisible] = useState(section?.isVisible ?? true);

  const baseline = {
    title: section?.title ?? "",
    icon: section?.icon ?? suggestCategoryIcon(""),
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
      setIcon(restored.icon || suggestCategoryIcon(restored.title));
      iconManuallyChosen.current = true;
      setSubtitle(restored.subtitle);
      setKey(restored.key);
      setIsVisible(restored.isVisible);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  const refresh = () => refreshTenantAfterAdminWrite(queryClient, tenantId);

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
      <div className="space-y-1">
        <Label>Naslov *</Label>
        <Input
          value={title}
          onChange={(e) => {
            const nextTitle = e.target.value;
            setTitle(nextTitle);
            if (mode === "create") {
              setKey(slugify(nextTitle));
              if (!iconManuallyChosen.current) setIcon(suggestCategoryIcon(nextTitle));
            }
          }}
          placeholder="npr. Informacije"
          disabled={busy}
        />
      </div>
      <div className="space-y-1">
        <Label>Ikona *</Label>
        <CategoryIconPicker
          value={icon}
          name={title}
          disabled={busy}
          onChange={(nextIcon) => {
            iconManuallyChosen.current = true;
            setIcon(nextIcon);
          }}
        />
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

export function EditDialog({
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
  | { mode: "create"; tenantId: string; sectionId: string; sectionKey?: string; category?: undefined; onDone: () => void }
  | { mode: "edit"; tenantId: string; sectionId: string; sectionKey?: string; category: Category; onDone: () => void };

export function CategoryDialog({ mode, tenantId, sectionId, sectionKey, category, onDone }: CategoryDialogProps) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  // Ponudba/Nastanitev use their own group sets; everything else keeps the
  // Okolica groups. A stored value outside the section's set (e.g. the column
  // default) is displayed — and saved — as the section's first group, exactly
  // matching the guest-side fallback.
  const groupDefs = sectionGroupDefs(sectionKey) ?? EXPLORE_GROUPS;
  // Edit mode keeps the RAW stored value — a value outside the section's set
  // (legacy data) renders the select empty and is preserved on save unless the
  // host explicitly picks a group. The guest side already shows such
  // categories under the section's first group without rewriting data.
  const initialGroup = category
    ? (category.exploreGroup ?? "")
    : groupDefs[0]!.key;
  const groupFieldLabel =
    sectionKey === "offer"
      ? "Skupina v Ponudbi *"
      : sectionKey === "stay"
        ? "Skupina v Nastanitvi *"
        : "Skupina v Okolici *";
  const groupFieldHint =
    sectionKey === "offer"
      ? "Določa zavihek, pod katerim gost vidi to kategorijo na zaslonu Ponudba."
      : sectionKey === "stay"
        ? "Določa zavihek, pod katerim gost vidi to kategorijo na zaslonu Nastanitev."
        : "Določa zavihek, pod katerim gost vidi to kategorijo na zaslonu Okolica.";

  const [label, setLabel] = useState(category?.label ?? "");
  const [icon, setIcon] = useState(category?.icon ?? suggestCategoryIcon(""));
  const iconManuallyChosen = useRef(mode === "edit");
  const [layout, setLayout] = useState(category?.layout ?? "text");
  const [exploreGroup, setExploreGroup] = useState<string>(initialGroup);
  const [isVisible, setIsVisible] = useState(category?.isVisible ?? true);

  const baseline = {
    label: category?.label ?? "",
    icon: category?.icon ?? suggestCategoryIcon(""),
    layout: category?.layout ?? "text",
    exploreGroup: initialGroup,
    isVisible: category?.isVisible ?? true,
  };
  const current = { label, icon, layout, exploreGroup, isVisible };
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
      iconManuallyChosen.current = true;
      setLayout(restored.layout);
      setExploreGroup(restored.exploreGroup ?? groupDefs[0]!.key);
      setIsVisible(restored.isVisible);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  const refresh = async () => {
    await Promise.all([
      refreshTenantAfterAdminWrite(queryClient, tenantId),
      // Host onboarding reads the same canonical category tree. Invalidating
      // this cache exposes the admin-created row on the next/active host read;
      // its dirty-draft hydration guard preserves concurrent local typing.
      queryClient.invalidateQueries({ queryKey: getHostOnboardingQueryKey() }),
      queryClient.invalidateQueries({
        queryKey: getListTenantTranslationsQueryKey(tenantId),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetTranslationOverviewQueryKey(tenantId),
        exact: true,
      }),
    ]);
  };

  const handleSave = async () => {
    if (!label.trim() || !icon.trim() || !layout) {
      alert("Ime, ikona in razporeditev so obvezni.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "create") {
        await createCategory(sectionId, {
          label: label.trim(),
          icon: icon.trim(),
          layout,
          exploreGroup: exploreGroup as CategoryInputExploreGroup,
        });
      } else {
        await updateCategory(category.id, {
          label: label.trim(),
          icon: icon.trim(),
          layout,
          // Only persist a group the host actually changed — an untouched
          // legacy value stays exactly as stored.
          ...(exploreGroup !== initialGroup
            ? { exploreGroup: exploreGroup as CategoryInputExploreGroup }
            : {}),
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
      <div className="space-y-1">
        <Label>Ime kategorije *</Label>
        <Input
          value={label}
          onChange={(e) => {
            const nextLabel = e.target.value;
            setLabel(nextLabel);
            if (mode === "create" && !iconManuallyChosen.current) {
              setIcon(suggestCategoryIcon(nextLabel));
            }
          }}
          placeholder="npr. Restavracije"
          disabled={busy}
        />
        <CharCounter value={label} max={BUDGET.categoryLabel} />
      </div>
      <div className="space-y-1">
        <Label>Ikona *</Label>
        <CategoryIconPicker
          value={icon}
          name={label}
          disabled={busy}
          onChange={(nextIcon) => {
            iconManuallyChosen.current = true;
            setIcon(nextIcon);
          }}
        />
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
      <div className="space-y-1">
        <Label>{groupFieldLabel}</Label>
        <Select
          value={exploreGroup}
          onValueChange={(value) => setExploreGroup(value)}
          disabled={busy}
        >
          <SelectTrigger>
            <SelectValue placeholder="Izberite skupino" />
          </SelectTrigger>
          <SelectContent>
            {groupDefs.map((group) => (
              <SelectItem key={group.key} value={group.key}>
                {group.adminLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{groupFieldHint}</p>
      </div>
      {mode === "edit" && (
        <div className="flex items-center gap-2">
          <Switch
            id="cat-visible"
            checked={isVisible}
            onCheckedChange={setIsVisible}
            disabled={busy}
          />
          <Label htmlFor="cat-visible">Aktivna za to namestitev</Label>
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

// Štiri preizkušene barve — iste za vse stranke, da izdelek ostane ena
// družina; poljubna barva je dovoljena (barvne-ploscice.md).
const TINT_SUGGESTIONS = [
  { hex: "#3B78DC", name: "Modra — povezljivost, informacije" },
  { hex: "#2F6F62", name: "Zelenomodra — navodila, kako stvari delujejo" },
  { hex: "#14201F", name: "Skoraj črna — ure, prihod in odhod" },
  { hex: "#C4552E", name: "Terakota — pravila in opozorila" },
];

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toEventStartIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

type ItemDialogProps =
  | { mode: "create"; tenantId: string; categoryId: string; sectionKey?: string; sectionCategories?: Category[]; allCategories?: Category[]; item?: undefined; onDone: () => void }
  | { mode: "edit"; tenantId: string; categoryId: string; sectionKey?: string; sectionCategories?: Category[]; allCategories?: Category[]; item: Item; onDone: () => void };

function ItemDialog({ mode, tenantId, categoryId, sectionKey, sectionCategories, allCategories, item, onDone }: ItemDialogProps) {
  if (mode === "create" && (sectionKey === "explore" || sectionKey === "services")) {
    return <OkolicaPlaceCreate tenantId={tenantId} categoryId={categoryId} sectionCategories={sectionCategories} allCategories={allCategories} onDone={onDone} />;
  }
  const queryClient = useQueryClient();
  const category = sectionCategories?.find((candidate) => candidate.id === categoryId)
    || allCategories?.find((candidate) => candidate.id === categoryId);
  const [busy, setBusy] = useState(false);
  const itemId = mode === "edit" ? item.id : "";
  const itemEditorIdRef = useRef(itemId);
  useEffect(() => {
    itemEditorIdRef.current = itemId;
    return () => {
      itemEditorIdRef.current = "";
    };
  }, [itemId]);
  const creatorStatus = useGetItemCreatorStatus(itemId, {
    query: {
      enabled: mode === "edit",
      queryKey: getGetItemCreatorStatusQueryKey(itemId),
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const { data: ownerSession } = useGetAdminSession();

  // Deferred media (new item): the grid queues files locally; Shrani creates
  // the item, then uploads them to it. If the dialog stays open after a
  // failed upload, the item already exists — remember its id so a second
  // Shrani updates it instead of creating a duplicate.
  const mediaRef = useRef<ItemMediaEditorHandle>(null);
  const createdIdRef = useRef<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [eventStart, setEventStart] = useState(toDateTimeLocal(item?.eventStart));
  const [price, setPrice] = useState(item?.price ?? "");
  const [priceUnit, setPriceUnit] = useState(item?.priceUnit ?? "");
  const [phone, setPhone] = useState(item?.phone ?? "");
  // Razdalja v metrih (neobvezno): prazno = brez razdalje. Hranimo kot niz,
  // da lahko polje eksplicitno počistimo (pošljemo null prek ItemUpdate).
  const [distanceMeters, setDistanceMeters] = useState(
    item?.distanceMeters != null ? String(item.distanceMeters) : "",
  );
  const [isVisible, setIsVisible] = useState(item?.isVisible ?? true);
  // Barvna ploščica: prazno = fotografija, kot doslej (barvne-ploscice.md).
  const [tint, setTint] = useState(item?.tint ?? "");
  // Oblika okvirja fotografij: prazno = ležeče 5:3 (izrez-wifi-eposta.md §1b).
  const [frame, setFrame] = useState(item?.frame ?? "");
  const [orderEnabled, setOrderEnabled] = useState(item?.orderEnabled ?? false);
  const [soldOut, setSoldOut] = useState(item?.soldOut ?? false);
  const [producerName, setProducerName] = useState(item?.producerName ?? "");
  const [producerNote, setProducerNote] = useState(item?.producerNote ?? "");
  const translationsQuery = useListTranslations(
    { model: "item", recordId: itemId },
    {
      query: {
        enabled: mode === "edit",
        queryKey: getListTranslationsQueryKey({ model: "item", recordId: itemId }),
      },
    },
  );
  const [translationDrafts, setTranslationDrafts] = useState<ItemTranslationLanguageDraft[]>([]);
  const [translationBaseline, setTranslationBaseline] = useState<ItemTranslationLanguageDraft[]>([]);
  const translationsInitializedRef = useRef(false);
  const [translationError, setTranslationError] = useState("");
  useEffect(() => {
    if (mode !== "edit" || !translationsQuery.data || translationsInitializedRef.current) return;
    const drafts = buildItemLanguageDrafts(
      { title: item.title ?? "", description: item.body ?? "" },
      translationsQuery.data,
    );
    translationsInitializedRef.current = true;
    setTranslationDrafts(drafts.filter((draft) => draft.language !== "sl"));
    setTranslationBaseline(drafts.filter((draft) => draft.language !== "sl"));
  }, [item, mode, translationsQuery.data]);
  const allLanguageDrafts = buildItemLanguageDrafts(
    { title, description: body },
    [],
  ).map((draft) =>
    draft.language === "sl"
      ? draft
      : translationDrafts.find((candidate) => candidate.language === draft.language) ?? draft
  );
  const translateMissing = useTranslateMissingItemFields();
  const recomputeDistance = useRecomputeItemDistance({
    mutation: {
      onSuccess: async (status) => {
        setDistanceMeters(status.distanceMeters != null ? String(status.distanceMeters) : "");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetItemCreatorStatusQueryKey(itemId) }),
          refreshTenantAfterAdminWrite(queryClient, tenantId),
        ]);
      },
    },
  });

  const baseline = {
    title: item?.title ?? "",
    body: item?.body ?? "",
    eventStart: toDateTimeLocal(item?.eventStart),
    price: item?.price ?? "",
    priceUnit: item?.priceUnit ?? "",
    phone: item?.phone ?? "",
    distanceMeters: item?.distanceMeters != null ? String(item.distanceMeters) : "",
    isVisible: item?.isVisible ?? true,
    tint: item?.tint ?? "",
    frame: item?.frame ?? "",
    orderEnabled: item?.orderEnabled ?? false,
    soldOut: item?.soldOut ?? false,
    producerName: item?.producerName ?? "",
    producerNote: item?.producerNote ?? "",
  };
  const current = {
    title,
    body,
    eventStart,
    price,
    priceUnit,
    phone,
    distanceMeters: creatorStatus.data?.activeMaterialization
      ? baseline.distanceMeters
      : distanceMeters,
    isVisible,
    tint,
    frame,
    orderEnabled,
    soldOut,
    producerName,
    producerNote,
  };
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
      setEventStart(restored.eventStart ?? "");
      setPrice(restored.price);
      setPriceUnit(restored.priceUnit);
      setPhone(restored.phone);
      setDistanceMeters(restored.distanceMeters ?? "");
      setIsVisible(restored.isVisible);
      setTint(restored.tint ?? "");
      setFrame(restored.frame ?? "");
      setOrderEnabled(restored.orderEnabled ?? false);
      setSoldOut(restored.soldOut ?? false);
      setProducerName(restored.producerName ?? "");
      setProducerNote(restored.producerNote ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  useEffect(() => {
    if (creatorStatus.data?.activeMaterialization) {
      setDistanceMeters(
        creatorStatus.data.distanceMeters != null ? String(creatorStatus.data.distanceMeters) : "",
      );
    }
  }, [creatorStatus.data]);

  const refresh = () => refreshTenantAfterAdminWrite(queryClient, tenantId);
  const creatorStatusReady = mode !== "edit" ||
    (!creatorStatus.isLoading && !creatorStatus.isError && creatorStatus.data !== undefined);

  const handleSave = async () => {
    if (mode === "edit" && !creatorStatusReady) {
      alert("Stanja Creator materializacije ni bilo mogoče preveriti. Razdalje ni varno shraniti.");
      return;
    }
    const machineOwnedDistance = creatorStatus.data?.activeMaterialization === true;
    const distanceValue = machineOwnedDistance ? null : parseDistanceMeters(distanceMeters);
    if (Number.isNaN(distanceValue)) {
      alert("Razdalja mora biti nenegativno število metrov (ali prazno).");
      return;
    }
    setBusy(true);
    try {
      if (mode === "create") {
        let id = createdIdRef.current;
        if (!id) {
          const created = await createItem(categoryId, {
            title: title.trim() || undefined,
            body: body.trim() || undefined,
            eventStart: toEventStartIso(eventStart) ?? undefined,
            price: price.trim() || undefined,
            priceUnit: priceUnit.trim() || undefined,
            phone: phone.trim() || undefined,
            distanceMeters: distanceValue ?? undefined,
            tint: tint || undefined,
            frame: (frame || undefined) as any,
            orderEnabled,
            soldOut,
            producerName: producerName.trim() || undefined,
            producerNote: producerNote.trim() || undefined,
          });
          id = created.id;
          createdIdRef.current = id;
        } else {
          // Item was created on a previous Shrani whose uploads failed —
          // update it instead of creating a duplicate.
          await updateItem(id, {
            title: title.trim() || null,
            body: body.trim() || null,
            eventStart: toEventStartIso(eventStart),
            price: price.trim() || null,
            priceUnit: priceUnit.trim() || null,
            phone: phone.trim() || null,
            distanceMeters: distanceValue,
            isVisible,
            tint: tint || null,
          frame: (frame || null) as any,
          orderEnabled,
          soldOut,
          producerName: producerName.trim() || null,
          producerNote: producerNote.trim() || null,
          });
        }
        // Upload the queued media to the fresh item, one by one, with the
        // progress shown in the grid. On a failure the dialog stays open:
        // the item exists, the failed file is red, Shrani retries it.
        if (mediaRef.current) {
          const allOk = await mediaRef.current.uploadAllTo(id);
          if (!allOk) {
            await refresh();
            alert("Vnos je shranjen, a nekatere datoteke se niso naložile. Neuspele so označene rdeče — »Shrani« jih poskusi znova.");
            setBusy(false);
            return;
          }
        }
      } else {
        await updateItem(item.id, {
          title: title.trim() || null,
          body: body.trim() || null,
          eventStart: toEventStartIso(eventStart),
          price: price.trim() || null,
          priceUnit: priceUnit.trim() || null,
          phone: phone.trim() || null,
          ...(!machineOwnedDistance ? { distanceMeters: distanceValue } : {}),
          isVisible,
          tint: tint || null,
          frame: (frame || null) as any,
          orderEnabled,
          soldOut,
          producerName: producerName.trim() || null,
          producerNote: producerNote.trim() || null,
        });
        const originalDrafts = buildItemLanguageDrafts(
          { title: item.title ?? "", description: item.body ?? "" },
          translationsQuery.data ?? [],
        );
        const writes = changedItemTranslationWrites(
          item.id,
          originalDrafts,
          allLanguageDrafts,
          translationsQuery.data ?? [],
        );
        await Promise.all(writes.map((data) => upsertTranslation(data)));
        if (writes.length) {
          await queryClient.invalidateQueries({
            predicate: (query) => String(query.queryKey[0] ?? "").includes("translations"),
          });
        }
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
    itemEditorIdRef.current = "";
    mediaRef.current?.discardPending();
    clear();
    onDone();
  };

  useReportDirty(
    JSON.stringify(current) !== JSON.stringify(baseline) ||
    JSON.stringify(translationDrafts) !== JSON.stringify(translationBaseline) ||
    pendingCount > 0,
  );

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
          placeholder={entryNamePlaceholder(category, sectionKey)}
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
      {mode === "edit" && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-semibold">Prevodi naslova in opisa</h4>
              <p className="text-xs text-muted-foreground">
                Slovenščina je v poljih zgoraj. Predlogi ostanejo osnutek do klika »Shrani«.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={
                busy ||
                translationsQuery.isLoading ||
                translationsQuery.isError ||
                translateMissing.isPending ||
                !hasTranslatableMissingItemField(allLanguageDrafts)
              }
              onClick={() => {
                const scopedItemId = item.id;
                setTranslationError("");
                translateMissing.mutate({
                  id: scopedItemId,
                  data: { translations: allLanguageDrafts },
                }, {
                  onSuccess: (result) => {
                    if (itemEditorIdRef.current !== scopedItemId) return;
                    const currentAll = buildItemLanguageDrafts(
                      { title, description: body },
                      [],
                    ).map((draft) =>
                      draft.language === "sl"
                        ? draft
                        : translationDrafts.find((candidate) => candidate.language === draft.language) ?? draft
                    );
                    const merged = mergeMissingItemLanguageDrafts(currentAll, result.translations);
                    const sl = merged.find((draft) => draft.language === "sl")!;
                    setTitle((currentTitle) => currentTitle.trim() ? currentTitle : sl.title);
                    setBody((currentBody) => currentBody.trim() ? currentBody : sl.description);
                    setTranslationDrafts((currentTranslations) => {
                      const liveAll = buildItemLanguageDrafts(
                        { title: "", description: "" },
                        [],
                      ).map((draft) =>
                        draft.language === "sl"
                          ? draft
                          : currentTranslations.find((candidate) => candidate.language === draft.language) ?? draft
                      );
                      return mergeMissingItemLanguageDrafts(liveAll, result.translations)
                        .filter((draft) => draft.language !== "sl");
                    });
                  },
                  onError: (error) => {
                    if (itemEditorIdRef.current !== scopedItemId) return;
                    setTranslationError(
                      mutationErrorMessage(error) ?? "Prevodov ni bilo mogoče pripraviti.",
                    );
                  },
                });
              }}
            >
              {translateMissing.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Prevedi manjkajoče jezike
            </Button>
          </div>
          {translationsQuery.isLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Nalaganje prevodov…
            </p>
          )}
          {translationsQuery.isError && (
            <p role="alert" className="text-sm text-destructive">Prevodi niso bili naloženi.</p>
          )}
          {translationError && (
            <p role="alert" data-testid={`item-translation-error-${item.id}`} className="text-sm text-destructive">
              {translationError}
            </p>
          )}
          {translationDrafts.map((draft, index) => (
            <div key={draft.language} className="space-y-2 border-t pt-3">
              <strong className="text-xs uppercase">{draft.language}</strong>
              <div className="space-y-1">
                <Label>Naslov ({draft.language.toUpperCase()})</Label>
                <Input
                  value={draft.title}
                  onChange={(event) => setTranslationDrafts((currentDrafts) =>
                    currentDrafts.map((currentDraft, currentIndex) =>
                      currentIndex === index ? { ...currentDraft, title: event.target.value } : currentDraft))}
                  disabled={busy || translateMissing.isPending}
                />
              </div>
              <div className="space-y-1">
                <Label>Opis ({draft.language.toUpperCase()})</Label>
                <RichTextEditor
                  value={draft.description}
                  onChange={(value) => setTranslationDrafts((currentDrafts) =>
                    currentDrafts.map((currentDraft, currentIndex) =>
                      currentIndex === index ? { ...currentDraft, description: value } : currentDraft))}
                  placeholder="Prevod opisa…"
                  disabled={busy || translateMissing.isPending}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1">
        <Label>Fotografije in video</Label>
        <ItemMediaEditor
          ref={mediaRef}
          itemId={mode === "edit" ? item.id : null}
          tenantId={tenantId}
          media={mode === "edit" ? item.media || [] : []}
          onPendingChange={setPendingCount}
          frameRatio={frame === "tall" ? "4 / 5" : frame === "square" ? "1 / 1" : "5 / 3"}
        />
        {mode === "edit" && ownerSession?.authenticated && creatorStatus.data?.activeMaterialization && (
          <ItemCreatorPhotoProposals tenantId={tenantId} itemId={item.id} />
        )}
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
      <div className="space-y-1">
        <Label>Začetek dogodka</Label>
        <Input
          type="datetime-local"
          value={eventStart}
          onChange={(e) => setEventStart(e.target.value)}
          disabled={busy}
        />
        <p className="text-xs text-muted-foreground">
          Neobvezno. Uporablja se za datirane vnose v kategorijah dogodkov in za zavihek Program.
        </p>
      </div>
      <div className="space-y-1">
        <Label>
          {!creatorStatusReady
            ? "Razdalja (preverjanje Creator materializacije)"
            : creatorStatus.data?.activeMaterialization
            ? "Razdalja (strojno izračunana)"
            : "Razdalja (metri) — legacy / brez shranjenih koordinat"}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="text"
            inputMode="decimal"
            value={distanceMeters}
            onChange={(e) => setDistanceMeters(e.target.value)}
            placeholder="npr. 850"
            readOnly={creatorStatus.data?.activeMaterialization === true}
            disabled={busy || !creatorStatusReady}
          />
          {creatorStatusReady && creatorStatus.data?.activeMaterialization ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => recomputeDistance.mutate({ id: itemId })}
              disabled={busy || recomputeDistance.isPending}
            >
              {recomputeDistance.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Preračunaj (OSRM)
            </Button>
          ) : creatorStatusReady && distanceMeters.trim() && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDistanceMeters("")}
              disabled={busy}
            >
              Počisti
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {!creatorStatusReady
            ? "Pred urejanjem ročne razdalje preverjamo, ali je vnos strojno upravljan."
            : creatorStatus.data?.activeMaterialization
            ? "Vrednost upravljajo koordinate aktivne materializacije in izhodišče namestitve; ob običajnem shranjevanju se ne pošilja."
            : "Ročni legacy vnos, ker ni aktivne materializacije s shranjenimi koordinatami. Prazno = brez razdalje."}
          {(() => {
            const preview = formatDistanceMeters(distanceMeters);
            return preview ? ` Gostom prikazano kot: ${preview}.` : "";
          })()}
        </p>
        {recomputeDistance.isError && (
          <p role="alert" className="text-xs text-destructive">Preračun razdalje ni uspel.</p>
        )}
      </div>
      <div className="space-y-1">
        <Label>Oblika fotografij</Label>
        <p className="text-xs text-muted-foreground">
          Vse fotografije tega vnosa delijo isto obliko okvirja; kaj je v okvirju vidno, določite s klikom na sličico zgoraj.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {[{ v: "", n: "Ležeče (5:3)" }, { v: "tall", n: "Pokončno (4:5)" }, { v: "square", n: "Kvadrat (1:1)" }].map((o) => (
            <Button
              key={o.v}
              type="button"
              size="sm"
              variant={(frame || "") === o.v ? "default" : "outline"}
              disabled={busy}
              onClick={() => setFrame(o.v)}
            >
              {o.n}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <Label>Barvna ploščica</Label>
        <p className="text-xs text-muted-foreground">
          Fotografija, kadar slika pokaže resnično stvar; barva, kadar je vnos navodilo ali podatek
          (WiFi, hišni red, prijava). Prazno = fotografija. Fotografije v detajlu ostanejo.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {TINT_SUGGESTIONS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              aria-label={c.name}
              disabled={busy}
              onClick={() => setTint(tint === c.hex ? "" : c.hex)}
              className={`h-8 w-8 rounded-md border-2 ${tint === c.hex ? "border-ring ring-2 ring-ring" : "border-transparent"}`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(tint) ? tint : "#3B78DC"}
            onChange={(e) => setTint(e.target.value)}
            disabled={busy}
            title="Poljubna barva"
            aria-label="Poljubna barva"
            className="h-8 w-8 cursor-pointer rounded-md border p-0.5"
          />
          {tint && (
            <Button type="button" variant="outline" size="sm" onClick={() => setTint("")} disabled={busy}>
              Brez barve (fotografija)
            </Button>
          )}
        </div>
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

      <div className="border-t pt-4 mt-2">
        <h4 className="font-semibold mb-3">Naročanje</h4>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              id="item-orderable"
              checked={orderEnabled}
              onCheckedChange={setOrderEnabled}
              disabled={busy}
            />
            <Label htmlFor="item-orderable">Omogoči naročanje</Label>
          </div>
          {orderEnabled && (
            <>
              <div className="flex items-center gap-2">
                <Switch
                  id="item-soldout"
                  checked={soldOut}
                  onCheckedChange={setSoldOut}
                  disabled={busy}
                />
                <Label htmlFor="item-soldout">Razprodano</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Ime proizvajalca / ponudnika</Label>
                  <Input
                    value={producerName}
                    onChange={(e) => setProducerName(e.target.value)}
                    placeholder="npr. Kmetija Novak"
                    disabled={busy}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Opomba ponudnika</Label>
                  <Input
                    value={producerNote}
                    onChange={(e) => setProducerNote(e.target.value)}
                    placeholder="npr. 400 m od vas"
                    disabled={busy}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      </DialogScrollBody>
      <DialogFooter className="gap-2 flex-wrap shrink-0 border-t pt-3">
        {mode === "edit" && (
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy} className="mr-auto">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Izbriši
          </Button>
        )}
        <Button variant="outline" onClick={handleCancel} disabled={busy || translateMissing.isPending}>
          Prekliči
        </Button>
        <Button onClick={handleSave} disabled={busy || translateMissing.isPending || !creatorStatusReady}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {mode === "create" ? "Dodaj vnos" : "Shrani"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function placeError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Kraja ni bilo mogoče dodati.";
}

export function guessCategory(candidate: SearchCandidateWithRouting, categories: Category[]): string | null {
  const categoryKeys = {
    "restaurant": "culinary",
    "cafe": "culinary",
    "fast_food": "pizza",
    "pub": "night",
    "bar": "night",
    "supermarket": "shops",
    "convenience": "shops",
    "bakery": "bakery",
    "kiosk": "shops",
    "pharmacy": "pharm",
    "hospital": "hosp",
    "atm": "atm",
    "bank": "atm",
    "fuel": "gas",
    "peak": "hike",
    "beach": "beach",
    "viewpoint": "nature",
    "museum": "culture",
    "castle": "culture",
    "ruins": "culture",
    "attraction": "act",
    "artwork": "culture",
    "theme_park": "act",
    "city": "trips",
    "town": "trips",
    "village": "trips",
  };
  const feature = candidate.osmFeatureType?.toLowerCase() || "";
  const cat = candidate.osmCategory?.toLowerCase() || "";
  const targetKey = categoryKeys[feature as keyof typeof categoryKeys] || categoryKeys[cat as keyof typeof categoryKeys];
  
  if (targetKey) {
    const match = categories.find(c => (c as any).key === targetKey);
    if (match) return match.id;
  }
  return null;
}

function OkolicaPlaceCreate({
  tenantId,
  categoryId,
  sectionCategories = [],
  allCategories = [],
  onDone,
}: {
  tenantId: string;
  categoryId: string;
  sectionCategories?: Category[];
  allCategories?: Category[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selected, setSelected] = useState<{ osmType: "node" | "way" | "relation"; osmId: number } | null>(null);
  const [selectedCatId, setSelectedCatId] = useState(categoryId);
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);

  const search = useSearchAdminPlaces(selectedCatId, { q: submittedQuery }, {
    query: {
      queryKey: getSearchAdminPlacesQueryKey(selectedCatId, { q: submittedQuery }),
      enabled: submittedQuery.length >= 2,
      retry: false,
    },
  });

  const create = useCreateAdminPlace();
  const busy = create.isPending;
  const candidates = (search.data?.candidates ?? []) as SearchCandidateWithRouting[];
  const refresh = () => refreshTenantAfterAdminWrite(queryClient, tenantId);

  const save = async () => {
    try {
      if (manual) {
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (!manualName.trim() || !locationText.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
          alert("Ime, opis lokacije in veljavna točka na zemljevidu so obvezni.");
          return;
        }
        await create.mutateAsync({
          id: selectedCatId,
          data: { mode: "manual", name: manualName.trim(), locationText: locationText.trim(), latitude: lat, longitude: lng },
        });
      } else {
        if (!selected) return;
        await create.mutateAsync({ id: selectedCatId, data: { mode: "nominatim", ...selected } });
      }
      await refresh();
      onDone();
    } catch (error) {
      alert(mutationErrorMessage(error));
    }
  };

  useReportDirty(Boolean(query || selected || manualName || locationText || latitude || longitude));

  const PRESET_LIMIT = 5;
  const validAll = allCategories.filter(c => (c as any).sectionKey === "explore" || (c as any).sectionKey === "services");
  const visibleCategories = showAllCategories ? validAll : sectionCategories.slice(0, PRESET_LIMIT);
  const isSelectedVisible = visibleCategories.some(c => c.id === selectedCatId);
  const fallbackCat = validAll.find(c => c.id === selectedCatId) || sectionCategories.find(c => c.id === selectedCatId);
  const chipsToRender = isSelectedVisible ? visibleCategories : [...visibleCategories, fallbackCat!].filter(Boolean);
  const selectedCategory = validAll.find(c => c.id === selectedCatId)
    || sectionCategories.find(c => c.id === selectedCatId);
  const selectedSectionKey = (selectedCategory as (Category & { sectionKey?: string }) | undefined)?.sectionKey
    || (sectionCategories.some(c => c.id === selectedCatId) ? "explore" : "services");
  const namePlaceholder = entryNamePlaceholder(selectedCategory, selectedSectionKey);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 font-['Archivo']">
      <DialogScrollBody>
        {!manual ? (
          <div className="space-y-6">
            <div>
              <Label className="text-[12px] font-bold text-[#9AA39D] mb-2 block uppercase tracking-wider">Ime kraja ali doživetja</Label>
              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      setSelected(null);
                      setSubmittedQuery(query.trim());
                    }
                  }}
                  placeholder={namePlaceholder}
                  disabled={busy}
                  className="h-11 rounded-[10px] border-[#E8EBE6] focus-visible:ring-[#157347] bg-white text-[15px]"
                />
                <Button
                  type="button"
                  onClick={() => { setSelected(null); setSubmittedQuery(query.trim()); }}
                  disabled={busy || query.trim().length < 2}
                  className="bg-[#157347] text-white font-bold h-11 px-6 rounded-[10px] hover:bg-[#0f5935]"
                >
                  <Search className="h-4 w-4 mr-2" /> Poišči
                </Button>
              </div>
              <p className="text-xs text-[#9AA39D] mt-2">Vpišite ime — kraj poiščemo na zemljevidu, razdaljo izračunamo sami.</p>
            </div>
            
            {search.isLoading && (
              <p className="flex items-center gap-2 text-sm text-[#66716A]">
                <Loader2 className="h-4 w-4 animate-spin" /> Iskanje…
              </p>
            )}
            
            {search.isError && (
              <p role="alert" className="text-sm text-destructive font-medium">Iskanje trenutno ni uspelo. Poskusite znova.</p>
            )}

            {search.isSuccess && candidates.length === 0 && (
              <div className="rounded-[10px] border border-dashed border-[#C9D2CB] p-4 text-sm bg-[#F4F6F2]/50 text-center">
                <p className="mb-3 text-[#66716A]">Ni zadetkov.</p>
                <Button type="button" variant="outline" onClick={() => setManual(true)} className="border-[#157347] text-[#157347] hover:bg-[#157347] hover:text-white rounded-full">
                  <MapPin className="h-4 w-4 mr-2" /> Ročno označi na zemljevidu
                </Button>
              </div>
            )}
            
            {search.isSuccess && candidates.length > 0 && (
              <div>
                <Label className="text-[12px] font-bold text-[#9AA39D] mb-2 block uppercase tracking-wider">Zadetki — izberite pravega</Label>
                <div className="space-y-2">
                  {candidates.map((candidate) => {
                    const isSelected = selected?.osmType === candidate.osmType && selected?.osmId === candidate.osmId;
                    const hasRouting = candidate.routeStatus === "available" && candidate.roadDistanceM != null && candidate.travelDurationS != null;
                    return (
                      <button
                        key={`${candidate.osmType}:${candidate.osmId}`}
                        type="button"
                        disabled={candidate.duplicate || busy}
                        aria-pressed={isSelected}
                        style={{ borderColor: isSelected ? "#157347" : "#E8EBE6", borderWidth: isSelected ? 2 : 1 }}
                        onClick={() => {
                          setSelected({ osmType: candidate.osmType, osmId: candidate.osmId });
                          const suggested = guessCategory(candidate, allCategories);
                          if (suggested) setSelectedCatId(suggested);
                        }}
                        className={`w-full flex items-center justify-between text-left p-3 rounded-[10px] border transition-colors ${isSelected ? 'border-[#157347] border-2 bg-[#F4F6F2]' : 'border-[#E8EBE6] bg-white hover:border-[#C9D2CB]'} ${candidate.duplicate ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                         <div className="flex-1 min-w-0 pr-4">
                           <div className="flex items-center gap-2">
                             <span className={`font-bold text-[15px] truncate ${isSelected ? 'text-[#157347]' : 'text-[#1a1a1a]'}`}>{candidate.name}</span>
                             {candidate.duplicate && <Badge className="bg-[#F4F6F2] text-[#66716A] hover:bg-[#F4F6F2] border-none font-medium">že v vodniku</Badge>}
                           </div>
                           <span className="block text-[13px] text-[#9AA39D] mt-0.5 whitespace-normal break-words">{candidate.address}</span>
                         </div>
                         <div className="flex items-center gap-3 shrink-0">
                           {hasRouting ? (
                             <span className={`px-2.5 py-1 rounded-full text-[12px] font-bold whitespace-nowrap ${isSelected ? 'bg-[#157347] text-white' : 'bg-[#F4F6F2] text-[#66716A]'}`}>
                               {formatKm(candidate.roadDistanceM ?? null)} · {formatTravelTime(candidate.travelDurationS ?? null)}
                             </span>
                           ) : (
                             <span className="text-[12px] text-[#9AA39D] italic whitespace-nowrap">Ni poti</span>
                           )}
                           {isSelected && <CheckCircle2 className="w-5 h-5 text-[#157347] shrink-0" />}
                         </div>
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setManual(true)} className="text-[#157347] font-semibold text-sm flex items-center gap-1 mt-4 hover:underline">
                  Ni pravega zadetka? Postavite točko ročno na zemljevidu →
                </button>
              </div>
            )}

            <div>
              <Label className="text-[12px] font-bold text-[#9AA39D] mb-2 block uppercase tracking-wider">Kategorija</Label>
              <div className="flex flex-wrap gap-2">
                {chipsToRender.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCatId(c.id)}
                    className={`px-4 py-2 rounded-full text-[14px] font-bold border transition-colors ${selectedCatId === c.id ? 'bg-[#157347] text-white border-[#157347]' : 'bg-white text-[#66716A] border-[#E8EBE6] hover:bg-[#F4F6F2]'}`}
                  >
                    {c.label}
                  </button>
                ))}
                {!showAllCategories && sectionCategories.length > PRESET_LIMIT && (
                  <button 
                    type="button"
                    onClick={() => setShowAllCategories(true)} 
                    className="px-3 py-2 text-[14px] text-[#66716A] font-bold border border-transparent hover:underline"
                  >
                    Vse kategorije ⌄
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 font-medium">
              Ročni vnos uporabite le, če kraja res ni na zemljevidu (npr. skrita plaža, neoznačena pot).
            </div>
            <div className="space-y-1.5">
              <Label>Ime kraja *</Label>
              <Input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder={namePlaceholder}
                disabled={busy}
                className="h-11 rounded-[10px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Opis lokacije *</Label>
              <Input
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="npr. 5 min hoda od kampa"
                disabled={busy}
                className="h-11 rounded-[10px]"
              />
              <p className="text-xs text-[#9AA39D]">Kratek opis kje se nahaja, da gostje lažje najdejo.</p>
            </div>
            <PinPlacementMap
              latitude={latitude}
              longitude={longitude}
              origin={search.data ? {
                latitude: search.data.originLatitude,
                longitude: search.data.originLongitude,
              } : undefined}
              onPlace={(lat, lng) => { setLatitude(String(lat)); setLongitude(String(lng)); }}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Geografska širina (Lat) *</Label>
                <Input
                  inputMode="decimal"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="npr. 46.362"
                  disabled={busy}
                  className="h-11 rounded-[10px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Geografska dolžina (Lng) *</Label>
                <Input
                  inputMode="decimal"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="npr. 13.821"
                  disabled={busy}
                  className="h-11 rounded-[10px]"
                />
              </div>
            </div>
            <Button type="button" variant="ghost" onClick={() => setManual(false)} disabled={busy} className="mt-2 text-[#157347]">
              ← Nazaj na iskanje
            </Button>
          </div>
        )}
      </DialogScrollBody>
      
      <DialogFooter className="gap-2 flex-wrap shrink-0 border-t border-[#E8EBE6] pt-4 mt-2 bg-white">
        <p className="w-full text-xs text-[#66716A] mb-2 text-center sm:text-left">
          Opis in fotografije dodate po vnosu — kot osnutek, gostje vidijo šele po objavi.
        </p>
        <Button variant="outline" onClick={onDone} disabled={busy} className="rounded-full border-[#C9D2CB] text-[#66716A] hover:bg-[#F4F6F2] h-10 px-6 font-bold">
          Prekliči
        </Button>
        <Button onClick={save} disabled={busy || (!selected && !manual)} className="rounded-full bg-[#157347] text-white hover:bg-[#0f5935] h-10 px-6 font-bold">
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Dodaj v vodnik
        </Button>
      </DialogFooter>
    </div>
  );
}
// ==========================================
// Item row
// ==========================================

function ItemRow({ item, tenantId, categoryId, sectionKey, sectionCategories, allCategories, layout }: { item: Item; tenantId: string; categoryId: string; sectionKey?: string; sectionCategories?: Category[]; allCategories?: Category[]; layout?: string }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className={`flex items-center gap-3 bg-white border border-[#E8EBE6] rounded-[10px] p-2 pr-3 min-h-[46px] transition-colors hover:border-[#C9D2CB] ${!item.isVisible ? "opacity-60" : ""}`}>
        <div className="w-6 h-6 flex items-center justify-center bg-[#F4F6F2] rounded text-[#157347] shrink-0">
          <IconRenderer icon={getLayoutIcon(layout || "")} className="w-3.5 h-3.5" />
        </div>
        <span className="text-[15.5px] font-semibold flex-1 truncate text-[#1a1a1a]">{item.title || "Neimenovan vnos"}</span>
        
        {!item.isVisible && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-[#F4F6F2] rounded text-[10px] text-[#66716A] font-medium shrink-0">
            <EyeOff className="w-3 h-3" /> Skrito
          </span>
        )}
        
        {layout && (
          <span className="text-[11px] font-medium text-[#9AA39D] shrink-0 hidden sm:inline-block">
            {layoutToLabel(layout)}
          </span>
        )}

        <button type="button" onClick={() => setEditOpen(true)} className="text-[#9AA39D] hover:text-[#157347] p-1 shrink-0 ml-1">
          <Pencil className="w-4 h-4" />
        </button>
      </div>

      <EditDialog open={editOpen} onOpenChange={setEditOpen} title="Uredi vnos">
          <ItemDialog
            mode="edit"
            tenantId={tenantId}
            categoryId={categoryId}
            sectionKey={sectionKey}
            sectionCategories={sectionCategories}
            allCategories={allCategories}
            item={item}
            onDone={() => setEditOpen(false)}
          />
      </EditDialog>
    </>
  );
}

// ==========================================
// Category block
// ==========================================

export function categoryAddLabel(sectionKey?: string): "Dodaj vnos" | "Dodaj ponudbo" | "Dodaj kraj" {
  if (sectionKey === "explore" || sectionKey === "services") return "Dodaj kraj";
  if (sectionKey === "offer") return "Dodaj ponudbo";
  return "Dodaj vnos";
}

function CategoryBlock({ category, tenantId, sectionKey, sectionCategories, isExplore, allCategories }: { category: Category; tenantId: string; sectionKey?: string; sectionCategories?: Category[]; isExplore?: boolean; allCategories?: Category[] }) {
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const isCustom = isExplore && String((category as any).key).startsWith("host-custom");
  const items = category.items || [];
  const isEmpty = items.length === 0;
  const addLabel = categoryAddLabel(sectionKey);

  if (isEmpty) {
    return (
      <>
        <EmptyCategoryRow
          id={category.id}
          icon={<IconRenderer icon={category.icon} className="h-3.5 w-3.5" />}
          name={category.label}
          isVisible={category.isVisible}
          extraLabel={isCustom ? <span className="shrink-0 text-[10px] font-medium text-[#9AA39D]">gostiteljeva</span> : undefined}
          addLabel={addLabel}
          onEdit={() => setEditOpen(true)}
          onAdd={() => setAddOpen(true)}
        />

        <EditDialog open={editOpen} onOpenChange={setEditOpen} title="Uredi kategorijo">
            <CategoryDialog mode="edit" tenantId={tenantId} sectionId={category.id} sectionKey={sectionKey} category={category} onDone={() => setEditOpen(false)} />
        </EditDialog>
        <EditDialog open={addOpen} onOpenChange={setAddOpen} title={addLabel}>
            <ItemDialog mode="create" tenantId={tenantId} categoryId={category.id} sectionKey={sectionKey} sectionCategories={sectionCategories} allCategories={allCategories} onDone={() => setAddOpen(false)} />
        </EditDialog>
      </>
    );
  }

  return (
    <>
      <div className={`mt-4 ${!category.isVisible ? "opacity-70" : ""}`}>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="flex items-center gap-2 text-[14px] font-bold text-[#66716A]">
            <div className="w-6 h-6 flex items-center justify-center bg-[#F4F6F2] rounded text-[#157347]">
              <IconRenderer icon={category.icon} className="w-3.5 h-3.5" />
            </div>
            {category.label}
            {isCustom && <span className="text-[11px] font-normal text-[#9AA39D] hidden sm:inline-block">gostiteljeva</span>}
            {!category.isVisible && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#F4F6F2] border border-[#E8EBE6] rounded text-[10px] text-[#66716A] font-medium">
                <EyeOff className="w-3 h-3" /> Skrito
              </span>
            )}
            <span className="font-normal text-[#9AA39D]">· {items.length} {isExplore ? 'krajev' : 'elementov'}</span>
          </h4>
          <button type="button" onClick={() => setEditOpen(true)} className="text-[#157347] hover:underline flex items-center gap-1 text-[13px] font-bold">
            <Pencil className="w-3.5 h-3.5" /> Uredi
          </button>
        </div>

        <div className="space-y-1.5">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} tenantId={tenantId} categoryId={category.id} sectionKey={sectionKey} sectionCategories={sectionCategories} allCategories={allCategories} layout={category.layout} />
          ))}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 border border-dashed border-[#C9D2CB] rounded-[10px] py-2 text-[#157347] font-bold text-[14px] hover:bg-[#F4F6F2] transition-colors h-[46px]"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-4 h-4" />
            {addLabel}
          </button>
        </div>
      </div>

      <EditDialog open={editOpen} onOpenChange={setEditOpen} title="Uredi kategorijo">
          <CategoryDialog mode="edit" tenantId={tenantId} sectionId={category.id} sectionKey={sectionKey} category={category} onDone={() => setEditOpen(false)} />
      </EditDialog>
      <EditDialog open={addOpen} onOpenChange={setAddOpen} title={addLabel}>
          <ItemDialog mode="create" tenantId={tenantId} categoryId={category.id} sectionKey={sectionKey} sectionCategories={sectionCategories} allCategories={allCategories} onDone={() => setAddOpen(false)} />
      </EditDialog>
    </>
  );
}

// ==========================================
// Section block
// ==========================================

function SectionBlock({ section, tenantId, allCategories }: { section: Section; tenantId: string; allCategories?: Category[] }) {
  const [editOpen, setEditOpen] = useState(false);
  const [addCatOpen, setAddCatOpen] = useState(false);

  const isExplore = section.key === "explore" || section.key === "services";
  
  let sortedCategories = [...(section.categories || [])];
  if (isExplore) {
    sortedCategories.sort((a, b) => {
      const idxA = getSkeletonIndex(a);
      const idxB = getSkeletonIndex(b);
      if (idxA !== idxB) return idxA - idxB;
      return a.position - b.position;
    });
  } else {
    sortedCategories.sort((a, b) => a.position - b.position);
  }

  const totalItems = sortedCategories.reduce((sum, c) => sum + (c.items?.length || 0), 0);
  const subtitle = isExplore 
    ? `${sortedCategories.length} kategorij · ${totalItems} krajev`
    : `${totalItems} elementov`;

  return (
    <>
      <div className={`bg-[#F4F6F2] border border-[#E8EBE6] rounded-[16px] p-4 sm:p-5 font-['Archivo'] ${!section.isVisible ? "opacity-70" : ""}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-[34px] h-[34px] rounded-[10px] bg-[#157347] flex items-center justify-center shrink-0">
              <IconRenderer icon={section.icon} className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-[18px] font-[800] leading-none mb-1 text-[#1a1a1a] flex items-center gap-2">
                {section.title}
                {!section.isVisible && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-white border border-[#E8EBE6] rounded text-[10px] text-[#66716A] font-medium align-middle">
                    <EyeOff className="w-3 h-3" /> Skrito
                  </span>
                )}
              </h3>
              <p className="text-[13px] text-[#66716A]">{subtitle}</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1 text-[#157347] font-bold text-[14px] hover:underline whitespace-nowrap"
          >
            <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">Uredi sekcijo</span>
          </button>
        </div>

        <div className="space-y-3">
          {sortedCategories.map((cat) => (
            <CategoryBlock 
              key={cat.id} 
              category={cat} 
              tenantId={tenantId} 
              sectionKey={section.key} 
              sectionCategories={sortedCategories}
              isExplore={isExplore}
              allCategories={allCategories}
            />
          ))}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 border border-dashed border-[#C9D2CB] rounded-[10px] py-2 text-[#157347] font-bold text-[14px] hover:bg-white transition-colors h-[46px]"
            onClick={() => setAddCatOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Dodaj kategorijo
          </button>
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
            sectionKey={section.key}
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
  const { data: session } = useGetAdminSession();
  const isOwner = Boolean(session?.authenticated);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useGetTrash(tenantId);

  const refresh = async () => {
    await Promise.all([
      refreshTenantAfterAdminWrite(queryClient, tenantId),
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
                        {isOwner && (
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
                        )}
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
                          {isOwner && (
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
                          )}
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
  const allCategories = React.useMemo(() => {
    return sections.flatMap(s => (s.categories || []).map(c => ({ ...c, sectionKey: s.key })));
  }, [sections]);

  return (
    <div className="font-['Archivo']">
      <div style={{ display: "none" }} aria-hidden="true"><IconSprite /></div>
      {sections.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Trenutno ni nobenih sekcij. Ustvarite prvo sekcijo za začetek.
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <SectionBlock key={section.id} section={section} tenantId={tenantId} allCategories={allCategories} />
          ))}
        </div>
      )}

      <Button
        className="w-full mt-4 h-[46px] border border-dashed border-[#C9D2CB] rounded-[10px] bg-white text-[#157347] font-bold hover:bg-[#F4F6F2]"
        variant="outline"
        onClick={() => setAddSectionOpen(true)}
      >
        <Plus className="w-4 h-4 mr-2" />
        Dodaj sekcijo
      </Button>

      <TrashPanel tenantId={tenantId} />

      <EditDialog open={addSectionOpen} onOpenChange={setAddSectionOpen} title="Nova sekcija">
          <SectionDialog
            mode="create"
            tenantId={tenantId}
            onDone={() => setAddSectionOpen(false)}
          />
      </EditDialog>
    </div>
  );
}
