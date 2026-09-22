import sys

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'r') as f:
    content = f.read()

# 1. Fix types & helpers
to_replace_1 = """type SearchCandidateWithRouting = {
  osmType: "node" | "way" | "relation";
  osmId: number;
  name: string;
  address: string;
  duplicate?: boolean;
  straightLineDistanceM: number;
  roadDistanceM?: number | null;
  travelDurationS?: number | null;
  routeStatus?: "available" | "unavailable";
};

const OKOLICA_SKELETON = [
  "znamenitosti",
  "restavracije",
  "kavarne in bari",
  "pohodništvo",
  "kolesarjenje",
  "plaže in kopališča",
  "smučanje",
  "dogodki",
  "trgovine in tržnice",
  "lekarne",
  "zdravstveni dom",
  "zdravstvo",
];

function getSkeletonIndex(label: string) {
  const norm = label.toLowerCase().trim();
  const index = OKOLICA_SKELETON.findIndex(s => s === norm);
  return index === -1 ? 999 : index;
}

function layoutToLabel(layout: string) {
  switch (layout) {
    case "text": return "Besedilo";
    case "poi": return "Kartice";
    case "routes": return "Poti";
    case "products": return "Izdelek";
    case "svcs": return "Storitve";
    case "tabs": return "Zavihki";
    case "rules": return "Pravila";
    case "wifi": return "WiFi";
    default: return layout;
  }
}"""

replacement_1 = """type SearchCandidateWithRouting = {
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

const OKOLICA_SKELETON_KEYS = [
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

function getSkeletonIndex(category: Category) {
  const key = (category as any).key as string | undefined;
  if (!key) return 999;
  const index = OKOLICA_SKELETON_KEYS.indexOf(key);
  return index === -1 ? 999 : index;
}

function layoutToLabel(layout: string) {
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
}"""

content = content.replace(to_replace_1, replacement_1)

# 2. Add allCategories to ItemDialogProps & OkolicaPlaceCreate
to_replace_2 = """type ItemDialogProps =
  | { mode: "create"; tenantId: string; categoryId: string; sectionKey?: string; sectionCategories?: Category[]; item?: undefined; onDone: () => void }
  | { mode: "edit"; tenantId: string; categoryId: string; sectionKey?: string; sectionCategories?: Category[]; item: Item; onDone: () => void };

function ItemDialog({ mode, tenantId, categoryId, sectionKey, sectionCategories, item, onDone }: ItemDialogProps) {
  if (mode === "create" && (sectionKey === "explore" || sectionKey === "services")) {
    return <OkolicaPlaceCreate tenantId={tenantId} categoryId={categoryId} sectionCategories={sectionCategories} onDone={onDone} />;
  }"""

replacement_2 = """type ItemDialogProps =
  | { mode: "create"; tenantId: string; categoryId: string; sectionKey?: string; sectionCategories?: Category[]; allCategories?: Category[]; item?: undefined; onDone: () => void }
  | { mode: "edit"; tenantId: string; categoryId: string; sectionKey?: string; sectionCategories?: Category[]; allCategories?: Category[]; item: Item; onDone: () => void };

function ItemDialog({ mode, tenantId, categoryId, sectionKey, sectionCategories, allCategories, item, onDone }: ItemDialogProps) {
  if (mode === "create" && (sectionKey === "explore" || sectionKey === "services")) {
    return <OkolicaPlaceCreate tenantId={tenantId} categoryId={categoryId} sectionCategories={sectionCategories} allCategories={allCategories} onDone={onDone} />;
  }"""

content = content.replace(to_replace_2, replacement_2)

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'w') as f:
    f.write(content)

print("Replaced definitions")
