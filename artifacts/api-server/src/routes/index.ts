import { Router, type IRouter } from "express";
import healthRouter from "./health";
import publicTenantsRouter from "./publicTenants";
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
