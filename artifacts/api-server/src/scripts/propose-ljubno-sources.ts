import { creatorSourcesTable, db } from "@workspace/db";
import { and, eq, notInArray } from "drizzle-orm";
import {
  canonicalizeCreatorSourceUrl,
  retrieveRobotsEvidence,
} from "../lib/creatorSourceReader";

const municipality = "Ljubno ob Savinji";

const proposals = [
  { label: "Občina Ljubno", sourceKind: "municipality", url: "https://www.ljubno.si/" },
  { label: "Visit Savinjska — Ljubno", sourceKind: "regional-tourism", url: "https://visitsavinjska.com/ljubno-ob-savinji/" },
  { label: "Visit Savinjska — Zgornja Savinjska dolina", sourceKind: "regional-tourism", url: "https://visitsavinjska.com/savinjska-in-saleska-dolina/" },
  { label: "Visit Luče", sourceKind: "neighbour-tourism", url: "https://visitluce.si/" },
  { label: "Občina Luče", sourceKind: "neighbour-municipality", url: "https://www.luce.si/" },
  { label: "Logarska dolina Solčavsko", sourceKind: "neighbour-tourism", url: "https://www.logarska-solcavsko.si/" },
  { label: "Visit Savinjska — Solčava", sourceKind: "regional-tourism", url: "https://visitsavinjska.com/solcava/" },
  { label: "Visit Savinjska — Logarska dolina in krajinski parki", sourceKind: "regional-tourism", url: "https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/" },
  { label: "Občina Solčava", sourceKind: "neighbour-municipality", url: "https://www.solcava.si/" },
  { label: "Občina Gornji Grad", sourceKind: "neighbour-municipality", url: "https://www.gornji-grad.si/" },
  { label: "Občina Nazarje", sourceKind: "neighbour-municipality", url: "https://nazarje.si/" },
  { label: "Občina Rečica ob Savinji", sourceKind: "neighbour-municipality", url: "https://www.recica.si/" },
  { label: "Visit Savinjska — Rečica ob Savinji", sourceKind: "regional-tourism", url: "https://visitsavinjska.com/recica-ob-savinji/" },
  { label: "Hribi.net — izhodišče Ljubno ob Savinji", sourceKind: "hiking-index", url: "https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315" },
  { label: "Hribi.net — Smrekovec", sourceKind: "hiking-index", url: "https://www.hribi.net/gora/smrekovec/3/485" },
  { label: "Hribi.net — Kamniško-Savinjske Alpe", sourceKind: "hiking-index", url: "https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3" },
  { label: "Občina Mozirje", sourceKind: "neighbour-municipality", url: "https://mozirje.si/" },
  { label: "Visit Savinjska — Mozirje", sourceKind: "regional-tourism", url: "https://visitsavinjska.com/mozirje/" },
] as const;

const amendedCanonicalUrls = proposals.map((proposal) => canonicalizeCreatorSourceUrl(proposal.url));
await db.update(creatorSourcesTable).set({
  status: "rejected",
  updatedAt: new Date(),
}).where(and(
  eq(creatorSourcesTable.municipality, municipality),
  eq(creatorSourcesTable.status, "proposed"),
  notInArray(creatorSourcesTable.canonicalUrl, amendedCanonicalUrls),
));

const stored = [];
for (const proposal of proposals) {
  const canonicalUrl = canonicalizeCreatorSourceUrl(proposal.url);
  const [source] = await db.insert(creatorSourcesTable).values({
    municipality,
    ...proposal,
    canonicalUrl,
    status: "proposed",
  }).onConflictDoUpdate({
    target: [creatorSourcesTable.municipality, creatorSourcesTable.canonicalUrl],
    set: {
      label: proposal.label,
      sourceKind: proposal.sourceKind,
      url: proposal.url,
      updatedAt: new Date(),
    },
  }).returning();
  if (source) stored.push(source);
}

const allowedRedirectOrigins = new Set(stored.map((source) => new URL(source.canonicalUrl).origin));
for (const source of stored) {
  const evidence = await retrieveRobotsEvidence(source, {
    allowedRedirectOrigins,
    useCache: false,
  });
  process.stdout.write(`${JSON.stringify({
    label: source.label,
    url: source.canonicalUrl,
    decision: evidence.decision,
    allowed: evidence.allowed,
    robotsUrl: evidence.requestedRobotsUrl,
    finalRobotsUrl: evidence.finalRobotsUrl,
    httpStatus: evidence.httpStatus,
    matchedRule: evidence.matchedRule,
    policySha256: evidence.policySha256,
    fetchedAt: evidence.fetchedAt.toISOString(),
    expiresAt: evidence.expiresAt.toISOString(),
    error: evidence.error,
  })}\n`);
}