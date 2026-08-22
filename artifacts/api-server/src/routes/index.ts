import { Router, type IRouter } from "express";
import healthRouter from "./health";
import publicTenantsRouter from "./publicTenants";
import adminAuthRouter from "./adminAuth";
import adminTenantsRouter from "./adminTenants";
import adminContentRouter from "./adminContent";
import adminTranslationsRouter from "./adminTranslations";
import storageRouter from "./storage";
import ordersRouter from "./orders";
import part5MeliPuCutoverRouter from "./part5MeliPuCutover";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(publicTenantsRouter);
router.use(adminAuthRouter);
router.use(adminTenantsRouter);
router.use(adminContentRouter);
router.use(adminTranslationsRouter);
router.use(ordersRouter);
router.use(part5MeliPuCutoverRouter);

export default router;
