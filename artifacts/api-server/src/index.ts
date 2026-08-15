import app from "./app";
import { logger } from "./lib/logger";
import { ensureAdminAccount, rpID, rpOrigin } from "./lib/adminAuth";

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

ensureAdminAccount()
  .then(() => {
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
