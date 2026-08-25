import sourceLedger from "virtual:meli-pu-description-ledger";
import { logger } from "./logger";
import {
  applyMeliPuDescriptionBackfill,
  type DescriptionLedgerEntry,
} from "./meliPuDescriptionBackfillCore";

const MELI_PU_TENANT_ID = "1071ca18-0281-4a23-b36b-0b0ce601f771";
const SECTION_KEY = "explore";

const groupByCategoryKey: Record<string, string> = {
  culture: "KULTURNA DEDIŠČINA",
  nature: "NARAVNA DEDIŠČINA",
  act: "AKTIVNOSTI IN IZLETI",
  trips: "AKTIVNOSTI IN IZLETI",
  beach: "PLAŽE",
  hike: "POHODNIŠTVO",
  bike: "KOLESARJENJE",
};

const targets = `
culture|Piransko obzidje|6b57bfe8-fcb3-4f67-a8f8-8f0bc6420211|6f4b5883-1171-41d0-b215-46285d12322c
culture|Tartinijev trg, Piran|40c4d14b-3228-4876-85c3-791bbf91a40e|6f4b5883-1171-41d0-b215-46285d12322c
culture|Cerkev sv. Jurija, Piran|041dfb05-504c-460c-8cdb-dfccbc79c8c2|6f4b5883-1171-41d0-b215-46285d12322c
culture|Pretorska palača, Koper|99c32f2a-f852-4808-9499-f5414b751fea|6f4b5883-1171-41d0-b215-46285d12322c
culture|Muzej Izolana — hiša morja|8fba6248-2c10-43be-b337-519784a1ee3e|6f4b5883-1171-41d0-b215-46285d12322c
culture|Grad Miramare|dd8cb7d0-3065-40a7-b0ff-2811b6bff55d|6f4b5883-1171-41d0-b215-46285d12322c
culture|Motovun|89d393c9-628e-4514-99f0-25a3a89bf1f4|6f4b5883-1171-41d0-b215-46285d12322c
nature|Krajinski park Sečoveljske soline|2817074f-bc7d-4182-902d-b03cc691011a|d955e77a-ae1d-403c-9d73-da1abdc2fc5f
nature|Strunjanske soline|d48a8d27-138e-45fd-8338-f05e1fab7e4e|d955e77a-ae1d-403c-9d73-da1abdc2fc5f
nature|Mesečev zaliv|9c0a5dd4-9dd8-4fe7-8385-c8e8d95dad0b|d955e77a-ae1d-403c-9d73-da1abdc2fc5f
nature|Strunjanski križ|53a25412-3141-49e3-ae3f-184eb9f2f752|d955e77a-ae1d-403c-9d73-da1abdc2fc5f
act|Akvarij Piran|fedef95e-df10-45df-97e7-cbd4b006f746|98631274-2c83-42c8-8e75-8be310c5ce1a
act|Vinska fontana Marezige|79500f33-bbbc-41e6-9d16-0f94650cd24e|98631274-2c83-42c8-8e75-8be310c5ce1a
act|Grad Socerb|3de8a292-d64d-46fc-afcb-4928d16cbfe9|98631274-2c83-42c8-8e75-8be310c5ce1a
act|Aquapark Istralandia|00daf11a-2631-4244-ac86-10adabdfb6cf|98631274-2c83-42c8-8e75-8be310c5ce1a
trips|Portopiccolo Sistiana|95bd0777-60b2-4333-bc4f-1f2e259b7bdd|cfcb60a5-a705-4246-aec2-8d98b59d08a9
trips|Kobilarna Lipica|d4b1ca6a-8f15-4c7b-a67b-2be1281d8a19|cfcb60a5-a705-4246-aec2-8d98b59d08a9
trips|Postojnska jama|e6eb93f0-7d38-4dfd-b6a6-cf4e7d41a995|cfcb60a5-a705-4246-aec2-8d98b59d08a9
trips|Predjamski grad|3fcdcc01-89f8-43a7-8dcf-38a96b298ccd|cfcb60a5-a705-4246-aec2-8d98b59d08a9
trips|Trst|4e13555e-eaf4-471a-a5e8-061d90589b83|cfcb60a5-a705-4246-aec2-8d98b59d08a9
beach|Plaža Svetilnik, Izola|129f8518-2ad7-4147-bf73-b7377734834e|f8941ef0-5321-4265-b161-c34f770154ee
beach|Plaža San Simon|0f690296-1957-4e00-a396-a16bc7087a52|f8941ef0-5321-4265-b161-c34f770154ee
beach|Pomol pod Belvederjem, Izola|57af2e20-10d3-4c46-8208-61ed4abc0091|f8941ef0-5321-4265-b161-c34f770154ee
beach|Plaža Strunjan|4d0faa82-9a80-4197-9472-e48a04f2da1b|f8941ef0-5321-4265-b161-c34f770154ee
beach|Plaža Fiesa|333b70dc-fa4a-4b3a-9401-d0ebd1c3b46e|f8941ef0-5321-4265-b161-c34f770154ee
beach|Plaža Mesečev zaliv|bd823a36-15fc-4be9-aabe-f7eadf7a62cb|f8941ef0-5321-4265-b161-c34f770154ee
beach|Plaža Portorož|e891e4e1-d55c-4795-a45d-792f4f0261ff|f8941ef0-5321-4265-b161-c34f770154ee
beach|Plaža Ankaran|d389bbc4-7e14-41b6-8d77-14c67873ef9e|f8941ef0-5321-4265-b161-c34f770154ee
hike|Pot srca, Strunjan|7f0ce8c9-606e-4e22-82d9-1b3ae10bdcbe|5c319f5a-6a81-4a9a-a3ab-6aec6483b620
hike|Krajša pot navkreber|ba61b0f3-d587-4b6d-bb9e-cd00c892c291|5c319f5a-6a81-4a9a-a3ab-6aec6483b620
hike|Slavnik|affa4c21-4cf2-4df5-8fc3-88ad13238dc4|5c319f5a-6a81-4a9a-a3ab-6aec6483b620
hike|Mesečev zaliv|19d6c2d5-e382-41c6-b986-76995d28db94|5c319f5a-6a81-4a9a-a3ab-6aec6483b620
hike|Koper — Izola|a3e88379-c9f1-45aa-9caf-0dfd37f38f83|5c319f5a-6a81-4a9a-a3ab-6aec6483b620
hike|Ušesa Istre|da1a269c-10ac-43b0-904e-3713c5cf8183|5c319f5a-6a81-4a9a-a3ab-6aec6483b620
hike|Napoleonska pot|59e26d15-6d44-4d59-b223-fcdd706473b5|5c319f5a-6a81-4a9a-a3ab-6aec6483b620
bike|Parenzana — celotna trasa|ad8df3df-fd17-445d-baf8-d56bc287d252|a585c160-a224-4fa4-8ab0-d68eeff2d0ac
bike|Parenzana: Izola — Piran|61ed29b6-a0cc-4231-a4f7-4e23b7369c21|a585c160-a224-4fa4-8ab0-d68eeff2d0ac
bike|Portorož — Izola — Strunjanske soline|1bf78d20-769b-4388-915a-6e3a991a4fa2|a585c160-a224-4fa4-8ab0-d68eeff2d0ac
bike|Portorož — istrsko zaledje — Padna|0290e035-822d-4800-9628-fe379a05ea46|a585c160-a224-4fa4-8ab0-d68eeff2d0ac
bike|Portorož — Piran|c782de42-64ac-4f9d-a73b-033d6bd20f77|a585c160-a224-4fa4-8ab0-d68eeff2d0ac
`.trim().split("\n").map((line) => {
  const [categoryKey, name, itemId, categoryId] = line.split("|");
  return { categoryKey: categoryKey!, name: name!, itemId: itemId!, categoryId: categoryId! };
});

export const MELI_PU_DESCRIPTION_LEDGER: ReadonlyArray<DescriptionLedgerEntry> =
  targets.map((target) => {
    const group = groupByCategoryKey[target.categoryKey];
    const matches = sourceLedger.filter(
      (entry) => entry.group === group && entry.name === target.name,
    );
    if (matches.length !== 1) {
      throw new Error(
        `Expected one supplied description for ${target.categoryKey}/${target.name}; found ${matches.length}`,
      );
    }
    return { ...target, ...matches[0]! };
  });

if (sourceLedger.length !== 40 || MELI_PU_DESCRIPTION_LEDGER.length !== 40) {
  throw new Error("Invalid Meli Pu description ledger cardinality");
}

export async function runMeliPuDescriptionBackfillAtStartup(): Promise<void> {
  try {
    const result = await applyMeliPuDescriptionBackfill(
      MELI_PU_TENANT_ID,
      SECTION_KEY,
      MELI_PU_DESCRIPTION_LEDGER,
    );
    logger.info(
      { updated: result.updated, skipped: result.skipped, report: result.report },
      "[meliPuDescriptions] guarded four-language description backfill complete",
    );
  } catch (err) {
    logger.error({ err }, "[meliPuDescriptions] failed (boot continues)");
  }
}