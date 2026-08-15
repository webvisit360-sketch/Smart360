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
  
  if (tenant.coverAlign != null) {
    vars['--cover-align'] = tenant.coverAlign;
    vars['--cover-just'] = tenant.coverAlign === 'center' ? 'center' : 'flex-start';
  }

  return vars as CSSProperties;
}
