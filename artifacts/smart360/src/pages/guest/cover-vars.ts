import { CSSProperties } from 'react';

export function getCoverVars(tenant: any): CSSProperties {
  const vars: Record<string, string | number> = {};

  if (tenant.coverTextColor != null) vars['--tt-txt'] = tenant.coverTextColor;
  if (tenant.coverTitleSize != null) vars['--tt-size'] = `${tenant.coverTitleSize}px`;
  if (tenant.coverTitleOpacity != null) vars['--tt-op'] = tenant.coverTitleOpacity / 100;
  
  if (tenant.coverSubSize != null) vars['--st-size'] = `${tenant.coverSubSize}px`;
  if (tenant.coverSubOpacity != null) vars['--st-op'] = tenant.coverSubOpacity / 100;
  
  if (tenant.coverMetaSize != null) vars['--mt-size'] = `${tenant.coverMetaSize}px`;
  if (tenant.coverMetaOpacity != null) vars['--mt-op'] = tenant.coverMetaOpacity / 100;
  
  if (tenant.coverVeil != null) vars['--veil'] = tenant.coverVeil / 100;
  if (tenant.tileVeil != null) vars['--tile-veil'] = tenant.tileVeil / 100;
  
  if (tenant.coverAlign != null) {
    vars['--cover-align'] = tenant.coverAlign;
    vars['--cover-just'] = tenant.coverAlign === 'center' ? 'center' : 'flex-start';
  }

  return vars as CSSProperties;
}

// Curated small-text typefaces (ui paket 13). Keys are stored in Tenant.textFont;
// only the chosen stack is applied — fonts are never all loaded.
export const FONT_STACKS: Record<string, string> = {
  figtree: '"Figtree","Plus Jakarta Sans",sans-serif',
  system: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
  georgia: 'Georgia,"Times New Roman",serif',
  verdana: 'Verdana,Geneva,sans-serif',
  menlo: 'Menlo,Consolas,monospace',
};

export const FONT_LABELS: Record<string, string> = {
  figtree: "Figtree",
  system: "Sistemska",
  georgia: "Georgia",
  verdana: "Verdana",
  menlo: "Menlo",
};

/** Small-text vars (--txt-*). Set only when non-null — the CSS fallbacks carry
 *  the defaults (scale 1.4, app typeface, original grey hierarchy). */
export function getTextVars(tenant: any): CSSProperties {
  const vars: Record<string, string | number> = {};
  if (tenant.textScale != null) vars['--txt-scale'] = tenant.textScale / 100;
  if (tenant.textFont != null && FONT_STACKS[tenant.textFont]) vars['--txt-font'] = FONT_STACKS[tenant.textFont];
  if (tenant.textColor != null) vars['--txt-color'] = tenant.textColor;
  return vars as CSSProperties;
}
