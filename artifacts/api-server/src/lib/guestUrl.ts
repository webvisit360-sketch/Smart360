import QRCode from "qrcode";

/**
 * Canonical absolute https guest URL for a tenant slug. Old printed QR codes
 * survive slug changes through the TenantAlias 301 redirect.
 */
export function guestUrl(slug: string): string {
  const domain = process.env["REPLIT_DEV_DOMAIN"];
  const base = domain ? `https://${domain}` : "https://smart360.info";
  return `${base}/g/${slug}`;
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
