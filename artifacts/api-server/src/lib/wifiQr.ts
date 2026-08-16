import QRCode from "qrcode";

/**
 * WIFI: join string per the de-facto standard Android/iOS both scan.
 * \ ; , : and " in the SSID and password MUST be backslash-escaped — a
 * password containing a semicolon otherwise produces a code that silently
 * fails to connect (wifi-in-barva-ozadja.md).
 */
export function wifiJoinString(
  ssid: string,
  pass: string | null,
  enc: string | null,
): string {
  const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
  if (enc === "nopass") return `WIFI:T:nopass;S:${esc(ssid)};;`;
  const type = enc === "WEP" ? "WEP" : "WPA"; // NULL/anything else = WPA
  return `WIFI:T:${type};S:${esc(ssid)};P:${esc(pass ?? "")};;`;
}

/**
 * Server-rendered join QR, same visual contract as the share-sheet QR:
 * ECC M, 2-module quiet zone, dark #14201F on transparent, viewBox only.
 * Always generated fresh from the CURRENT ssid/password — never cached by
 * tenant id alone.
 */
export async function wifiQrSvg(
  ssid: string,
  pass: string | null,
  enc: string | null,
): Promise<string> {
  let svg = await QRCode.toString(wifiJoinString(ssid, pass, enc), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#14201FFF", light: "#0000" },
  });
  svg = svg.replace(/<svg([^>]*)>/, (_m, attrs: string) => {
    const cleaned = attrs.replace(/\s(width|height|shape-rendering)="[^"]*"/g, "");
    return `<svg${cleaned} shape-rendering="crispEdges">`;
  });
  return svg;
}
