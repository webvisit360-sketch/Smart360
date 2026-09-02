export type CreatorAccommodationExclusion = {
  excluded: boolean;
  reason: string | null;
};

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/\p{M}/gu, "")
  .toLocaleLowerCase("sl");

const ACCOMMODATION = /\b(kamp(?:ing|i|a|u|ov)?|camp(?:ing|site)?|glamping(?:i|a|u|ov)?|hotel(?:i|a|u|ov)?|hostel(?:i|a|u|ov)?|motel(?:i|a|u|ov)?|penzion(?:i|a|u|ov)?|pension|guest\s*house|villa|vila|chalet|resort|b\s*(?:&|in|and)\s*b|bed\s+and\s+breakfast|apartma(?:ji|ja|ju|jev|n)?|apartmajsk(?:a|e|i|o|ih)?\s+his(?:a|e|i|o|ah)|sobe?|sobah|rooms?|room\s+rental|pocitnisk(?:a|e|i|o|ih)?\s+his(?:a|e|i|o|ah)|holiday\s+homes?|prenocisc(?:e|a|u|ih)|nastanit(?:ev|ve|vah)|lodging)\b/u;
const TOURIST_FARM = /\b(turisticn(?:a|e|i|o|ih)?\s+kmetij(?:a|e|i|o|ah)|farm\s+stay|agriturismo)\b/u;
const LODGING_GOSTISCE = /\b(gostisce)\b/u;
const LODGING_CONTEXT = /\b(prenocisc(?:e|a|u|ih)|nastanit(?:ev|ve|vah)|sobe?|rooms?|lodging|bed\s+and\s+breakfast|zajtrk)\b/u;
const PUBLIC_FOOD = /\b(restavracij(?:a|e|i|o|ah)|restaurant|gostiln(?:a|e|i|o|ah)|okrepcevalnic(?:a|e|i|o|ah)|izletnisk(?:a|e|i|o|ih)?\s+kmetij(?:a|e|i|o|ah)|domac(?:a|e|i|o|ih)?\s+kuhinj(?:a|e|i|o|ah)|kosil(?:o|a|u|om)|javn(?:a|e|i|o)\s+prehran(?:a|e|i|o))\b/u;

export function classifyCreatorAccommodationProvider(input: {
  name: string;
  categoryKey: string;
  evidence: string;
}): CreatorAccommodationExclusion {
  const name = normalize(input.name);
  const evidence = normalize(input.evidence);
  const combined = `${name}\n${evidence}`;
  // Entity scope: a place merely described as "near a pension" or listed on
  // the same aggregation page is not itself the lodging provider.
  const touristFarmMatch = TOURIST_FARM.exec(name) ?? TOURIST_FARM.exec(evidence);
  if (touristFarmMatch?.index === 0) {
    // The model evidence is independently grounded to the named entity. Do
    // not let another restaurant listed elsewhere on an aggregation page
    // authorize this tourist farm.
    if ((input.categoryKey === "culinary" || input.categoryKey === "food") && PUBLIC_FOOD.test(combined)) {
      return { excluded: false, reason: null };
    }
    return { excluded: true, reason: "lodging-tourist-farm" };
  }
  const accommodationMatch = ACCOMMODATION.exec(name) ?? ACCOMMODATION.exec(evidence);
  if (LODGING_GOSTISCE.test(combined) && !LODGING_CONTEXT.test(combined)) {
    return { excluded: false, reason: null };
  }
  if (accommodationMatch?.index === 0) {
    return { excluded: true, reason: "accommodation-provider" };
  }
  return { excluded: false, reason: null };
}