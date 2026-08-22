import { Router, type IRouter } from "express";
import {
  ApplyPart5MeliPuCutoverBody,
  ApplyPart5MeliPuCutoverResponse,
  GetPart5MeliPuCutoverPreflightResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/adminAuth";
import { logger } from "../lib/logger";
import {
  applyPart5MeliPuCutover,
  Part5CutoverPreconditionError,
  readPart5MeliPuPreflight,
} from "../lib/part5MeliPuCutover";

const router: IRouter = Router();

router.use("/admin/cutovers", requireAdmin);

router.get(
  "/admin/cutovers/part-5-meli-pu",
  async (_req, res): Promise<void> => {
    try {
      const preflight = await readPart5MeliPuPreflight();
      res.json(GetPart5MeliPuCutoverPreflightResponse.parse(preflight));
    } catch (error) {
      if (error instanceof Part5CutoverPreconditionError) {
        res.status(409).json({
          code: error.code,
          error: error.message,
          details: error.details,
        });
        return;
      }
      logger.error(
        {
          errName:
            error instanceof Error ? error.constructor.name : "UnknownError",
        },
        "[part5-cutover] preflight failed",
      );
      res.status(500).json({ error: "PART 5 preflight failed" });
    }
  },
);

router.post(
  "/admin/cutovers/part-5-meli-pu",
  async (req, res): Promise<void> => {
    const parsed = ApplyPart5MeliPuCutoverBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const result = await applyPart5MeliPuCutover(parsed.data);
      res.json(ApplyPart5MeliPuCutoverResponse.parse(result));
    } catch (error) {
      if (error instanceof Part5CutoverPreconditionError) {
        logger.warn(
          { code: error.code },
          "[part5-cutover] write rejected by precondition",
        );
        res.status(409).json({
          code: error.code,
          error: error.message,
          details: error.details,
        });
        return;
      }
      logger.error(
        {
          errName:
            error instanceof Error ? error.constructor.name : "UnknownError",
        },
        "[part5-cutover] transaction failed",
      );
      res.status(500).json({ error: "PART 5 transaction failed and was rolled back" });
    }
  },
);

export default router;