import path from 'path';
import fs from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

import { scopeThemes } from './vite-plugin-scope-themes';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

// Stale-bundle recovery: the same id is baked into the bundle (__BUILD_ID__)
// and emitted as /version.json; the guest app reloads once when they diverge.
const buildId =
  process.env.BUILD_ID ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const emitVersionJson = () => ({
  name: 'emit-version-json',
  apply: 'build' as const,
  generateBundle() {
    this.emitFile({
      type: 'asset' as const,
      fileName: 'version.json',
      source: JSON.stringify({ buildId }),
    });
  },
});

const adminSidebarLockup = () => {
  const publicId = 'virtual:admin-sidebar-lockup';
  const resolvedId = `\0${publicId}`;
  const fontPublicId = 'virtual:living-guide-inter-font';
  const fontResolvedId = `\0${fontPublicId}`;
  return {
    name: 'prototype-asset-extraction',
    resolveId(id: string) {
      if (id === publicId) return resolvedId;
      if (id === fontPublicId) return fontResolvedId;
      return null;
    },
    load(id: string) {
      if (id === resolvedId) {
        const prototypeHtml = fs.readFileSync(
          path.resolve(
            import.meta.dirname,
            '..',
            '..',
            'attached_assets',
            'admin-2030_7_1788039435751.html',
          ),
          'utf8',
        );
        const svg = prototypeHtml.match(
          /<div class="lk">([\s\S]*?)<\/div>/,
        )?.[1];
        if (!svg) {
          throw new Error(
            'Smart360 sidebar lockup is missing from admin-2030.html',
          );
        }
        return `export default ${JSON.stringify(svg)};`;
      }
      if (id === fontResolvedId) {
        const prototypeHtml = fs.readFileSync(
          path.resolve(
            import.meta.dirname,
            '..',
            '..',
            'attached_assets',
            'prototip-2030_18_1787174221045.html',
          ),
          'utf8',
        );
        const font = prototypeHtml.match(
          /src:url\((data:font\/woff2;base64,[^)]+)\)/,
        )?.[1];
        if (!font) {
          throw new Error(
            'Inter WOFF2 is missing from the Living Guide prototype',
          );
        }
        return `export default ${JSON.stringify(font)};`;
      }
      return null;
    },
  };
};

export default defineConfig({
  base: basePath,
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    scopeThemes(),
    emitVersionJson(),
    adminSidebarLockup(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
