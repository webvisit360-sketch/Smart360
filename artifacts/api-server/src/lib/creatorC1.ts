import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import {
  categoriesTable,
  creatorPlaceProposalsTable,
  creatorProposalTranslationsTable,
  creatorRunsTable,
  db,
  sectionsTable,
} from "@workspace/db";
import { computeRoadRoute, type FetchFn } from "./distanceEngine";
import {
  CREATOR_NEAR_RING_EDGE_BAND_KM,
  CREATOR_NEAR_RING_ENVELOPE_KM,
  CREATOR_SETTLEMENT_FEATURE_RADIUS_KM,
  deriveCreatorSettlementFeatureCounts,
  enumerateCreatorNearRing,
  matchUniqueCreatorNearRingCandidate,
  type CreatorSettlementFeatureCount,
} from "./creatorNearRing";
import {
  creatorDependencyError,
  type CreatorDependencyAttempt,
  type CreatorDependencyRecorder,
} from "./creatorDependencyTelemetry";
import {
  CREATOR_MAX_QUEUE_DURATION_S,
  normalizeCreatorProposalName,
  runAndPersistCreatorSieve,
} from "./creatorProposalLedger";

export const CREATOR_C1_BATCH_SIZE = 15;
export const CREATOR_C1_LANGUAGE_CODES = ["sl", "en", "de", "it"] as const;
type Language = (typeof CREATOR_C1_LANGUAGE_CODES)[number];

export type CreatorC1Place = {
  proposedName: string;
  existingCategoryId: string | null;
  targetSettlement: string | null;
  languages: Array<{ language: Language; name: string; description: string }>;
  geocodingLookupHint: string;
  inclusionReason: string;
};

export function validateCreatorC1LocalQuota(
  places: CreatorC1Place[],
  surroundingSettlements: CreatorSettlementFeatureCount[],
  minimum = 8,
): void {
  const settlementFeatureCounts = new Map(
    surroundingSettlements.map((settlement) => [
      normalizeCreatorProposalName(settlement.name),
      settlement.featureCount,
    ]),
  );
  const targetedCounts = new Map<string, number>();
  for (const place of places) {
    if (place.targetSettlement === null) continue;
    const normalizedSettlement = normalizeCreatorProposalName(place.targetSettlement);
    const featureCount = settlementFeatureCounts.get(normalizedSettlement);
    if (featureCount === undefined) {
      throw new Error(`C1 proposal targeted an unknown settlement: ${place.targetSettlement}`);
    }
    if (!Number.isInteger(featureCount) || featureCount <= 0) {
      throw new Error(`C1 proposal targeted a settlement without catalogue features: ${place.targetSettlement}`);
    }
    const targetedCount = (targetedCounts.get(normalizedSettlement) ?? 0) + 1;
    if (targetedCount > featureCount) {
      throw new Error(
        `C1 proposal quota exceeded ${place.targetSettlement}'s ${featureCount} catalogue features.`,
      );
    }
    targetedCounts.set(normalizedSettlement, targetedCount);
  }
  const localCount = places.filter((place) => place.targetSettlement !== null).length;
  if (localCount < minimum) {
    throw new Error(`C1 batch needs at least ${minimum} local proposals; received ${localCount}.`);
  }
}

/** Deliberately has no machine-fact fields (including nested properties). */
export const CREATOR_C1_MODEL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["places"],
  properties: {
    places: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["proposedName", "existingCategoryId", "targetSettlement", "languages", "geocodingLookupHint", "inclusionReason"],
        properties: {
          proposedName: { type: "string" },
          existingCategoryId: { type: ["string", "null"] },
          targetSettlement: { type: ["string", "null"] },
          languages: {
            type: "array",
            items: {
              type: "object", additionalProperties: false,
              required: ["language", "name", "description"],
              properties: {
                language: { type: "string", enum: CREATOR_C1_LANGUAGE_CODES },
                name: { type: "string" },
                description: { type: "string" },
              },
            },
          },
          geocodingLookupHint: { type: "string" },
          inclusionReason: { type: "string" },
        },
      },
    },
  },
} as const;

function string(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Runtime validation is intentionally strict, rather than stripping lies. */
export function validateCreatorC1ModelOutput(value: unknown): CreatorC1Place[] {
  if (!Array.isArray(value)) throw new Error("C1 model output must be a JSON array.");
  return value.map((entry, i) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`C1 proposal ${i} is not an object.`);
    const row = entry as Record<string, unknown>;
    const allowed = new Set(["proposedName", "existingCategoryId", "targetSettlement", "languages", "geocodingLookupHint", "inclusionReason"]);
    if (Object.keys(row).some((key) => !allowed.has(key))) throw new Error(`C1 proposal ${i} has forbidden field.`);
    if (
      !string(row.proposedName) ||
      (row.existingCategoryId !== null && !string(row.existingCategoryId)) ||
      (row.targetSettlement !== null && !string(row.targetSettlement)) ||
      !string(row.geocodingLookupHint) ||
      !string(row.inclusionReason)
    ) {
      throw new Error(`C1 proposal ${i} has missing text.`);
    }
    if (!Array.isArray(row.languages) || row.languages.length !== 4) throw new Error(`C1 proposal ${i} needs exactly four translations.`);
    const languages = row.languages.map((translation, n) => {
      if (!translation || typeof translation !== "object" || Array.isArray(translation)) throw new Error(`C1 translation ${i}/${n} invalid.`);
      const t = translation as Record<string, unknown>;
      if (Object.keys(t).some((key) => key !== "language" && key !== "name" && key !== "description") ||
        !CREATOR_C1_LANGUAGE_CODES.includes(t.language as Language) || !string(t.name) || typeof t.description !== "string") {
        throw new Error(`C1 translation ${i}/${n} invalid.`);
      }
      return { language: t.language as Language, name: t.name.trim(), description: t.description };
    });
    if (new Set(languages.map((t) => t.language)).size !== 4) throw new Error(`C1 proposal ${i} repeats a language.`);
    return {
      proposedName: row.proposedName.trim(),
      existingCategoryId: row.existingCategoryId === null ? null : row.existingCategoryId.trim(),
      targetSettlement: row.targetSettlement === null ? null : row.targetSettlement.trim(),
      languages,
      geocodingLookupHint: row.geocodingLookupHint.trim(),
      inclusionReason: row.inclusionReason.trim(),
    };
  });
}

/** A C1 model request is valid only when it produced its complete 15-place batch. */
export function validateCreatorC1Batch(value: unknown): CreatorC1Place[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("C1 batch must be an object.");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || !("places" in record)) {
    throw new Error("C1 batch has forbidden root fields.");
  }
  const places = validateCreatorC1ModelOutput(record.places);
  if (places.length !== CREATOR_C1_BATCH_SIZE) {
    throw new Error(`C1 batch needs exactly ${CREATOR_C1_BATCH_SIZE} proposals.`);
  }
  return places;
}

export type CreatorC1ModelResult = { content: unknown; inputTokens: number; outputTokens: number; costUsd?: number };
export type CreatorC1Model = (input: {
  prompt: string;
  schema: typeof CREATOR_C1_MODEL_JSON_SCHEMA;
  onDependencyAttempt?: CreatorDependencyRecorder;
}) => Promise<CreatorC1ModelResult>;

export const CREATOR_C1_PRICING = {
  sourceUrl: "https://developers.openai.com/api/docs/models/gpt-5.6-terra",
  asOf: "2026-08-30",
  inputPerMillionUsd: 2,
  cachedInputPerMillionUsd: 0.2,
  cacheWritePerMillionUsd: 2.5,
  outputPerMillionUsd: 12,
  longContextThresholdTokens: 272_000,
} as const;

export function calculateCreatorC1Cost(input: {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
}): number {
  const freshInput = Math.max(0, input.inputTokens - input.cachedInputTokens - input.cacheWriteTokens);
  const longContext = input.inputTokens > CREATOR_C1_PRICING.longContextThresholdTokens;
  const inputMultiplier = longContext ? 2 : 1;
  const outputMultiplier = longContext ? 1.5 : 1;
  return (
    (freshInput * CREATOR_C1_PRICING.inputPerMillionUsd * inputMultiplier) +
    (input.cachedInputTokens * CREATOR_C1_PRICING.cachedInputPerMillionUsd * inputMultiplier) +
    (input.cacheWriteTokens * CREATOR_C1_PRICING.cacheWritePerMillionUsd * inputMultiplier) +
    (input.outputTokens * CREATOR_C1_PRICING.outputPerMillionUsd * outputMultiplier)
  ) / 1_000_000;
}

/** Executes one batch and makes exactly one retry for malformed model JSON. */
export async function generateCreatorC1Batch(
  model: CreatorC1Model,
  prompt: string,
  validatePlaces?: (places: CreatorC1Place[]) => void,
  onDependencyAttempt?: CreatorDependencyRecorder,
) {
  let inputTokens = 0; let outputTokens = 0; let costUsd = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await model({
      prompt,
      schema: CREATOR_C1_MODEL_JSON_SCHEMA,
      onDependencyAttempt: onDependencyAttempt
        ? (dependencyAttempt) => onDependencyAttempt({
          ...dependencyAttempt,
          attempt: attempt + 1,
        })
        : undefined,
    });
    inputTokens += result.inputTokens;
    outputTokens += result.outputTokens;
    if (typeof result.costUsd !== "number" || !Number.isFinite(result.costUsd) || result.costUsd < 0) {
      throw new Error("C1 provider did not supply trustworthy dollar cost metadata.");
    }
    costUsd += result.costUsd;
    try {
      const places = validateCreatorC1Batch(result.content);
      validatePlaces?.(places);
      return { places, inputTokens, outputTokens, costUsd };
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  throw new Error("C1 model retry unexpectedly ended.");
}

/** Default production provider; tests inject CreatorC1Model and do not load it. */
export const openAiCreatorC1Model: CreatorC1Model = async ({
  prompt,
  schema,
  onDependencyAttempt,
}) => {
  const { openai } = await import("@workspace/integrations-openai-ai-server");
  const startedAt = Date.now();
  try {
    const { data: response, response: rawResponse } = await openai.chat.completions.create({
      model: "gpt-5.6-terra",
      max_completion_tokens: 8192,
      messages: [{ role: "system", content: prompt }],
      response_format: { type: "json_schema", json_schema: { name: "creator_c1_places", strict: true, schema } },
    }).withResponse();
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("C1 model returned no content.");
    const provider = response as unknown as {
      cost?: number;
      usage?: {
        cost?: number;
        input_tokens?: number;
        prompt_tokens?: number;
        output_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
      };
    };
    const parsedContent = JSON.parse(content);
    const inputTokens = provider.usage?.input_tokens ?? provider.usage?.prompt_tokens ?? 0;
    const outputTokens = provider.usage?.output_tokens ?? provider.usage?.completion_tokens ?? 0;
    onDependencyAttempt?.({
      dependency: "openai",
      operation: "completion",
      attempt: 1,
      ok: true,
      httpStatus: rawResponse.status,
      durationMs: Date.now() - startedAt,
      rawElementCount: response.choices.length,
      filteredElementCount: 1,
      query: null,
      error: null,
    });
    return {
      content: parsedContent,
      inputTokens,
      outputTokens,
      costUsd: provider.cost ?? provider.usage?.cost ?? calculateCreatorC1Cost({
        inputTokens,
        outputTokens,
        cachedInputTokens: provider.usage?.prompt_tokens_details?.cached_tokens ?? 0,
        cacheWriteTokens: provider.usage?.prompt_tokens_details?.cache_write_tokens ?? 0,
      }),
    };
  } catch (error) {
    const status = Number((error as { status?: unknown })?.status);
    onDependencyAttempt?.({
      dependency: "openai",
      operation: "completion",
      attempt: 1,
      ok: false,
      httpStatus: Number.isFinite(status) ? status : null,
      durationMs: Date.now() - startedAt,
      rawElementCount: null,
      filteredElementCount: null,
      query: null,
      error: creatorDependencyError(error),
    });
    throw error;
  }
};

export function isCreatorC1PracticalCategory(category: { label: string; key: string | null }): boolean {
  return /\b(atm|bankomat|shop|trgov|pharmacy|lekar|fuel|bencin|doctor|zdrav|health|post|pošta)\b/i
    .test(`${category.key ?? ""} ${category.label}`);
}

export function isCreatorC1NoDescriptionCategory(category: { label: string; key: string | null }): boolean {
  return isCreatorC1PracticalCategory(category) ||
    /\b(hospitality|restaurant|food|hrana|pijača|gostil|restavr)\b/i.test(`${category.key ?? ""} ${category.label}`);
}

export function withCreatorC1DescriptionPolicy(
  category: { label: string; key: string | null } | null,
  languages: CreatorC1Place["languages"],
) {
  return languages.map((translation) => ({
    ...translation,
    description: category && isCreatorC1NoDescriptionCategory(category) ? "" : translation.description,
  }));
}

export function assignCreatorC1Range(input: {
  isNearestPractical: boolean;
  durationMinutes: number | null;
}): "practical" | "near" | "excursion" {
  if (input.isNearestPractical) return "practical";
  return input.durationMinutes !== null && input.durationMinutes <= 20 ? "near" : "excursion";
}

export function promptFor(input: {
  origin: { latitude: number; longitude: number };
  region: string;
  tenantType: string;
  categories: Array<{ id: string; label: string; key: string | null }>;
  rejectedNames: string[];
  priorProposedNames: string[];
  alreadyConfirmedNames: string[];
  surroundingSettlements: CreatorSettlementFeatureCount[];
}): string {
  return `You are Creator C1. Produce an object with a "places" array containing exactly ${CREATOR_C1_BATCH_SIZE} real place proposals.
Origin: ${input.origin.latitude}, ${input.origin.longitude}; machine-resolved region: ${input.region}; accommodation: ${input.tenantType}.
Use only these existing categories: ${JSON.stringify(input.categories)}.
Never propose any durable rejection: ${JSON.stringify(input.rejectedNames)}.
These machine-confirmed canonical places are already in the guide; do not propose them again: ${JSON.stringify(input.alreadyConfirmedNames)}.
Do not repeat any name already proposed by an earlier batch in this run: ${JSON.stringify(input.priorProposedNames)}. All 15 names in this batch must also be distinct.
Machine-resolved local settlement set, nearest first, with the number of distinct whitelisted non-settlement OSM features assigned to each settlement: ${JSON.stringify(input.surroundingSettlements)}. Each listed feature was assigned only to its nearest settlement within ${CREATOR_SETTLEMENT_FEATURE_RADIUS_KM} km; zero-feature settlements were removed.
For at least 8 of the 15 proposals, target a place in that exact named settlement set and copy its canonical name into targetSettlement. Use null targetSettlement only for the remaining excursions. A non-null targetSettlement must exactly match one supplied name; do not invent, alter or substitute settlement names. Never target more proposals to one settlement than its supplied featureCount. The counts show where real catalogue evidence exists; they are not permission to invent unnamed places.
Propose only editorial places for near surroundings and excursions. Never propose proximity-selected practical services such as ATMs, shops, supermarkets, pharmacies, fuel stations, doctors, health centres or post offices; those are machine-query work.
Anchor every proposal to the stated origin. Target a useful geographic mix: roughly half of the 15 proposals should be places reasonably expected within about 20 minutes' drive of the origin; the rest should be excursions reasonably expected within 90 minutes' drive. Do not propose any place expected to require more than 90 minutes' driving. Never invent or report measurements; the server alone calculates and assigns every range.
House style: concise, factual, useful to a guest, natural rather than promotional, and free of superlatives or unstable operational claims. Write Slovene first and faithful English, German and Italian translations. Descriptions MUST be empty in every language for hospitality categories. A null category is allowed only when no existing category fits and the inclusion reason explains why.
No coordinates, distances, travel times, addresses, opening hours, prices, phone numbers, or other machine facts. A server verifies existence and routing.`;
}

export type CreatorC1Report = {
  proposed: number; confirmed: number; unconfirmed: number; duplicatesMerged: number;
  outsidePractical: number; outsideNear: number; outsideExcursion: number; routeFailures: number; inputTokens: number; outputTokens: number;
  costUsd: number; wallClockMs: number; nominatimThrottleWaitMs: number;
  nearEnvelopeKm: number | null; nearEnvelopeEdgeBandCount: number | null;
  dependencyAttempts: CreatorDependencyAttempt[];
  nearCatalogue: {
    status: "success" | "partial" | "empty" | "failed";
    requestCount: number;
    httpStatuses: Array<number | null>;
    durationMs: number;
    rawElementCount: number;
    filteredElementCount: number;
    error: string | null;
    queries: string[];
  };
  surroundingSettlements: string[];
  surroundingSettlementFeatureCounts: CreatorSettlementFeatureCount[];
  minimumLocalProposalsPerBatch: number;
  localProposalCount: number;
  quotaTargetedProposalCount: number;
  quotaTargetedUnconfirmedCount: number;
  nearRingResolvedAfterGlobalSieveFailedCount: number;
  status: "completed" | "failed";
  pricing: typeof CREATOR_C1_PRICING;
  outcomes: Array<{
    proposedName: string;
    categoryLabel: string | null;
    inclusionReason: string;
    outcome: "confirmed" | "unconfirmed" | "duplicate" | "route_failed";
    refusalRule: string | null;
    roadDistanceM: number | null;
    travelDurationS: number | null;
    nearestAlternatives: Array<{
      proposedName: string;
      categoryLabel: string | null;
      outcome: "confirmed" | "unconfirmed" | "route_failed";
      refusalRule: string | null;
      roadDistanceM: number | null;
      travelDurationS: number | null;
      proximityKnown: boolean;
    }>;
  }>;
  unconfirmedByCategory: Array<{
    categoryLabel: string | null;
    proposals: Array<{
      proposedName: string;
      inclusionReason: string;
      refusalRule: string | null;
      roadDistanceM: number | null;
      travelDurationS: number | null;
    }>;
  }>;
  error?: string;
};

export function serializeCreatorC1Report(report: CreatorC1Report): string {
  return JSON.stringify(report);
}

function lastFailedDependencyAttempt(
  attempts: CreatorDependencyAttempt[],
): CreatorDependencyAttempt | undefined {
  return [...attempts].reverse().find((attempt) => !attempt.ok);
}

function sanitizedError(error: unknown): string {
  const message = error instanceof Error ? error.message : "C1 run failed.";
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

export async function runCreatorC1(input: {
  tenantId: string; origin: { latitude: number; longitude: number }; region: string; tenantType: string;
  model?: CreatorC1Model; fetchFn?: FetchFn; osrm?: typeof computeRoadRoute; batches?: number;
  claimedRunId?: string;
}): Promise<{ runId: string; report: CreatorC1Report }> {
  const started = Date.now();
  const [run] = input.claimedRunId
    ? await db.select().from(creatorRunsTable).where(and(
      eq(creatorRunsTable.id, input.claimedRunId),
      eq(creatorRunsTable.tenantId, input.tenantId),
      eq(creatorRunsTable.status, "running"),
    )).limit(1)
    : await db.insert(creatorRunsTable).values({
      tenantId: input.tenantId, originLatitude: input.origin.latitude, originLongitude: input.origin.longitude,
    }).returning();
  if (!run) throw new Error("C1 run could not be created.");
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  let nominatimThrottleWaitMs = 0;
  let proposed = 0;
  const outcomes: CreatorC1Report["outcomes"] = [];
  const dependencyAttempts: CreatorDependencyAttempt[] = [];
  const recordDependencyAttempt: CreatorDependencyRecorder = (attempt) => {
    dependencyAttempts.push(attempt);
  };
  const report: CreatorC1Report = {
    proposed: 0, confirmed: 0, unconfirmed: 0, duplicatesMerged: 0,
    outsidePractical: 0, outsideNear: 0, outsideExcursion: 0, routeFailures: 0,
    inputTokens: 0, outputTokens: 0, costUsd: 0, wallClockMs: 0,
    nominatimThrottleWaitMs: 0, status: "completed", pricing: CREATOR_C1_PRICING, outcomes,
    nearEnvelopeKm: CREATOR_NEAR_RING_ENVELOPE_KM, nearEnvelopeEdgeBandCount: 0,
    dependencyAttempts,
    nearCatalogue: {
      status: "failed",
      requestCount: 0,
      httpStatuses: [],
      durationMs: 0,
      rawElementCount: 0,
      filteredElementCount: 0,
      error: null,
      queries: [],
    },
    surroundingSettlements: [],
    surroundingSettlementFeatureCounts: [],
    minimumLocalProposalsPerBatch: 8,
    localProposalCount: 0,
    quotaTargetedProposalCount: 0,
    quotaTargetedUnconfirmedCount: 0,
    nearRingResolvedAfterGlobalSieveFailedCount: 0,
    unconfirmedByCategory: [],
  };
  try {
    const catalogue = await db.select({ id: categoriesTable.id, label: categoriesTable.label, key: categoriesTable.key })
      .from(categoriesTable).innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .where(and(eq(sectionsTable.tenantId, input.tenantId), isNull(categoriesTable.deletedAt)));
    const categories = new Map(catalogue.map((c) => [c.id, c]));
    const rejectedNames = (await db.select({ proposedName: creatorPlaceProposalsTable.proposedName })
      .from(creatorPlaceProposalsTable)
      .where(and(
        eq(creatorPlaceProposalsTable.tenantId, input.tenantId),
        eq(creatorPlaceProposalsTable.status, "rejected"),
      ))).map((row) => row.proposedName);
    const alreadyConfirmedNames = (await db.select({
      resolvedName: creatorPlaceProposalsTable.resolvedName,
    }).from(creatorPlaceProposalsTable).where(and(
      eq(creatorPlaceProposalsTable.tenantId, input.tenantId),
      inArray(creatorPlaceProposalsTable.status, ["pending", "approved"]),
      ne(creatorPlaceProposalsTable.confirmationMethod, "operator_coordinates"),
    ))).flatMap((row) => row.resolvedName ? [row.resolvedName] : []);
    // Run evidence must describe requests made by this run, not an in-process
    // catalogue acquired by an earlier run.
    const nearCandidates = await enumerateCreatorNearRing(
      input.origin,
      input.fetchFn,
      (attempt) => recordDependencyAttempt({
        dependency: "overpass",
        operation: attempt.operation,
        attempt: attempt.attempt,
        ok: attempt.error === null,
        httpStatus: attempt.status,
        durationMs: attempt.durationMs,
        rawElementCount: attempt.rawCount,
        filteredElementCount: attempt.filteredCount,
        query: attempt.query,
        error: attempt.error,
      }),
    );
    const overpassAttempts = dependencyAttempts.filter((attempt) => attempt.dependency === "overpass");
    const finalOverpassAttempts = [...new Map(
      overpassAttempts.map((attempt) => [attempt.operation, attempt]),
    ).values()];
    const finalOverpassFailures = finalOverpassAttempts.filter((attempt) => !attempt.ok);
    report.nearCatalogue = {
      status: finalOverpassFailures.length > 0
        ? "partial"
        : nearCandidates.length === 0 ? "empty" : "success",
      requestCount: overpassAttempts.length,
      httpStatuses: overpassAttempts.map((attempt) => attempt.httpStatus),
      durationMs: overpassAttempts.reduce((sum, attempt) => sum + attempt.durationMs, 0),
      rawElementCount: overpassAttempts.reduce((sum, attempt) => sum + (attempt.rawElementCount ?? 0), 0),
      filteredElementCount: nearCandidates.length,
      error: finalOverpassFailures.map((attempt) =>
        `${attempt.operation}: ${attempt.error ?? "failed"}`).join("; ") || null,
      queries: [...new Set(overpassAttempts.map((attempt) => attempt.query).filter((query): query is string => query !== null))],
    };
    const surroundingSettlementFeatureCounts = deriveCreatorSettlementFeatureCounts(nearCandidates);
    if (surroundingSettlementFeatureCounts.length === 0) {
      throw new Error("Overpass catalogue did not provide settlements with nearby whitelisted features.");
    }
    const surroundingSettlements = surroundingSettlementFeatureCounts.map((settlement) => settlement.name);
    report.surroundingSettlements = surroundingSettlements;
    report.surroundingSettlementFeatureCounts = surroundingSettlementFeatureCounts;
    const model = input.model ?? openAiCreatorC1Model;
    const all: CreatorC1Place[] = [];
    const proposedNames = new Set<string>();
    for (let batch = 0; batch < (input.batches ?? 4); batch++) {
      const prompt = promptFor({
        origin: input.origin,
        region: input.region,
        tenantType: input.tenantType,
        categories: catalogue,
        rejectedNames,
        alreadyConfirmedNames,
        priorProposedNames: all.map((place) => place.proposedName),
        surroundingSettlements: surroundingSettlementFeatureCounts,
      });
      const generated = await generateCreatorC1Batch(model, prompt, (places) => {
        const namesInBatch = new Set<string>();
        for (const place of places) {
          const normalized = normalizeCreatorProposalName(place.proposedName);
          if (proposedNames.has(normalized) || namesInBatch.has(normalized)) {
            throw new Error(`C1 batch repeated a proposed name: ${place.proposedName}`);
          }
          namesInBatch.add(normalized);
        }
        validateCreatorC1LocalQuota(
          places,
          surroundingSettlementFeatureCounts,
          report.minimumLocalProposalsPerBatch,
        );
      });
      const quotaTargetedCount = generated.places.filter((place) => place.targetSettlement !== null).length;
      report.localProposalCount += quotaTargetedCount;
      report.quotaTargetedProposalCount += quotaTargetedCount;
      inputTokens += generated.inputTokens; outputTokens += generated.outputTokens; costUsd += generated.costUsd;
      report.inputTokens = inputTokens; report.outputTokens = outputTokens; report.costUsd = costUsd;
      for (const place of generated.places) {
        if (place.existingCategoryId !== null && !categories.has(place.existingCategoryId)) throw new Error("C1 model selected a category outside this tenant catalogue.");
        all.push(place);
        proposedNames.add(normalizeCreatorProposalName(place.proposedName));
        proposed++;
      }
    }
    report.proposed = all.length;
    const routed: Array<{ proposalId: string; category: { id: string; label: string; key: string | null } | null; duration: number | null; distance: number | null }> = [];
    for (const place of all) {
      const output = await runAndPersistCreatorSieve({
        tenantId: input.tenantId, runId: run.id, proposedName: place.proposedName,
        lookupHint: place.geocodingLookupHint, origin: input.origin, fetchFn: input.fetchFn,
        contentReady: false,
        nearFallback: async () => {
          const candidate = matchUniqueCreatorNearRingCandidate(place.proposedName, nearCandidates);
          if (!candidate) return null;
          const route = await (input.osrm ?? computeRoadRoute)(
            input.origin,
            { latitude: candidate.latitude, longitude: candidate.longitude },
            input.fetchFn,
            recordDependencyAttempt,
          );
          if (!route || Math.round(route.durationMinutes * 60) > 1200) return null;
          return { candidate, route };
        },
        onDependencyAttempt: recordDependencyAttempt,
        onNominatimWait: (milliseconds) => { nominatimThrottleWaitMs += milliseconds; report.nominatimThrottleWaitMs = nominatimThrottleWaitMs; },
      });
      const isDuplicate = output.duplicate;
      const category = place.existingCategoryId === null ? null : categories.get(place.existingCategoryId)!;
      if (isDuplicate) {
        report.duplicatesMerged++;
        outcomes.push({
          proposedName: place.proposedName,
          categoryLabel: category?.label ?? null,
          inclusionReason: place.inclusionReason,
          outcome: "duplicate",
          refusalRule: null,
          roadDistanceM: null,
          travelDurationS: null,
          nearestAlternatives: [],
        });
        // Rejected/unresolved names and canonical OSM identities never silently
        // resurrect. The run report keeps this model output as duplicate
        // evidence without overwriting content on the retained proposal.
      }
      if (!output.sourceProposal) continue;
      // Content is saved with its four translations even when the sieve rejects
      // it, so the run report/audit trail never loses model output.
      await db.transaction(async (tx) => {
        await tx.update(creatorPlaceProposalsTable).set({
          categoryId: category?.id ?? null, geocodingLookupHint: place.geocodingLookupHint, inclusionReason: place.inclusionReason,
        }).where(eq(creatorPlaceProposalsTable.id, output.sourceProposal.id));
        await tx.delete(creatorProposalTranslationsTable).where(eq(creatorProposalTranslationsTable.proposalId, output.sourceProposal.id));
        await tx.insert(creatorProposalTranslationsTable).values(
          withCreatorC1DescriptionPolicy(category, place.languages).map((translation) => ({
            proposalId: output.sourceProposal!.id, ...translation,
          })),
        );
      });
      if (isDuplicate) continue;
      if (output.result?.verdict !== "resolved") {
        report.unconfirmed++;
        if (place.targetSettlement !== null) report.quotaTargetedUnconfirmedCount++;
        outcomes.push({
          proposedName: place.proposedName,
          categoryLabel: category?.label ?? null,
          inclusionReason: place.inclusionReason,
          outcome: "unconfirmed",
          refusalRule: output.result?.rule ?? null,
          roadDistanceM: null,
          travelDurationS: null,
          nearestAlternatives: [],
        });
        continue;
      }
      if (output.nearRingResolvedAfterGlobalSieveFailed) {
        report.nearRingResolvedAfterGlobalSieveFailedCount++;
        if (
          output.result.candidate.distanceKm >=
            CREATOR_NEAR_RING_ENVELOPE_KM - CREATOR_NEAR_RING_EDGE_BAND_KM &&
          Math.round(output.nearRingRoute!.durationMinutes * 60) >= 1000
        ) report.nearEnvelopeEdgeBandCount = (report.nearEnvelopeEdgeBandCount ?? 0) + 1;
      }
      const route = output.nearRingResolvedAfterGlobalSieveFailed && output.nearRingRoute
        ? output.nearRingRoute
        : input.osrm
          ? await input.osrm(input.origin, { latitude: output.result.candidate.latitude, longitude: output.result.candidate.longitude }, input.fetchFn)
          : await computeRoadRoute(
            input.origin,
            { latitude: output.result.candidate.latitude, longitude: output.result.candidate.longitude },
            input.fetchFn,
            recordDependencyAttempt,
          );
      if (!route) {
        report.routeFailures++;
        report.unconfirmed++;
        if (place.targetSettlement !== null) report.quotaTargetedUnconfirmedCount++;
        outcomes.push({
          proposedName: place.proposedName,
          categoryLabel: category?.label ?? null,
          inclusionReason: place.inclusionReason,
          outcome: "route_failed",
          refusalRule: "osrm-unavailable",
          roadDistanceM: null,
          travelDurationS: null,
          nearestAlternatives: [],
        });
        await db.update(creatorPlaceProposalsTable).set({
          status: "unresolved", refusalReason: "osrm-unavailable",
        }).where(eq(creatorPlaceProposalsTable.id, output.sourceProposal.id));
        continue;
      }
      const durationS = Math.round(route.durationMinutes * 60);
      if (durationS > CREATOR_MAX_QUEUE_DURATION_S) {
        report.outsideExcursion++;
        report.unconfirmed++;
        if (place.targetSettlement !== null) report.quotaTargetedUnconfirmedCount++;
        outcomes.push({
          proposedName: place.proposedName,
          categoryLabel: category?.label ?? null,
          inclusionReason: place.inclusionReason,
          outcome: "unconfirmed",
          refusalRule: "duration-ceiling",
          roadDistanceM: route.distanceMeters,
          travelDurationS: durationS,
          nearestAlternatives: [],
        });
        await db.update(creatorPlaceProposalsTable).set({
          status: "unresolved", refusalReason: "duration-ceiling",
          roadDistanceM: route.distanceMeters, travelDurationS: durationS,
        }).where(eq(creatorPlaceProposalsTable.id, output.sourceProposal.id));
        continue;
      }
      report.confirmed++;
      outcomes.push({
        proposedName: place.proposedName,
        categoryLabel: category?.label ?? null,
        inclusionReason: place.inclusionReason,
        outcome: "confirmed",
        refusalRule: null,
        roadDistanceM: route.distanceMeters,
        travelDurationS: durationS,
        nearestAlternatives: [],
      });
      await db.transaction(async (tx) => {
        await tx.update(creatorPlaceProposalsTable).set({
          roadDistanceM: route.distanceMeters, travelDurationS: durationS,
        }).where(eq(creatorPlaceProposalsTable.id, output.sourceProposal.id));
      });
      routed.push({ proposalId: output.sourceProposal.id, category, duration: route.durationMinutes, distance: route.distanceMeters });
    }
    // Practical results are ranked, not radius-filtered. Only the closest five
    // in a practical category receive the practical range; every other place is
    // still retained and classified by driving time.
    const practical = new Map<string, typeof routed>();
    for (const row of routed) if (row.category && isCreatorC1PracticalCategory(row.category)) practical.set(row.category.id, [...(practical.get(row.category.id) ?? []), row]);
    const practicalIds = new Set([...practical.values()].flatMap((rows) => rows.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)).slice(0, 5).map((r) => r.proposalId)));
    for (const row of routed) {
      const range = assignCreatorC1Range({ isNearestPractical: practicalIds.has(row.proposalId), durationMinutes: row.duration });
      if (row.category && isCreatorC1PracticalCategory(row.category) && range !== "practical") report.outsidePractical++;
      if (range !== "near" && range !== "practical") report.outsideNear++;
      if (row.duration !== null && row.duration > 90) report.outsideExcursion++;
      await db.update(creatorPlaceProposalsTable).set({ range }).where(eq(creatorPlaceProposalsTable.id, row.proposalId));
    }
    for (const outcome of outcomes) {
      if (outcome.outcome !== "confirmed" || outcome.travelDurationS === null || outcome.travelDurationS <= 20 * 60) continue;
      outcome.nearestAlternatives = outcomes
        .filter((alternative) =>
          alternative !== outcome &&
          alternative.categoryLabel === outcome.categoryLabel &&
          alternative.outcome !== "duplicate" &&
          (
            alternative.outcome === "unconfirmed" ||
            (
              alternative.outcome === "confirmed" &&
              alternative.travelDurationS !== null &&
              alternative.travelDurationS < outcome.travelDurationS!
            )
          ))
        .map((alternative) => ({
          proposedName: alternative.proposedName,
          categoryLabel: alternative.categoryLabel,
          outcome: alternative.outcome as "confirmed" | "unconfirmed" | "route_failed",
          refusalRule: alternative.refusalRule,
          roadDistanceM: alternative.roadDistanceM,
          travelDurationS: alternative.travelDurationS,
          proximityKnown: alternative.travelDurationS !== null,
        }))
        .sort((a, b) => {
          if (a.proximityKnown !== b.proximityKnown) return a.proximityKnown ? -1 : 1;
          return (a.travelDurationS ?? Infinity) - (b.travelDurationS ?? Infinity);
        });
    }
    const unconfirmedGroups = new Map<string | null, CreatorC1Report["unconfirmedByCategory"][number]["proposals"]>();
    for (const outcome of outcomes) {
      if (outcome.outcome !== "unconfirmed" && outcome.outcome !== "route_failed") continue;
      const proposals = unconfirmedGroups.get(outcome.categoryLabel) ?? [];
      proposals.push({
        proposedName: outcome.proposedName,
        inclusionReason: outcome.inclusionReason,
        refusalRule: outcome.refusalRule,
        roadDistanceM: outcome.roadDistanceM,
        travelDurationS: outcome.travelDurationS,
      });
      unconfirmedGroups.set(outcome.categoryLabel, proposals);
    }
    report.unconfirmedByCategory = [...unconfirmedGroups.entries()]
      .map(([categoryLabel, proposals]) => ({
        categoryLabel,
        proposals: proposals.sort((a, b) =>
          (a.travelDurationS ?? Infinity) - (b.travelDurationS ?? Infinity)),
      }))
      .sort((a, b) => (a.categoryLabel ?? "").localeCompare(b.categoryLabel ?? "", "sl"));
    report.wallClockMs = Date.now() - started;
    await db.transaction(async (tx) => {
      await tx.update(creatorRunsTable).set({
        status: "completed", reportJson: serializeCreatorC1Report(report),
        inputTokens, outputTokens, costUsd,
        nominatimThrottleWaitMs: report.nominatimThrottleWaitMs,
        completedAt: new Date(),
      }).where(eq(creatorRunsTable.id, run.id));
       await tx.update(creatorPlaceProposalsTable).set({ contentReady: true }).where(and(
         eq(creatorPlaceProposalsTable.runId, run.id),
         inArray(creatorPlaceProposalsTable.status, ["pending", "unresolved"]),
       ));
    });
    return { runId: run.id, report };
  } catch (error) {
    report.proposed = proposed;
    report.inputTokens = inputTokens;
    report.outputTokens = outputTokens;
    report.costUsd = costUsd;
    report.wallClockMs = Date.now() - started;
    report.nominatimThrottleWaitMs = nominatimThrottleWaitMs;
    report.status = "failed";
    report.error = sanitizedError(error);
    const overpassAttempts = dependencyAttempts.filter((attempt) => attempt.dependency === "overpass");
    if (overpassAttempts.length > 0 && report.nearCatalogue.requestCount === 0) {
      report.nearCatalogue = {
        status: "failed",
        requestCount: overpassAttempts.length,
        httpStatuses: overpassAttempts.map((attempt) => attempt.httpStatus),
        durationMs: overpassAttempts.reduce((sum, attempt) => sum + attempt.durationMs, 0),
        rawElementCount: overpassAttempts.reduce((sum, attempt) => sum + (attempt.rawElementCount ?? 0), 0),
        filteredElementCount: overpassAttempts.reduce((sum, attempt) => sum + (attempt.filteredElementCount ?? 0), 0),
        error: lastFailedDependencyAttempt(overpassAttempts)?.error ?? creatorDependencyError(error),
        queries: [...new Set(overpassAttempts.map((attempt) => attempt.query).filter((query): query is string => query !== null))],
      };
    }
    await db.update(creatorRunsTable).set({
      status: "failed", reportJson: serializeCreatorC1Report(report),
      inputTokens, outputTokens, costUsd, nominatimThrottleWaitMs, completedAt: new Date(),
    }).where(eq(creatorRunsTable.id, run.id));
    throw error;
  }
}