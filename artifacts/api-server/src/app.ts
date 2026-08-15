import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Behind the Replit proxy: derive client IP from X-Forwarded-For (first hop).
app.set("trust proxy", 1);

// Search engines must never index anything.
app.use((_req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  next();
});
app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send("User-agent: *\nDisallow: /\n");
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// CORS only on the public tenant API; /admin/* stays same-origin-only (no CORS headers at all).
app.use("/api/public", cors());
app.use("/api/healthz", cors());

// WebAuthn: passkeys only work when the request host matches the configured RP_ID.
// Log a clear, throttled error on mismatch instead of failing silently during registration.
let lastRpMismatchLog = 0;
app.use("/api/admin", (req, _res, next) => {
  const expected = process.env["RP_ID"] || process.env["REPLIT_DEV_DOMAIN"];
  const actual = req.hostname;
  if (expected && actual && actual !== "localhost" && actual !== "127.0.0.1" && actual !== expected) {
    const now = Date.now();
    if (now - lastRpMismatchLog > 60_000) {
      lastRpMismatchLog = now;
      logger.error(
        { expectedRpId: expected, requestHost: actual },
        "RP_ID does not match the host this request arrived on — passkey registration/login will fail on this host. Fix: set secrets RP_ID to the bare hostname users open in the browser and RP_ORIGIN to https://<that hostname>, then restart the API server.",
      );
    }
  }
  next();
});
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
