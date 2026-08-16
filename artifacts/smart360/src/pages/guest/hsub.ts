// Subtitle line under a category thumbnail — used on the mediterran home rows
// AND in the subpage header, so it lives in one place.
// Plural forms come from Intl.PluralRules via i18n.plural() — never if/else
// chains per language.

import { plural, makeT } from "./i18n";

type CatLike = {
  layout?: string | null;
  items?: Array<{ isVisible?: boolean; price?: string | null; priceUnit?: string | null }> | null;
};

type TenantLike = {
  ui?: Record<string, string> | null;
  plurals?: Record<string, Record<string, string>> | null;
};

export function hsub(cat: CatLike, tenant?: TenantLike | null, lang = "sl"): string {
  const t = makeT(tenant, lang);
  const items = (cat.items ?? []).filter((i) => i.isVisible !== false);
  const n = items.length;
  switch (cat.layout) {
    case "products": {
      const first = items[0];
      if (first?.price) {
        const unit = first.priceUnit ? ` ${first.priceUnit.replace(/^\/?\s*/, "/ ")}` : "";
        return `${first.price}${unit}`.trim();
      }
      return plural(tenant, lang, "options", n);
    }
    case "poi":
      return `${plural(tenant, lang, "places", n)} ${t("UI.nearby")}`;
    case "routes":
      return plural(tenant, lang, "routes", n);
    case "events":
      return `${plural(tenant, lang, "places", n)} ${t("UI.withEvents")}`;
    case "apartments":
      return plural(tenant, lang, "apartments", n);
    case "rules":
      return t("UI.rules.sub");
    default:
      return t("UI.info");
  }
}
