import postcss from 'postcss';
import type { Plugin } from 'vite';

/**
 * Scopes the two guest theme stylesheets so BOTH can ship in the main CSS
 * bundle. The active theme is selected purely by the `data-theme` attribute
 * on <html> (set during render), so layout rules are present and applied at
 * the very first paint — no async <link>, no unreliable measurements.
 *
 * Every selector is prefixed with :is(html[data-theme="X"], [data-theme="X"])
 * — same specificity as the old html[data-theme="X"] prefix (0,1,1), but it
 * ALSO matches a nested `<div data-theme="X">` wrapper, which is how the
 * admin cover preview renders the real guest <Cover> component with the real
 * theme CSS without putting the attribute on the admin <html>.
 *   :root / html  -> :is(html[data-theme="X"], [data-theme="X"])
 *   body ...      -> :is(...) body ...
 *   .foo          -> :is(...) .foo
 * Selectors already anchored on html[data-theme] get the same :is() root.
 * @keyframes bodies and @import are left as-is.
 */
const THEME_BY_FILE: Record<string, string> = {
  'tema-poteg.css': 'swipe',
  'tema-sredozemska.css': 'mediterran',
};

function scopeSelector(sel: string, prefix: string): string {
  const s = sel.trim();
  // Already anchored on html[data-theme="..."] → widen that anchor to the
  // same :is() root so it also matches a nested [data-theme] wrapper.
  const anchored = s.match(/^html(\[data-theme="[^"]+"\])(.*)$/);
  if (anchored) return `:is(html${anchored[1]}, ${anchored[1]})${anchored[2]}`;
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
      const theme = THEME_BY_FILE[file];
      const prefix = `:is(html[data-theme="${theme}"], [data-theme="${theme}"])`;
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
