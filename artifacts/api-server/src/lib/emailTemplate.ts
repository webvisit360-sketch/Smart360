/**
 * Shared e-mail template engine — the ONLY way Smart360 renders outgoing mail.
 *
 * Implements the owner-approved design (attached_assets/emaili-gostitelju):
 *   seven-colour table-cell band · white card · marked brand kicker ·
 *   24px title · data-row table · orange CTA button · footer.
 *
 * Hard rules enforced here for every message:
 * - inline styles only (no <style> block, survives client CSS stripping),
 * - no web fonts or tracking pixels; the one brand mark uses our stable URL,
 * - no auto-login links (CTAs point at plain pages; tokens only for
 *   set/reset-password links which are single-use and expiring),
 * - every mail carries a plain-text alternative that reads correctly alone.
 *
 * Templates never concatenate raw HTML: paragraphs are built from segments so
 * user-provided values (names, notes, item titles) are always escaped.
 */
import { rpOrigin } from "./adminAuth";

// ── Palette / metrics from the approved design ──────────────────────────────
const CTA_BG = "#E8801B";
const CTA_TEXT = "#150C03";
const CARD_BORDER = "#E4E7E2";
const ROW_LINE = "#EEF1EC";
const TITLE_COLOR = "#121A14";
const BODY_COLOR = "#3A443C";
const MUTED = "#66716A";
const SMALL_COLOR = "#8A938C";
const OUTER_BG = "#ECF0EA";
const FONT =
  "-apple-system,'Segoe UI',Roboto,Arial,sans-serif";

const COLOUR_BAND =
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;width:100%"><tr><td height="5" style="height:5px;line-height:5px;font-size:0;background:#E3BE12">&nbsp;</td><td height="5" style="height:5px;line-height:5px;font-size:0;background:#E8801B">&nbsp;</td><td height="5" style="height:5px;line-height:5px;font-size:0;background:#8F4A1C">&nbsp;</td><td height="5" style="height:5px;line-height:5px;font-size:0;background:#2A4E86">&nbsp;</td><td height="5" style="height:5px;line-height:5px;font-size:0;background:#1F76C0">&nbsp;</td><td height="5" style="height:5px;line-height:5px;font-size:0;background:#12856B">&nbsp;</td><td height="5" style="height:5px;line-height:5px;font-size:0;background:#4FA524">&nbsp;</td></tr></table>';

function brandMarkUrl(): string {
  return "https://smart360.info/brand/smart360-znak-40.png";
}

export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A paragraph segment: plain text, optionally bold. Always escaped. */
export type Seg = string | { b: string };

function segHtml(seg: Seg): string {
  return typeof seg === "string" ? escHtml(seg) : `<b>${escHtml(seg.b)}</b>`;
}
function segText(seg: Seg): string {
  return typeof seg === "string" ? seg : seg.b;
}

export interface EmailRow {
  label: string;
  value: string;
}

export type EmailBlock =
  | { kind: "p"; segs: Seg[] }
  | { kind: "rows"; rows: EmailRow[] }
  | { kind: "cta"; label: string; url: string }
  | { kind: "small"; segs: Seg[] };

export interface EmailSpec {
  subject: string;
  /** Inbox preview line — rendered as hidden preheader + first text line. */
  preheader: string;
  /** Brand kicker above the title (tenant name or "Smart360"). */
  brand: string;
  title: string;
  blocks: EmailBlock[];
  footerLines: string[];
}

export function p(...segs: Seg[]): EmailBlock {
  return { kind: "p", segs };
}
export function small(...segs: Seg[]): EmailBlock {
  return { kind: "small", segs };
}
export function rows(list: Array<EmailRow | null | undefined>): EmailBlock {
  return { kind: "rows", rows: list.filter((r): r is EmailRow => !!r) };
}
export function cta(label: string, url: string): EmailBlock {
  return { kind: "cta", label, url };
}

function blockHtml(b: EmailBlock): string {
  switch (b.kind) {
    case "p":
      return `<p style="font-size:16px;line-height:1.6;color:${BODY_COLOR};margin:0 0 14px">${b.segs
        .map(segHtml)
        .join("")}</p>`;
    case "small":
      return `<p style="font-size:13.5px;line-height:1.55;color:${SMALL_COLOR};margin:0 0 14px">${b.segs
        .map(segHtml)
        .join("")}</p>`;
    case "cta":
      // A real anchor styled as the approved orange button. Inline styles
      // styles for broad client support; no tracking redirects — the href is
      // the final destination.
      return (
        `<p style="margin:6px 0 18px">` +
        `<a href="${escHtml(b.url)}" style="display:inline-block;background:${CTA_BG};color:${CTA_TEXT};text-decoration:none;font-weight:700;font-size:16px;padding:13px 22px;border-radius:12px;font-family:${FONT}">${escHtml(b.label)}</a>` +
        `</p>`
      );
    case "rows": {
      const trs = b.rows
        .map((r, i) => {
          const border =
            i < b.rows.length - 1 ? `border-bottom:1px solid ${ROW_LINE};` : "";
          return (
            `<tr>` +
            `<td style="${border}padding:11px 15px;color:${MUTED};font-size:14.5px;width:150px;vertical-align:top;font-family:${FONT}">${escHtml(r.label)}</td>` +
            `<td style="${border}padding:11px 15px;color:${TITLE_COLOR};font-size:16px;font-weight:700;font-family:${FONT}">${escHtml(r.value)}</td>` +
            `</tr>`
          );
        })
        .join("");
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
        `style="border:1px solid ${CARD_BORDER};border-radius:12px;border-collapse:separate;margin:6px 0 18px">${trs}</table>`
      );
    }
  }
}

function blockText(b: EmailBlock): string {
  switch (b.kind) {
    case "p":
    case "small":
      return b.segs.map(segText).join("");
    case "cta":
      return `${b.label}:\n${b.url}`;
    case "rows":
      return b.rows.map((r) => `${r.label}: ${r.value}`).join("\n");
  }
}

/** Render the approved card layout. Returns Resend-ready html + text. */
export function renderEmail(spec: EmailSpec): { html: string; text: string } {
  const inner = spec.blocks.map(blockHtml).join("\n");
  const footer = spec.footerLines.map(escHtml).join("<br>");

  const html = `<!DOCTYPE html>
<html lang="sl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(spec.subject)}</title></head>
<body style="margin:0;padding:0;background:${OUTER_BG}">
<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">${escHtml(spec.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${OUTER_BG}"><tr><td align="center" style="padding:26px 12px 44px">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#FFFFFF;border:1px solid ${CARD_BORDER};border-radius:14px;border-collapse:separate;overflow:hidden;font-family:${FONT}">
<tr><td>${COLOUR_BAND}</td></tr>
<tr><td style="padding:26px 26px 14px">
<div style="font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${TITLE_COLOR};font-family:${FONT}"><img src="${escHtml(brandMarkUrl())}" width="20" height="20" alt="" style="vertical-align:-4px;margin-right:7px;border:0;display:inline-block">${escHtml(spec.brand)}</div>
<h2 style="font-size:24px;font-weight:800;letter-spacing:-.02em;color:${TITLE_COLOR};margin:8px 0 14px;line-height:1.25;font-family:${FONT}">${escHtml(spec.title)}</h2>
${inner}
</td></tr>
<tr><td style="border-top:1px solid ${ROW_LINE};padding:16px 26px 22px;font-size:13px;color:${SMALL_COLOR};line-height:1.6;font-family:${FONT}">${footer}</td></tr>
</table>
</td></tr></table>
</body>
</html>`;

  const text = [
    spec.title,
    "",
    ...spec.blocks.map(blockText),
    "",
    spec.footerLines.join("\n"),
  ].join("\n\n").replace(/\n{3,}/g, "\n\n");

  return { html, text };
}

// ── Shared URL helpers ───────────────────────────────────────────────────────

/** Absolute URL of the host/owner portal login page (no auto-login). */
export function portalUrl(): string {
  return `${rpOrigin()}/admin`;
}

/** Human-readable host for address rows, e.g. "smart360.info". */
export function displayHost(): string {
  return rpOrigin().replace(/^https?:\/\//, "");
}
