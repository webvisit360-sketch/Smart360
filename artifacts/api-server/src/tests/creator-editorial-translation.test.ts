import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeTranslationFailure,
  translationFailureMessage,
  withTranslationRetries,
  translateCreatorEditorial,
  translateMissingEditorial,
  type EditorialDraft,
} from "../lib/creatorEditorialTranslation";

const drafts = (
  values: Partial<Record<EditorialDraft["language"], Partial<EditorialDraft>>>,
): EditorialDraft[] =>
  (["sl", "en", "de", "it"] as const).map((language) => ({
    language,
    title: values[language]?.title ?? "",
    description: values[language]?.description ?? "",
  }));

test("editorial translation sends only operator Slovenian text and returns EN/DE/IT", async () => {
  let userContent = "";
  const translations = await translateCreatorEditorial(
    { name: "Slap", description: "Kratek opis." },
    { chat: { completions: { create: async (input: any) => {
      userContent = input.messages[1].content;
      return { choices: [{ message: { content: JSON.stringify({ translations: [
        { language: "en", title: "Waterfall", description: "Short description." },
        { language: "de", title: "Wasserfall", description: "Kurze Beschreibung." },
        { language: "it", title: "Cascata", description: "Breve descrizione." },
      ] }) } }] };
    } } } } as any,
  );
  const payload = JSON.parse(userContent);
  assert.equal(payload.tasks[0].language, "sl");
  assert.equal(payload.tasks[0].text, "Slap");
  assert.equal(payload.tasks[1].text, "Kratek opis.");
  assert.deepEqual(translations.map((translation) => translation.language), ["en", "de", "it"]);
});

test("translation tasks use an English title source and leave source-less descriptions empty", async () => {
  let request: any;
  const client = {
    chat: { completions: { create: async (input: any) => {
      request = input;
      return { choices: [{ message: { content: JSON.stringify({
        translations: [
          { language: "sl", title: "Zunanji fitnes", description: null },
          { language: "de", title: "Outdoor-Fitnessbereich", description: null },
          { language: "it", title: "Palestra all'aperto", description: null },
        ],
      }) } }] };
    } } },
  };
  const result = await translateMissingEditorial(
    drafts({ en: { title: "Outdoor gym" } }),
    client as never,
  );
  const payload = JSON.parse(request.messages[1].content);
  assert.deepEqual(payload.tasks, [{
    field: "title",
    language: "en",
    text: "Outdoor gym",
    targetLanguages: ["sl", "de", "it"],
  }]);
  assert.equal(result.find((entry) => entry.language === "sl")?.description, null);
});

test("translation service rejects content for a field that was not requested", async () => {
  const client = {
    chat: { completions: { create: async () => ({
      choices: [{ message: { content: JSON.stringify({
        translations: [
          { language: "sl", title: "Zunanji fitnes", description: "Izmišljeno" },
          { language: "de", title: "Outdoor-Fitnessbereich", description: null },
          { language: "it", title: "Palestra all'aperto", description: null },
        ],
      }) } }],
    }) } },
  };
  await assert.rejects(
    translateMissingEditorial(drafts({ en: { title: "Outdoor gym" } }), client as never),
    /varno preveriti/,
  );
});

test("strict Slovenian mode never falls back to populated target fields", async () => {
  let called = false;
  const result = await translateMissingEditorial(
    drafts({ en: { title: "English only", description: "English description" } }),
    { chat: { completions: { create: async () => {
      called = true;
      throw new Error("must not call AI");
    } } } } as never,
    "sl",
  );
  assert.deepEqual(result, []);
  assert.equal(called, false);
});

test("429 retries with bounded delay, disables SDK retries and succeeds without logging content", async () => {
  const logs: unknown[] = [];
  const sleeps: number[] = [];
  let calls = 0;
  const client = { chat: { completions: { create: async (_input: unknown, options: any) => {
    assert.equal(options.maxRetries, 0);
    if (++calls === 1) throw { status: 429, code: "rate_limit_exceeded",
      headers: { get: () => "2" }, message: "SECRET operator content" };
    return { choices: [{ message: { content: JSON.stringify({ translations: [
      { language: "en", title: "Waterfall", description: null },
      { language: "de", title: "Wasserfall", description: null },
      { language: "it", title: "Cascata", description: null },
    ] }) } }] };
  } } } };
  const result = await translateMissingEditorial(drafts({ sl: { title: "Slap" } }),
    client as never, "sl", { random: () => 0, sleep: async (ms) => { sleeps.push(ms); },
      log: (event, data) => logs.push({ event, ...data }) });
  assert.equal(result.length, 3);
  assert.deepEqual(sleeps, [2000]);
  assert.equal(calls, 2);
  assert.deepEqual(logs.map((entry: any) => entry.event), ["failed_attempt", "retry"]);
  assert.doesNotMatch(JSON.stringify(logs), /SECRET|Slap/);
});

test("429 exhaustion is exactly three attempts; quota 429 never retries", async () => {
  for (const [code, expected] of [["rate_limit_exceeded", 3], ["insufficient_quota", 1]] as const) {
    let calls = 0;
    const logs: unknown[] = [];
    const sleeps: number[] = [];
    await assert.rejects(withTranslationRetries(async () => {
      calls++;
      throw { status: 429, error: { code }, message: "PRIVATE" };
    }, { random: () => 0, sleep: async (ms) => { sleeps.push(ms); },
      log: (event, metadata) => logs.push({ event, ...metadata }) }),
    (error: any) => error.category === (expected === 1 ? "quota" : "rate_limit"));
    assert.equal(calls, expected);
    assert.deepEqual(sleeps, expected === 1 ? [] : [375, 750]);
    assert.deepEqual(logs.map((entry: any) => entry.event), expected === 1
      ? ["failed_attempt", "exhausted"]
      : ["failed_attempt", "retry", "failed_attempt", "retry", "failed_attempt", "exhausted"]);
    assert.equal((logs.at(-1) as any).event, "exhausted");
    assert.doesNotMatch(JSON.stringify(logs), /PRIVATE/);
  }
});

test("authentication, 5xx, timeout and network are classified but never retried", async () => {
  for (const status of [401, 403]) {
    let calls = 0;
    await assert.rejects(withTranslationRetries(async () => { calls++; throw { status }; },
      { sleep: async () => {} }), (error: any) => error.category === "authentication");
    assert.equal(calls, 1);
  }
  assert.equal(normalizeTranslationFailure({ status: 503 }).category, "provider_unavailable");
  assert.equal(normalizeTranslationFailure({ name: "APIConnectionTimeoutError" }).category, "timeout");
  assert.equal(normalizeTranslationFailure({ code: "econnreset" }).category, "network");
  for (const failure of [{ status: 500 }, { name: "APIConnectionTimeoutError" },
    { code: "econnreset" }]) {
    let attempts = 0;
    await assert.rejects(withTranslationRetries(async () => { attempts++; throw failure; },
      { random: () => 0, sleep: async () => {}, log: () => {} }));
    assert.equal(attempts, 1);
  }
  assert.match(translationFailureMessage({ status: 429, code: "insufficient_quota" }), /dobroimetja/);
  assert.equal(normalizeTranslationFailure({ status: 429, message: "Your Replit credits are exhausted: SECRET" }).category, "quota");
  assert.match(translationFailureMessage({ status: 401 }), /zavrnil dostop/);
  assert.match(translationFailureMessage({ status: 503 }), /ni dosegljiv/);
  assert.match(translationFailureMessage({ name: "APIConnectionTimeoutError" }), /potekel/);
  assert.match(translationFailureMessage({ code: "econnreset" }), /Povezava/);
  assert.match(translationFailureMessage({ status: 429 }), /Preveč zahtev/);
  assert.match(translationFailureMessage({ message: "unknown SECRET" }), /ni znan/);
});

test("Retry-After date and long waiting window prevent premature retry", async () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  assert.equal(normalizeTranslationFailure({ status: 429, headers: { "retry-after": "Thu, 01 Jan 2026 00:00:03 GMT" } }, now).retryAfterMs, 3000);
  assert.equal(normalizeTranslationFailure({ status: 429, headers: { "retry-after": "Thu, 01 Jan 2026 00:02:00 GMT" } }, now).retryAfterMs, 8001);
  let calls = 0;
  await assert.rejects(withTranslationRetries(async () => {
    calls++;
    throw { status: 429, headers: { "retry-after": "120" } };
  }, { now: () => now, sleep: async () => { throw new Error("must not sleep"); } }),
  (error: any) => error.category === "rate_limit" && /izteka omejitve/.test(translationFailureMessage(error)));
  assert.equal(calls, 1);
  assert.match(translationFailureMessage({ status: 429, headers: { "retry-after": "5" } }), /izteka omejitve/);
});

test("elapsed provider request time counts against the total retry wait budget", async () => {
  let now = 0;
  let attempts = 0;
  let slept = false;
  await assert.rejects(withTranslationRetries(async () => {
    attempts++;
    now += 6000;
    throw { status: 429, headers: { "retry-after": "3" } };
  }, { now: () => now, sleep: async () => { slept = true; }, random: () => 0,
    log: () => {} }), (error: any) => error.category === "rate_limit");
  assert.equal(attempts, 1);
  assert.equal(slept, false);
});

test("invalid JSON and malformed translation cannot leak returned model text", async () => {
  for (const content of ["SECRET not json", '{"translations":[null]}']) {
    const client = { chat: { completions: { create: async () => ({ choices: [{ message: { content } }] }) } } };
    await assert.rejects(translateMissingEditorial(drafts({ sl: { title: "Slap" } }), client as never),
      (error: any) => error.category === "invalid_output" && !String(error).includes("SECRET"));
  }
});

test("both authorized translation routes send the safe specific reason as JSON.error", () => {
  for (const [route, call] of [
    ["adminContent.ts", "translateMissingEditorial"],
    ["adminCreator.ts", "translateCreatorEditorial"],
  ]) {
    const source = readFileSync(new URL(`../routes/${route}`, import.meta.url), "utf8");
    const segment = source.slice(source.indexOf(`await ${call}(`));
    assert.match(segment.slice(0, 1500), /normalizeTranslationFailure\(error\)/);
    assert.match(segment.slice(0, 1500), /res\.status\(502\)\.json\(\{ error: translationFailureMessage\(failure\) \}\)/);
    assert.doesNotMatch(segment.slice(0, 1500), /req\.log\.warn\(\{ error[, }]/);
  }
});