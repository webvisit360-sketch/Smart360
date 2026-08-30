import { Router, type IRouter } from "express";
import {
  PreviewCreatorOriginBody,
  PreviewCreatorOriginResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/adminAuth";
import {
  expandGoogleMapsShortLink,
  GoogleMapsParseError,
  GoogleMapsRedirectError,
  parseGoogleMapsLocationUrlOrThrow,
} from "../lib/maps-link";

const router: IRouter = Router();
router.use("/admin", requireAdmin);

router.post("/admin/creator/origin-preview", async (req, res): Promise<void> => {
  const input = PreviewCreatorOriginBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Vnesite Google Maps povezavo." });
    return;
  }

  try {
    const originalUrl = input.data.mapUrl.trim();
    let isShortLink = false;
    try {
      const original = new URL(originalUrl);
      isShortLink =
        original.hostname === "maps.app.goo.gl" ||
        (original.hostname === "goo.gl" &&
          (original.pathname === "/maps" || original.pathname.startsWith("/maps/")));
    } catch {
      // The strict parser below returns the user-facing invalid URL error.
    }
    const expandedUrl = isShortLink
      ? await expandGoogleMapsShortLink(originalUrl)
      : originalUrl;
    const parsed = parseGoogleMapsLocationUrlOrThrow(expandedUrl);
    const reverseUrl = new URL("https://nominatim.openstreetmap.org/reverse");
    reverseUrl.searchParams.set("format", "jsonv2");
    reverseUrl.searchParams.set("lat", String(parsed.lat));
    reverseUrl.searchParams.set("lon", String(parsed.lng));
    reverseUrl.searchParams.set("zoom", "18");
    reverseUrl.searchParams.set("addressdetails", "1");
    const response = await fetch(reverseUrl, {
      headers: {
        "User-Agent": "Smart360 Creator origin confirmation (admin contact via replit deployment)",
      },
    });
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);
    const data = (await response.json()) as { display_name?: unknown };
    const address = typeof data.display_name === "string" ? data.display_name : null;
    if (!address) throw new Error("Nominatim ni vrnil naslova.");

    res.json(PreviewCreatorOriginResponse.parse({
      ...parsed,
      expandedUrl,
      address,
      addressSource: "nominatim",
    }));
  } catch (error) {
    if (error instanceof GoogleMapsParseError || error instanceof GoogleMapsRedirectError) {
      res.status(422).json({ error: error.message, code: error.kind });
      return;
    }
    req.log.warn({ error }, "Creator origin preview failed");
    res.status(502).json({ error: "Naslova pri Nominatimu ni bilo mogoče preveriti.", code: "nominatim-failed" });
  }
});

export default router;