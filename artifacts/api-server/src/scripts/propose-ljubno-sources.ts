import { creatorSourcesTable, db } from "@workspace/db";
import {
  canonicalizeCreatorSourceUrl,
  retrieveRobotsEvidence,
} from "../lib/creatorSourceReader";

const municipality = "Ljubno ob Savinji";

const proposals = [
  { label: "Občina Ljubno", sourceKind: "municipality", url: "https://www.ljubno.si/" },
  { label: "Visit Savinjska — Ljubno", sourceKind: "regional-tourism", url: "https://visitsavinjska.com/en/ljubno-ob-savinji-2/" },
  { label: "Visit Savinjska — Zgornja Savinjska dolina", sourceKind: "regional-tourism", url: "https://visitsavinjska.com/en/upper-savinja-valley/" },
  { label: "Visit Luče", sourceKind: "neighbour-tourism", url: "https://visitluce.si/" },
  { label: "Občina Luče", sourceKind: "neighbour-municipality", url: "https://www.luce.si/" },
  { label: "Logarska dolina Solčavsko", sourceKind: "neighbour-tourism", url: "https://www.logarska-solcavsko.si/" },
  { label: "Občina Solčava", sourceKind: "neighbour-municipality", url: "https://www.solcava.si/" },
  { label: "Občina Gornji Grad", sourceKind: "neighbour-municipality", url: "https://www.gornji-grad.si/" },
  { label: "Občina Nazarje", sourceKind: "neighbour-municipality", url: "https://nazarje.si/" },
  { label: "Občina Rečica ob Savinji", sourceKind: "neighbour-municipality", url: "https://www.recica.si/" },
  { label: "Visit Savinjska — Rečica ob Savinji", sourceKind: "regional-tourism", url: "https://visitsavinjska.com/en/recica-ob-savinji-2/" },
  { label: "Hribi.net — Ljubno–Koča na Travniku", sourceKind: "hiking", url: "https://www.hribi.net/izlet/ljubno_ob_savinji_koca_na_travniku/3/489/3391" },
  { label: "Hribi.net — Ljubno–Veliki Travnik", sourceKind: "hiking", url: "https://www.hribi.net/izlet/ljubno_ob_savinji_veliki_travnik_turnovka/3/488/3392" },
  { label: "Hribi.net — Smrekovec–Komen", sourceKind: "hiking", url: "https://www.hribi.net/izlet/dom_na_smrekovcu_komen_cez_smrekovec_in_krnes/3/487/821" },
] as const;

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