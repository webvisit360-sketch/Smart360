import { runCreatorSieve } from "../src/lib/creatorSieve";

const origin = { latitude: 46.311456, longitude: 14.9093051 };
const originalNames = [
  "Logarska dolina", "Slap Rinka", "Mozirski gaj", "Golte", "Robanov kot",
  "Center Rinka Solčava", "Snežna jama na Raduhi",
  "Muzej lončarstva Varpolje", "Etnološki muzej Rečica ob Savinji",
  "Razgledni stolp Varpolje", "Galerija Savinja Nazarje", "Akvarij Menina",
];
const roundTwoNames = [
  "Varpolje", "Rečica ob Savinji", "Mozirje", "Nazarje", "Savinjska cesta",
  "Grad Menina", "Center Varpolje", "Muzej Golte",
];
const names = process.argv[2] === "round-two" ? roundTwoNames : originalNames;

for (const name of names) {
  const result = await runCreatorSieve(name, origin);
  console.log(JSON.stringify({ name, ...result }));
}