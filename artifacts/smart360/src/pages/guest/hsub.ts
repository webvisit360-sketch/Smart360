// Subtitle line under a category thumbnail — used on the mediterran home rows
// AND in the subpage header, so it lives in one place.
// Slovene declines by count: 1 / 2 / 3-4 / 5+ (naive "${n} priporočil" writes "1 priporočil").
// When translations arrive, each language needs its own plural forms — do not reuse this for English.

export function pl(n: number, f: [string, string, string, string]): string {
  const r = n % 100;
  const i = r === 1 ? 0 : r === 2 ? 1 : r === 3 || r === 4 ? 2 : 3;
  return `${n} ${f[i]}`;
}

type CatLike = {
  layout?: string | null;
  items?: Array<{ isVisible?: boolean; price?: string | null; priceUnit?: string | null }> | null;
};

export function hsub(cat: CatLike): string {
  const items = (cat.items ?? []).filter((i) => i.isVisible !== false);
  const n = items.length;
  switch (cat.layout) {
    case "products": {
      const first = items[0];
      if (first?.price) {
        const unit = first.priceUnit ? ` ${first.priceUnit.replace(/^\/?\s*/, "/ ")}` : "";
        return `${first.price}${unit}`.trim();
      }
      return pl(n, ["možnost", "možnosti", "možnosti", "možnosti"]);
    }
    case "poi":
      return `${pl(n, ["priporočilo", "priporočili", "priporočila", "priporočil"])} v bližini`;
    case "routes":
      return pl(n, ["pot", "poti", "poti", "poti"]);
    case "events":
      return `${pl(n, ["kraj", "kraja", "kraji", "krajev"])} z dogodki`;
    case "apartments":
      return pl(n, ["apartma", "apartmaja", "apartmaji", "apartmajev"]);
    case "rules":
      return "Pravila in navodila";
    default:
      return "Informacije";
  }
}
