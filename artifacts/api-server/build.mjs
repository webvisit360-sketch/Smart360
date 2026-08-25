import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { readFile, rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

const DESCRIPTION_LEDGER_MODULE = "virtual:meli-pu-description-ledger";

function collapseDescription(lines) {
  const paragraphs = [];
  let current = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === "---") {
      if (current.length) paragraphs.push(current.join(" "));
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) paragraphs.push(current.join(" "));
  return paragraphs.join("\n\n");
}

function parseSourceDescriptions(markdown) {
  const lines = markdown.split(/\r?\n/);
  const entries = [];
  let group = "";
  for (let i = 0; i < lines.length; i++) {
    const groupMatch = lines[i].match(/^## ([^#].*)$/);
    if (groupMatch) {
      group = groupMatch[1].trim();
      continue;
    }
    const headingMatch = lines[i].match(/^### (.+)$/);
    if (!headingMatch) continue;
    const body = [];
    for (i += 1; i < lines.length && !/^#{2,3} /.test(lines[i]); i++) {
      body.push(lines[i]);
    }
    i -= 1;
    entries.push({
      group,
      name: headingMatch[1].trim(),
      sl: collapseDescription(body),
    });
  }
  return entries;
}

function parseTranslatedDescriptions(markdown) {
  const lines = markdown.split(/\r?\n/);
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^## ([^#].*)$/);
    if (!headingMatch) continue;
    const entry = { name: headingMatch[1].trim(), en: "", de: "", it: "" };
    let language = null;
    let body = [];
    const flush = () => {
      if (language) entry[language] = collapseDescription(body);
      body = [];
    };
    for (
      i += 1;
      i < lines.length &&
      !/^## [^#]/.test(lines[i]) &&
      !/^# [^#]/.test(lines[i]);
      i++
    ) {
      const languageMatch = lines[i].match(/^\*\*(EN|DE|IT) — .*\*\*$/);
      if (languageMatch) {
        flush();
        language = languageMatch[1].toLowerCase();
      } else if (language) {
        body.push(lines[i]);
      }
    }
    flush();
    i -= 1;
    entries.push(entry);
  }
  return entries;
}

const descriptionLedgerPlugin = {
  name: "meli-pu-description-ledger",
  setup(build) {
    build.onResolve({ filter: /^virtual:meli-pu-description-ledger$/ }, () => ({
      path: DESCRIPTION_LEDGER_MODULE,
      namespace: "description-ledger",
    }));
    build.onLoad({ filter: /.*/, namespace: "description-ledger" }, async () => {
      const [sourceMarkdown, translatedMarkdown] = await Promise.all([
        readFile(
          path.resolve(
            artifactDir,
            "../../attached_assets/opisi-lokacij-meli-pu_1787695056732.md",
          ),
          "utf8",
        ),
        readFile(
          path.resolve(
            artifactDir,
            "../../attached_assets/prevodi-meli-pu-vsi_1_1787695500570.md",
          ),
          "utf8",
        ),
      ]);
      const source = parseSourceDescriptions(sourceMarkdown);
      const translations = parseTranslatedDescriptions(translatedMarkdown);
      if (source.length !== 40 || translations.length !== 40) {
        throw new Error(
          `Meli Pu description ledger must contain 40 source and 40 translated entries; found ${source.length}/${translations.length}`,
        );
      }
      const ledger = source.map((entry, index) => {
        const translated = translations[index];
        if (!translated || translated.name !== entry.name) {
          throw new Error(
            `Meli Pu description heading mismatch at entry ${index + 1}`,
          );
        }
        const complete = { ...entry, ...translated };
        for (const language of ["sl", "en", "de", "it"]) {
          const value = complete[language];
          if (!value || /(^|\n)#{1,3} /.test(value)) {
            throw new Error(
              `Meli Pu description entry ${index + 1} has an invalid ${language} body`,
            );
          }
        }
        return complete;
      });
      return {
        contents: `export default ${JSON.stringify(ledger)};`,
        loader: "js",
      };
    });
  },
};

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "@node-rs/*",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      // pdfkit loads its bundled .afm font data from disk at runtime — must stay external
      "pdfkit",
      "svg-to-pdfkit",
      "fontkit",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      descriptionLedgerPlugin,
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
