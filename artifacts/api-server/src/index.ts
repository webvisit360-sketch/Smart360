import app from "./app";
import { logger } from "./lib/logger";
import { ensureAdminAccount, rpID, rpOrigin, listCredentials } from "./lib/adminAuth";
import { purgeExpiredOrders, scheduleOrderRetention } from "./lib/orderRetention";
import { purgeExpiredThreads, scheduleMessageRetention } from "./lib/messageRetention";
import { runExploreGroupBackfillAtStartup } from "./lib/exploreGroupBackfill";
import { runSectionGroupBackfillAtStartup } from "./lib/sectionGroupBackfill";
import { runFirstPublishedBackfillAtStartup } from "./lib/firstPublishBackfill";
import { runTriesteCityRenameAtStartup } from "./lib/triesteCityRenameBackfill";
import { runMeliPuDescriptionBackfillAtStartup } from "./lib/meliPuDescriptionBackfill";
import { ensureRowLevelSecurity } from "./lib/rls";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Passkey (WebAuthn) relying-party configuration check.
if (!process.env["RP_ID"]) {
  if (process.env["REPLIT_DEV_DOMAIN"]) {
    logger.warn(
      { fallback: process.env["REPLIT_DEV_DOMAIN"] },
      "RP_ID is not set — falling back to REPLIT_DEV_DOMAIN. Passkeys registered now will stop working if the dev domain changes. Set the secrets RP_ID (bare hostname) and RP_ORIGIN (https://<hostname>) to pin them.",
    );
  } else {
    logger.error(
      "RP_ID is not set and no REPLIT_DEV_DOMAIN fallback exists. Passkey registration/login WILL fail. Set secrets RP_ID (bare hostname, e.g. app.example.com) and RP_ORIGIN (e.g. https://app.example.com).",
    );
  }
} else {
  logger.info({ rpID: rpID(), rpOrigin: rpOrigin() }, "WebAuthn relying party configured");
}

/**
 * Production bootstrap: when the production database has NO passkeys at all,
 * there is no way in (login needs a key, recovery needs codes issued at
 * enrolment, and autoscale has no shell for admin:enroll). In that single
 * bootstrap state we mint a one-time enrolment link (15 min TTL, single use)
 * and print it to the deployment logs, which only the project owner can read.
 * As soon as one credential exists, this never runs again.
 */
async function logBootstrapEnrollLink(): Promise<void> {
  // Security policy: recovery codes must NEVER be printed to any log. When
  // the database has zero passkeys (fresh install / catastrophic loss), we
  // only print a neutral notice; bootstrap then has to happen out-of-band
  // (e.g. re-seeding a code hash directly in the database from a trusted
  // shell). As soon as one credential exists, this never runs again.
  const creds = await listCredentials();
  if (creds.length > 0) return;
  console.error(
    `BOOTSTRAP: no admin passkeys exist for ${rpOrigin()}/admin. Recovery codes are never printed to logs; bootstrap access must be re-established out-of-band.`,
  );
}

ensureAdminAccount()
  // Row-level security is the fail-closed backstop for host accounts. NOT
  // best-effort: if the policies cannot be applied, the server must not
  // start, because host requests would then rely on the fence alone.
  .then(() => ensureRowLevelSecurity())
  .then(() =>
    // Bootstrap is best-effort: a transient DB error here must not take the
    // whole deployment down (a fresh code is minted on the next restart).
    logBootstrapEnrollLink().catch((err) => {
      logger.error({ err }, "Bootstrap enrolment code could not be issued");
      console.error("BOOTSTRAP failed:", err instanceof Error ? err.message : String(err));
    }),
  )
  // Purge expired orders at startup (best-effort; a failure must not block boot)
  .then(() =>
    purgeExpiredOrders().catch((err) => {
      logger.error({ err }, "[orderRetention] startup purge failed");
    }),
  )
  // Purge expired message threads at startup (best-effort)
  .then(() =>
    purgeExpiredThreads().catch((err) => {
      logger.error({ err }, "[messageRetention] startup purge failed");
    }),
  )
  // One-time Okolica explore-group data repair (best-effort, self-disabling)
  .then(() => runExploreGroupBackfillAtStartup())
  // One-time Ponudba/Nastanitev group assignment (best-effort, self-disabling)
  .then(() => runSectionGroupBackfillAtStartup())
  // Stamp first_published_at for tenants published before the column existed
  .then(() => runFirstPublishedBackfillAtStartup())
  // Rename the approved Okolica/Izleti entry from the tourist office to the city.
  .then(() => runTriesteCityRenameAtStartup())
  // Fill only empty descriptions after the Trst source-title rename has run.
  .then(() => runMeliPuDescriptionBackfillAtStartup())
  .then(() => {
    scheduleOrderRetention();
    scheduleMessageRetention();
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to ensure admin account");
    process.exit(1);
  });
