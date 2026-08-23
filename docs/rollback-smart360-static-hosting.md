# Rollback: Smart360 production hosting → platform static serving

**When to use this:** the self-owned static server (`artifacts/smart360/server.mjs`)
misbehaves in production — errors on page loads, wrong headers, failed health
checks — and you want the platform's built-in static hosting back.

**Effort:** one config edit + one publish. Roughly 5–10 minutes, most of it the
publish itself. No data is involved; the API server is a separate service and is
not touched. Guest devices need nothing — they simply start receiving the
platform's headers again.

**Trade-off you re-accept:** the platform serves everything with
`cache-control: private` and no max-age, so the stale-bundle problem returns.
The in-app version check keeps running and remains best-effort.

---

## Step 1 — edit the artifact service config

File: `artifacts/smart360/.replit-artifact/artifact.toml`

Replace this block (current state, self-owned server):

```toml
[services.production]

[services.production.build]
args = [ "pnpm", "--filter", "@workspace/smart360", "run", "build" ]

[services.production.build.env]
NODE_ENV = "production"

[services.production.run]
# self-owned static server so cache headers are correct:
# hashed assets immutable, index.html no-cache, version.json no-store
args = [ "node", "artifacts/smart360/server.mjs" ]

[services.production.run.env]
PORT = "26044"
NODE_ENV = "production"

[services.production.health.startup]
path = "/healthz"
```

with this block (platform static hosting):

```toml
[services.production]
serve = "static"
staticDir = "artifacts/smart360/dist/public"

[services.production.build]
args = [ "pnpm", "--filter", "@workspace/smart360", "run", "build" ]

[services.production.build.env]
NODE_ENV = "production"
```

That is: **delete** the `run`, `run.env`, and `health.startup` sub-blocks and
**add** the `serve` / `staticDir` lines. The build block stays exactly as it is.
Do not touch `[services.development]` — the dev preview never used the server.

If the Agent is doing this edit, it must go through the artifact config tooling
(direct edits to artifact.toml are blocked for it). A human editing the file
directly in the workspace is fine.

## Step 2 — publish

Click **Publish** in the workspace. Wait for the deployment to report healthy.
Nothing else needs to change; `server.mjs` can stay in the repo unused.

## Step 3 — verify the platform is serving again

From any terminal (replace the domain with the production URL):

```sh
curl -sI https://<production-domain>/ | grep -i cache-control
```

- **Platform hosting (rollback succeeded):** `cache-control: private` — no
  max-age, no immutable.
- **Self-owned server (rollback NOT active yet):** `cache-control: no-cache`
  on `/`, and `cache-control: public, max-age=31536000, immutable` on any
  `/assets/*.js` file.

Also confirm the app loads: open the production URL in a private/incognito
window and check a guest page renders.

## Step 4 — if the publish itself fails

The previous working deployment keeps serving until a new one goes healthy, so
a failed rollback publish does not take the site down. Fix the config (compare
against Step 1 exactly) and publish again. As a last resort, roll the workspace
back to a checkpoint from before the hosting change and publish that.
