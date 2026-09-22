import sys

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'r') as f:
    content = f.read()

to_replace = """function OkolicaPlaceCreate({
  tenantId,
  categoryId,
  sectionCategories = [],
  onDone,
}: {
  tenantId: string;
  categoryId: string;
  sectionCategories?: Category[];
  onDone: () => void;
}) {"""

replacement = """function guessCategory(candidate: SearchCandidateWithRouting, categories: Category[]): string | null {
  const categoryKeys = {
    "restaurant": "culinary",
    "cafe": "coffee",
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
}) {"""

content = content.replace(to_replace, replacement)

# Now fix chips logic
to_replace_chips = """  const PRESET_LIMIT = 5;
  const visibleCategories = showAllCategories ? sectionCategories : sectionCategories.slice(0, PRESET_LIMIT);
  const isSelectedVisible = visibleCategories.some(c => c.id === selectedCatId);
  const chipsToRender = isSelectedVisible ? visibleCategories : [...visibleCategories, sectionCategories.find(c => c.id === selectedCatId)!].filter(Boolean);"""

replacement_chips = """  const PRESET_LIMIT = 5;
  const validAll = allCategories.filter(c => (c as any).sectionKey === "explore" || (c as any).sectionKey === "services");
  const visibleCategories = showAllCategories ? validAll : sectionCategories.slice(0, PRESET_LIMIT);
  const isSelectedVisible = visibleCategories.some(c => c.id === selectedCatId);
  const fallbackCat = validAll.find(c => c.id === selectedCatId) || sectionCategories.find(c => c.id === selectedCatId);
  const chipsToRender = isSelectedVisible ? visibleCategories : [...visibleCategories, fallbackCat!].filter(Boolean);"""

content = content.replace(to_replace_chips, replacement_chips)

# Now fix selection logic
to_replace_select = """                        onClick={() => setSelected({ osmType: candidate.osmType, osmId: candidate.osmId })}"""

replacement_select = """                        onClick={() => {
                          setSelected({ osmType: candidate.osmType, osmId: candidate.osmId });
                          const suggested = guessCategory(candidate, allCategories);
                          if (suggested) setSelectedCatId(suggested);
                        }}"""

content = content.replace(to_replace_select, replacement_select)

with open('artifacts/smart360/src/components/admin/content-editor.tsx', 'w') as f:
    f.write(content)
