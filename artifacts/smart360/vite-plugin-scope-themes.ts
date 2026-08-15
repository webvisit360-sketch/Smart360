import postcss from 'postcss';
import type { Plugin } from 'vite';

/**
 * Scopes the two guest theme stylesheets so BOTH can ship in the main CSS
 * bundle. The active theme is selected purely by the `data-theme` attribute
 * on <html> (set during render), so layout rules are present and applied at
 * the very first paint — no async <link>, no unreliable measurements.
 *
 * Every selector is prefixed with html[data-theme="<theme>"]:
 *   :root / html  -> html[data-theme="X"]
 *   body ...      -> html[data-theme="X"] body ...
 *   .foo          -> html[data-theme="X"] .foo
 * Selectors already anchored on html[data-theme] are left untouched.
 * @keyframes bodies and @import are left as-is.
 */
const THEME_BY_FILE: Record<string, string> = {
  'tema-poteg.css': 'swipe',
  'tema-sredozemska.css': 'mediterran',
};

function scopeSelector(sel: string, prefix: string): string {
  const s = sel.trim();
  if (s.startsWith('html[data-theme')) return s;
  if (s === ':root' || s === 'html') return prefix;
  if (s.startsWith('html')) return prefix + s.slice('html'.length);
  return `${prefix} ${s}`;
}

export function scopeThemes(): Plugin {
  return {
    name: 'smart360-scope-themes',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0]; // dev ids may carry ?t=... / ?direct
      const file = Object.keys(THEME_BY_FILE).find((f) =>
        cleanId.endsWith(`/styles/${f}`),
      );
      if (!file) return null;
      const prefix = `html[data-theme="${THEME_BY_FILE[file]}"]`;
      const root = postcss.parse(code);
      root.walkRules((rule) => {
        // Skip selectors inside @keyframes (they are frame offsets, not DOM selectors).
        const parent = rule.parent;
        if (
          parent &&
          parent.type === 'atrule' &&
          /^(-\w+-)?keyframes$/.test((parent as postcss.AtRule).name)
        ) {
          return;
        }
        rule.selectors = rule.selectors.map((sel) => scopeSelector(sel, prefix));
      });
      return { code: root.toString(), map: null };
    },
  };
}
