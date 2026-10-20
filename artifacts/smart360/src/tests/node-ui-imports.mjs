// Node-only test adapter. Vite resolves this extensionless library entry in the
// app; native Node ESM requires its .mjs filename. No library exports are mocked.
import { registerHooks } from "node:module";

// MapLibre references the standard global alias at import time. These helper
// tests do not construct a map, a worker, or a DOM.
globalThis.self ??= globalThis;

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === "lucide-react/dynamicIconImports"
        ? "lucide-react/dynamicIconImports.mjs"
        : specifier,
      context,
    );
  },
});
