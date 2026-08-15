import { Router, type IRouter } from "express";
import healthRouter from "./health";
import publicTenantsRouter from "./publicTenants";
import adminAuthRouter from "./adminAuth";
import adminTenantsRouter from "./adminTenants";
import adminContentRouter from "./adminContent";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicTenantsRouter);
router.use(adminAuthRouter);
router.use(adminTenantsRouter);
router.use(adminContentRouter);

export default router;
