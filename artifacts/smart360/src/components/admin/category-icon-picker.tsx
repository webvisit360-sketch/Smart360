import { useEffect, useMemo, useState } from "react";
import {
  lucideIconKey,
  lucideIconName,
  normalizeSlovenian,
  suggestCategoryIcons,
} from "@workspace/category-icons";
import { CategoryIcon, availableLucideIconNames } from "@/components/category-icon";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 36;

const SLOVENIAN_ICON_NAMES: Record<string, string> = {
  utensils: "Pribor",
  "chef-hat": "Kuharska kapa",
  "cooking-pot": "Lonec",
  bike: "Kolo",
  route: "Pot",
  map: "Zemljevid",
  waves: "Valovi",
  droplets: "Kapljice",
  "life-buoy": "Rešilni obroč",
  "shopping-bag": "Nakupovalna vrečka",
  "shopping-cart": "Nakupovalni voziček",
  store: "Trgovina",
  star: "Zvezda",
  tag: "Oznaka",
  sparkles: "Iskrice",
  car: "Avto",
  "circle-parking": "Parkirišče",
  "key-round": "Ključ",
  bed: "Postelja",
  "bed-double": "Zakonska postelja",
  "bed-single": "Postelja",
  wifi: "Wi‑Fi",
  "clipboard-list": "Seznam pravil",
  coffee: "Kava",
  "heart-pulse": "Zdravje",
  mountain: "Izlet",
  baby: "Otroci",
  bath: "Wellness",
  phone: "Telefon",
  "calendar-days": "Dogodki",
  "washing-machine": "Pralni stroj",
};

function displayName(name: string) {
  return SLOVENIAN_ICON_NAMES[name]
    ?? name.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function IconChoice({
  iconName,
  value,
  disabled,
  compact = false,
  onChange,
}: {
  iconName: string;
  value: string;
  disabled?: boolean;
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  const key = lucideIconKey(iconName);
  const label = displayName(iconName);
  return (
    <button
      type="button"
      role="option"
      aria-selected={value === key}
      aria-label={`Izberi ikono: ${label}`}
      title={label}
      disabled={disabled}
      onClick={() => onChange(key)}
      className={`${compact ? "grid aspect-square place-items-center" : "flex min-h-16 items-center gap-2 px-2 text-left"} rounded-md border transition-colors hover:bg-muted ${
        value === key ? "border-primary bg-primary/10 text-primary" : "border-border"
      }`}
    >
      <CategoryIcon icon={key} className="h-5 w-5 shrink-0" />
      {!compact && <span className="text-xs font-medium">{label}</span>}
    </button>
  );
}

export function CategoryIconPicker({
  value,
  name,
  disabled,
  onChange,
}: {
  value: string;
  name: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const suggestions = suggestCategoryIcons(name);
  const selectedName = lucideIconName(value);
  const results = useMemo(() => {
    const query = normalizeSlovenian(search);
    if (!query) return availableLucideIconNames;
    return availableLucideIconNames.filter((iconName) =>
      normalizeSlovenian(`${iconName} ${displayName(iconName)}`).includes(query),
    );
  }, [search]);

  useEffect(() => setLimit(PAGE_SIZE), [search]);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted">
          <CategoryIcon icon={value} className="h-5 w-5" />
        </span>
        <div className="min-w-0 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Izbrana ikona</div>
          <div className="truncate">{selectedName ? displayName(selectedName) : `Obstoječa: ${value}`}</div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-medium text-foreground">Predlagane ikone</div>
        <div className="grid grid-cols-3 gap-2" role="listbox" aria-label="Predlagane ikone">
          {suggestions.map((key) => (
            <IconChoice
              key={key}
              iconName={lucideIconName(key)!}
              value={value}
              disabled={disabled}
              onChange={onChange}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        className="text-xs font-medium text-primary hover:underline"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        disabled={disabled}
      >
        {expanded ? "Skrij več ikon" : "Več ikon …"}
      </button>

      {expanded && (
        <div className="space-y-2 border-t pt-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Išči med vsemi ikonami …"
            aria-label="Išči med vsemi ikonami"
            disabled={disabled}
          />
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-8" role="listbox" aria-label="Vse ikone">
            {results.slice(0, limit).map((iconName) => (
              <IconChoice
                key={iconName}
                iconName={iconName}
                value={value}
                disabled={disabled}
                compact
                onChange={onChange}
              />
            ))}
          </div>
          {limit < results.length && (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => setLimit((current) => current + PAGE_SIZE)}
              disabled={disabled}
            >
              Prikaži več rezultatov
            </button>
          )}
          {results.length === 0 && <p className="text-xs text-muted-foreground">Ni zadetkov.</p>}
        </div>
      )}
    </div>
  );
}