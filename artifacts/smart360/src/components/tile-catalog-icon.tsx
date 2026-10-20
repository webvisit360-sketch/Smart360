import type { SVGProps } from "react";
import { catalogForTileKey } from "@workspace/category-icons";

/** Only bundled, importer-validated SVG markup, never tenant-supplied HTML. */
export function TileCatalogIcon({ icon, className, ...props }: SVGProps<SVGSVGElement> & { icon: string }) {
  const entry = catalogForTileKey(icon);
  if (!entry) return null;
  const line = /class="ln"/.test(entry.svg);
  return <svg
    viewBox="0 0 24 24"
    fill={line ? "none" : "currentColor"}
    stroke={line ? "currentColor" : "none"}
    strokeWidth={line ? 3.1 : undefined}
    strokeLinecap={line ? "round" : undefined}
    strokeLinejoin={line ? "round" : undefined}
    className={[line ? "ln" : "", className].filter(Boolean).join(" ") || undefined}
    aria-hidden="true"
    {...props}
    dangerouslySetInnerHTML={{ __html: entry.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "") }}
  />;
}
