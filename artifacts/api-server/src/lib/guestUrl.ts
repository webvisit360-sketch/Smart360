import QRCode from "qrcode";

/**
 * Canonical absolute https guest URL for a tenant slug. Old printed QR codes
 * survive slug changes through the TenantAlias 301 redirect.
 */
export function guestUrl(slug: string): string {
  // Priority: explicit APP_DOMAIN (set this to smart360.info once the custom
  // domain actually resolves) → published domain (production) → dev domain.
  // Never a hard-coded future domain: a printed QR must point at a URL that
  // works TODAY. A domain switch is NOT covered by TenantAlias redirects —
  // those only handle slug renames within the same domain.
  const domain =
    process.env["APP_DOMAIN"] ||
    process.env["REPLIT_DOMAINS"]?.split(",")[0] ||
    process.env["REPLIT_DEV_DOMAIN"];
  if (!domain) {
    throw new Error(
      "guestUrl: no APP_DOMAIN / REPLIT_DOMAINS / REPLIT_DEV_DOMAIN set",
    );
  }
  return `https://${domain}/g/${slug}`;
}

/**
 * Server-rendered QR SVG (UI paket 14): ECC M, 2-module quiet zone, dark
 * #14201F on transparent, viewBox only (no width/height) so it fills its box,
 * crisp edges so modules stay sharp at small sizes.
 */
export async function guestQrSvg(url: string): Promise<string> {
  let svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#14201FFF", light: "#0000" },
  });
  // qrcode emits width/height on some versions — strip them, keep viewBox.
  svg = svg.replace(/<svg([^>]*)>/, (_m, attrs: string) => {
    const cleaned = attrs
      .replace(/\s(width|height|shape-rendering)="[^"]*"/g, "");
    return `<svg${cleaned} shape-rendering="crispEdges">`;
  });
  return svg;
}
