// DEV-only comparison fixtures mirroring the published structures shown in
// the binding references (Turizem Drobež, Apartmaji Meli Pu).
type Cat = [key: string, label: string, layout?: string, orderable?: boolean];
const item = (id: string, title: string, orderEnabled = false) => ({
  id, title, subtitle: "", body: "", isVisible: true, media: [], mapQuery: "", orderEnabled,
});
const section = (key: string, label: string, cats: Cat[]) => ({
  id: `s-${key}`, key, label, isVisible: true,
  categories: cats.map(([ckey, clabel, layout = "cards", orderable = false]) => ({
    id: `c-${key}-${ckey}`, key: ckey, label: clabel, layout, isVisible: true,
    items: [item(`i-${key}-${ckey}`, clabel, orderable)],
  })),
});

export const SIMPLE_FIXTURES = {
  drobez: {
    id: "fixture-drobez", slug: "turizem-drobez", name: "Turizem Drobež",
    address: "Ter 35, 3333 Ljubno, Slovenija", phone: "+38641000000",
    latitude: 46.344, longitude: 14.833, tourRecordingEnabled: true,
    mapUrl: "https://maps.google.com/?q=Ter+35+Ljubno",
    sections: [
      section("stay", "Nastanitev", [["welcome", "Dobrodošli"], ["apartments", "Nastanitve", "apartments"], ["wifi", "Wi-Fi", "wifi"], ["rules", "Hišni red", "rules"], ["instructions", "Navodila", "tabs"], ["checkin", "Prijava / odjava"], ["parking", "Parkiranje"]]),
      section("offer", "Ponudba", [["prices", "Ponudba s cenami", "products", true], ["local", "Domači izdelki", "products", true]]),
      section("explore", "Okolica", [["sights", "Znamenitosti", "poi"], ["hike", "Pohodi", "routes"], ["bike", "Kolesarjenje", "routes"], ["program", "Program", "events"]]),
    ],
  },
  melipu: {
    id: "fixture-melipu", slug: "apartmaji-meli-pu", name: "Apartmaji Meli Pu",
    address: "Malija 143b, 6310 Izola, Slovenija", phone: "+38641000001",
    latitude: 45.53, longitude: 13.66, tourRecordingEnabled: false,
    mapUrl: "https://maps.google.com/?q=Malija+143b+Izola",
    sections: [
      section("stay", "Nastanitev", [["welcome", "Dobrodošli"], ["apartments", "Apartmaji", "apartments"], ["door", "Vhodna vrata"], ["aircon", "Klimatska naprava"], ["wifi", "Wi-Fi", "wifi"], ["rules", "Hišni red", "rules"], ["parking", "Parkiranje"]]),
      section("offer", "Ponudba", [["prices", "Ponudba s cenami", "products", true]]),
      section("explore", "Okolica", [["beach", "Plaže", "poi"], ["sights", "Znamenitosti", "poi"], ["bike", "Kolesarjenje", "routes"], ["trips", "Izleti", "poi"], ["program", "Program", "events"]]),
    ],
  },
} as const;

export type SimpleFixtureKey = keyof typeof SIMPLE_FIXTURES;

export function simpleFixtureTenant(key: string, palette: string, color: string | null): any {
  const base = SIMPLE_FIXTURES[(key in SIMPLE_FIXTURES ? key : "drobez") as SimpleFixtureKey];
  const design = palette === "trend" ? "trend" : "simple";
  return {
    ...JSON.parse(JSON.stringify(base)),
    guestUiMode: "living-guide", languages: ["sl", "en", "de", "it", "fr", "nl", "hr"],
    notices: [], sitePlanImages: [], heroUrl: null,
    guestDesign: design,
    simplePalette: design === "simple" ? (palette === "modra" || palette === "custom" ? palette : "bordo") : null,
    simpleBaseColor: palette === "custom" ? (color ?? "#2E8B6A") : null,
  };
}
