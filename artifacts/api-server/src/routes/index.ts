import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import publicTenantsRouter, { invalidateTenantCache } from "./publicTenants";
import adminAuthRouter from "./adminAuth";
import adminTenantsRouter from "./adminTenants";
import adminContentRouter from "./adminContent";
import adminTranslationsRouter from "./adminTranslations";
import adminSitePlanRouter from "./adminSitePlan";
import storageRouter from "./storage";
import ordersRouter from "./orders";
import messagesRouter from "./messages";
import part5MeliPuCutoverRouter from "./part5MeliPuCutover";
import adminDistanceReviewRouter from "./adminDistanceReview";

const router: IRouter = Router();

// Every guest-visible admin mutation must clear the guest caches (tenant
// lookup + built payload). Routes used to call invalidateTenantCache() ad
// hoc, which was fine while the payload was rebuilt on every request — but
// with the payload cache a single missed route would serve stale content to
// guests for up to the TTL after a host saves. Centralize the invariant
// instead: ANY successful mutating /admin request clears the caches when its
// response finishes. Guest endpoints (orders, messages) are untouched — they
// never change guide content and must not evict the hot cache.
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export function makeAdminMutationInvalidator(
  invalidate: () => void,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    if (MUTATING_METHODS.has(req.method) && req.path.startsWith("/admin/")) {
      res.on("finish", () => {
        if (res.statusCode < 400) invalidate();
      });
    }
    next();
  };
}

router.use(makeAdminMutationInvalidator(invalidateTenantCache));

router.use(healthRouter);
router.use(storageRouter);
router.use(publicTenantsRouter);
router.use(adminAuthRouter);
router.use(adminTenantsRouter);
router.use(adminContentRouter);
router.use(adminTranslationsRouter);
router.use(adminSitePlanRouter);
  router.use(adminDistanceReviewRouter);
router.use(ordersRouter);
router.use(messagesRouter);
router.use(part5MeliPuCutoverRouter);

export default router;
