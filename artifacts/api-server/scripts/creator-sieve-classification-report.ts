import { runCreatorSieveClassificationHarness } from "../src/lib/creatorSieve";

const origin = { latitude: 46.311456, longitude: 14.9093051 };
const names = [
  "Varpolje",
  "Mozirje",
  "Nazarje",
  "Savinjska cesta",
  "Občina Rečica ob Savinji",
  "3332",
];

for (const name of names) {
  const result = await runCreatorSieveClassificationHarness(name, origin);
  console.log(JSON.stringify({ name, ...result }));
  if (
    result.verdict !== "refused" ||
    result.rule !== "blocked-class-or-addresstype"
  ) {
    process.exitCode = 1;
  }
}