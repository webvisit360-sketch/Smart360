import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const files = [
  ["smart360-email-lockup-host-594x138.png", "faceted-1"],
  ["smart360-email-signature-r14-1116x8.png", "tour-1"],
  ["smart360-email-signature-r16-1116x8.png", "tour-1"],
];
const checks = [];
for (const [file, version] of files) {
  const expected = hash(await readFile(new URL(`../../artifacts/smart360/public/brand/${file}`, import.meta.url)));
  for (const [environment, origin] of [["development", "http://localhost:80"], ["production", "https://smart360.info"]]) {
    const url = `${origin}/brand/${file}?v=${version}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const bytes = Buffer.from(await response.arrayBuffer());
      const actual = hash(bytes);
      checks.push({ environment, url, status: response.status, contentType: response.headers.get("content-type"), expectedSha256: expected, responseSha256: actual, exactBytes: response.ok && actual === expected });
    } catch (error) {
      checks.push({ environment, url, error: String(error), exactBytes: false });
    }
  }
}
const result = { checkedAt: new Date().toISOString(), checks, warning: "Production is not published by this work. A failed/404 response is NOT a verified asset; delivery must wait for publication and exact-byte verification." };
await writeFile(new URL("./email-asset-url-verification.json", import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (checks.some(check => check.environment === "development" && !check.exactBytes)) process.exitCode = 1;