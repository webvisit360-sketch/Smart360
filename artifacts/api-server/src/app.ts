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
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
