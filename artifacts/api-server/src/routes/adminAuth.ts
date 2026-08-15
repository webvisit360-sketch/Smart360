import { Router, type IRouter } from "express";
import { AdminLoginBody } from "@workspace/api-zod";
import {
  checkCredentials,
  setSessionCookie,
  clearSessionCookie,
  isAuthenticated,
  loginRateLimited,
  recordLoginFailure,
  resetLoginFailures,
} from "../lib/adminAuth";

const router: IRouter = Router();

router.post("/admin/login", async (req, res): Promise<void> => {
  const ip = req.ip ?? "unknown";
  if (loginRateLimited(ip)) {
    res.status(429).json({ error: "Too many attempts, try again later" });
    return;
  }
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, password } = parsed.data;
  if (!checkCredentials(username, password)) {
    recordLoginFailure(ip);
    req.log.warn("Failed admin login attempt");
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  resetLoginFailures(ip);
  setSessionCookie(res);
  res.json({ authenticated: true });
});

router.post("/admin/logout", async (_req, res): Promise<void> => {
  clearSessionCookie(res);
  res.json({ authenticated: false });
});

router.get("/admin/session", async (req, res): Promise<void> => {
  res.json({ authenticated: isAuthenticated(req) });
});

export default router;
