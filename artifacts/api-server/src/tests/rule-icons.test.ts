import test from "node:test";
import assert from "node:assert/strict";
import { RULE_ICON_CATALOG, matchRuleIcon, matchTileCatalog, TILE_ICON_CATALOG } from "@workspace/category-icons";

const id = (text: string) => matchRuleIcon(text).entry.id;

test("catalogue: 10 new, 4 aliases sharing existing tile SVGs, neutral default last", () => {
  assert.equal(RULE_ICON_CATALOG.length, 15);
  assert.equal(RULE_ICON_CATALOG.filter((e) => e.alias).length, 4);
  const tile = (slug: string) => TILE_ICON_CATALOG.find((e) => e.id === `catalog:${slug}`)!.svg;
  const rule = (rid: string) => RULE_ICON_CATALOG.find((e) => e.id === rid)!.svg;
  assert.equal(rule("rule:parkiranje-pravilo"), tile("parkiranje"));
  assert.equal(rule("rule:odhod-check-out"), tile("prijava-odjava"));
  assert.equal(rule("rule:nadzor-otrok"), tile("za-druzine"));
  assert.equal(rule("rule:poskodbe-javite"), tile("pomoc-in-sos"));
  assert.match(rule("rule:privzeto-pravilo"), /m4\.2 6\.2 1\.3 1\.3-6\.6 6\.6/);
});

test("reference Hišni red sentences map to the reference icons", () => {
  const cases: Array<[string, string]> = [
    ["Med 22.00 in 7.00 je treba spoštovati tišino, da se zagotovi prijetno bivanje vseh gostov in sosedov.", "rule:tisina"],
    ["Kajenje je v nastanitvi strogo prepovedano.", "rule:kajenje-prepovedano"],
    ["Odpadke je treba ločevati v skladu z lokalnimi smernicami za recikliranje.", "rule:locevanje-odpadkov"],
    ["Prosimo, da ugasnete luči in električne naprave, ko jih ne uporabljate, da prihranite energijo.", "rule:elektrika-in-luci"],
    ["V primeru kakršne koli poškodbe ali zloma, prosimo, da o tem takoj obvestite gostitelja.", "rule:poskodbe-javite"],
    ["Zabave in dogodki so strogo prepovedani.", "rule:zabave-prepovedane"],
    ["Goste vljudno prosimo, da skrbijo za čistočo in vzdržujejo red v nastanitvi.", "rule:cistoca"],
    ["Zaprite vrata, ki vodijo v stranišče.", "rule:vrata-v-stranisce"],
  ];
  for (const [text, expected] of cases) assert.equal(id(text), expected, text);
});

test("audited water stems match the reference sentence", () => {
  assert.equal(id("Prosim, varčujte z vodo."), "rule:varcevanje-z-vodo");
  assert.equal(id("Please save water."), "rule:varcevanje-z-vodo");
  for (const word of ["voda", "vode", "vodo", "vodu", "vodom"]) {
    assert.equal(id(word), "rule:varcevanje-z-vodo");
    assert.equal(matchRuleIcon(`${word}xyz`).fallback, true);
  }
  assert.equal(id("Luči in naprave, ki jih ne uporabljate, prosimo ugasnite — skupaj varčujemo z energijo."), "rule:elektrika-in-luci");
  assert.equal(id("varčujte z energijo"), "rule:elektrika-in-luci");
  assert.equal(id("Štedite energiju."), "rule:elektrika-in-luci");
  assert.equal(id("Prosimo, varčujte s toplo vodo in brisač ne odlagajte po prvi uporabi."), "rule:varcevanje-z-vodo");
});

test("multilingual examples", () => {
  assert.equal(id("Smoking is not allowed anywhere."), "rule:kajenje-prepovedano");
  assert.equal(id("Rauchen ist verboten."), "rule:kajenje-prepovedano");
  assert.equal(id("Please respect quiet hours after 22:00."), "rule:tisina");
  assert.equal(id("Haustiere sind willkommen."), "rule:hisni-ljubljencki");
  assert.equal(id("Les chiens sont acceptés."), "rule:hisni-ljubljencki");
  assert.equal(id("Open fire is prohibited."), "rule:odprt-ogenj-prepovedan");
  assert.equal(id("Check-out by 10:00."), "rule:odhod-check-out");
  assert.equal(id("Parkirajte samo na označenih mestih."), "rule:parkiranje-pravilo");
  assert.equal(id("Children must be supervised at the pool."), "rule:nadzor-otrok");
  assert.equal(id("Afval scheiden a.u.b."), "rule:locevanje-odpadkov");
  assert.equal(id("Molimo, pušenje nije dozvoljeno."), "rule:kajenje-prepovedano");
});

test("strict policy: no interior substrings, short stems exact, collision guards", () => {
  assert.equal(id("Zaprite vrata, ki vodijo na teraso."), "rule:privzeto-pravilo");
  assert.equal(id("Unsmokeable"), "rule:privzeto-pravilo");
});

test("audited stems remove previous collisions and missed forms", () => {
  assert.equal(id("Vietato fumare."), "rule:kajenje-prepovedano");
  assert.equal(id("Pets are welcome."), "rule:hisni-ljubljencki");
  for (const text of ["Bitte dann abschließen.", "Guests are kindly asked to lock the gate.", "vodnik", "vodijo", "varčujte", "Preberite vodnik.", "sončni zahod", "park", "breakfast", "kindly", "départements"]) {
    assert.equal(matchRuleIcon(text).fallback, true, text);
  }
  assert.equal(id("kind"), "rule:nadzor-otrok");
  assert.equal(id("départ"), "rule:odhod-check-out");
});

test("nonsense and empty fall back to the neutral icon", () => {
  for (const text of ["Qzxv blorf snark", "", "12345 !!!"]) {
    const r = matchRuleIcon(text);
    assert.equal(r.fallback, true);
    assert.equal(r.entry.id, "rule:privzeto-pravilo");
  }
});

test("rule stems are scoped: category tiles do not drift", () => {
  assert.equal(matchTileCatalog("Tišina"), undefined);
  assert.equal(matchTileCatalog("Kajenje"), undefined);
  assert.equal(matchTileCatalog("Parkiranje")?.id, "catalog:parkiranje");
});
