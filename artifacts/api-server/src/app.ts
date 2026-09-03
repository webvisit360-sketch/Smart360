import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import resendWebhooksRouter from "./routes/resendWebhooks";

const app: Express = express();

// Behind the Replit proxy: derive client IP from X-Forwarded-For (first hop).
app.set("trust proxy", 1);

// Replit normally terminates TLS and redirects HTTP before requests reach the
// app. Keep a defensive canonical redirect in both routed services so a linked
// www hostname can never become a second origin.
app.use((req, res, next) => {
  if (process.env["NODE_ENV"] !== "production") {
    next();
    return;
  }
  const host = req.hostname.toLowerCase();
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (host === "www.smart360.info") {
    res.redirect(308, `https://smart360.info${req.originalUrl}`);
    return;
  }
  if (host === "smart360.info" && forwardedProto && forwardedProto !== "https") {
    res.redirect(308, `https://smart360.info${req.originalUrl}`);
    return;
  }
  next();
});

// Compress JSON/text responses (the guest guide payload is ~160 KB raw and
// the platform front end does not compress API responses). The default
// filter skips already-compressed content types, so /api/storage image and
// video streams (incl. Range/206) pass through untouched.
app.use(compression());

// Search engines must never index anything.
app.use((_req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
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

// Svix signatures cover the exact request bytes. This route deliberately
// precedes parsers and the /api actor gate, and has its own constrained body.
app.use("/api/webhooks/resend", express.raw({ type: "application/json", limit: "64kb" }), resendWebhooksRouter);

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
