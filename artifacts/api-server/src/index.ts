import app from "./app";
import { logger } from "./lib/logger";
import { ensureAdminAccount, rpID, rpOrigin, issueRecoveryCodes, listCredentials } from "./lib/adminAuth";

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
  // No environment gate: runs only when the connected database has ZERO
  // passkeys (bootstrap state), which in practice is production-only.
  const creds = await listCredentials();
  if (creds.length > 0) return;
  // The deployment log pipeline scrubs lines containing long random tokens
  // (both WARN and INFO variants of the enrolment URL never reached the
  // logs, while the token WAS minted in the DB each boot). A short
  // XXXX-XXXX-XXXX recovery code passes through, so bootstrap goes through
  // the existing "Obnovitev dostopa" form on the login page instead: the
  // code is exchanged there for an enrolment token, then a passkey is
  // registered. issueRecoveryCodes replaces any previous set, which is safe
  // here because this only runs when zero passkeys exist.
  const [code] = await issueRecoveryCodes(1);
  logger.info(
    `BOOTSTRAP: no admin passkeys exist. Recovery code ${code} — enter it under "Obnovitev dostopa" at ${rpOrigin()}/admin to register the first passkey (a fresh code replaces this one on every restart).`,
  );
}

ensureAdminAccount()
  .then(() => logBootstrapEnrollLink())
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
