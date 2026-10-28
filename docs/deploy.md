# Deploying Code Feast

Code Feast runs on three services:

| Service | What it holds | Configured by |
|---|---|---|
| Vercel | the Next.js app, served over HTTPS | env vars (this page) |
| Neon | Postgres **and** Neon Auth (sessions, users) | one branch's connection strings |
| E2B | the sandbox template and the sandboxes Runs execute in | `E2B_API_KEY`, `E2B_TEMPLATE_ID` |

Nothing in this document has been run against production. The Vercel project is
not linked on the development machine, so the deploy steps are for the human who
owns that account.

---

## 1. Environment manifest

Every variable, what reads it, and whether it is secret. `src/lib/env.ts` is the
single accessor; `src/lib/db/client.ts` reads `DATABASE_URL` directly because it
is imported by scripts that run before the app.

| Variable | Required | Read by | Secret | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | yes | the app (`src/lib/db/client.ts`) | **yes** | Neon's **pooled** (`-pooler`) connection string. |
| `DATABASE_URL_UNPOOLED` | for migrations only | `scripts/migrate.ts`, `drizzle.config.ts`, `scripts/setup-test-db.ts` | **yes** | Direct connection. The running app never reads it. |
| `NEON_AUTH_BASE_URL` | yes | `src/lib/auth/server.ts` | no | Per branch: the production branch has its own auth URL and its own users. |
| `NEON_AUTH_JWKS_URL` | no | nothing | no | Written by `neon env pull`; kept so a pulled file is complete. |
| `NEON_AUTH_COOKIE_SECRET` | yes | `src/lib/auth/server.ts` | **yes** | ≥ 32 chars. Must be **identical on every deploy**; changing it signs everyone out. |
| `ADMIN_EMAILS` | yes in practice | `src/lib/env.ts` | no | Comma-separated Organizer allowlist. Empty means nobody reaches `/admin`. |
| `E2B_API_KEY` | yes for Runs | `src/lib/runner/sandbox.ts` | **yes** | The app builds and serves without it; only a Run or the test panel fails. |
| `E2B_TEMPLATE_ID` | yes in production | `src/lib/runner/sandbox.ts` | no | The template from `e2b/Dockerfile`. Without it the E2B default template is used, which has **no JDK**, so Java cannot compile. |
| `TEST_DATABASE_URL` | tests only | `tests/setup-env.ts` | — | Written by `npm run db:test:setup`; never set in Vercel. |

There are **no `NEXT_PUBLIC_*` variables**. Nothing in the table above is
compiled into the browser bundle:

- the browser's auth client (`src/lib/auth/client.ts`) is `createAuthClient()`
  with no base URL and talks to the same-origin `/api/auth` proxy, so the Neon
  Auth URL stays on the server;
- client components import language vocabulary from `src/lib/languages.ts`,
  which holds values only, never `process.env`;
- `tests/ticket-18-server-only-boundary.test.ts` walks the client import graph
  and fails if any module reachable from a `"use client"` entry reads
  `process.env` or imports `server-only`. It stops at `"use server"` modules,
  which the browser receives as RPC references.

To check the built artifact as well, after `npm run build`:

```bash
grep -rF -- "$(grep -m1 '^E2B_API_KEY=' .env.local | cut -d= -f2- | tr -d '"')" .next/static && echo LEAK || echo "no key in .next/static"
```

---

## 2. The sandbox template (before the first Run on the deploy)

The stock E2B template has `python3` 3.11.6 and `g++` but no `javac`, so Java
cannot compile. `e2b/Dockerfile` adds a headless JDK on top of `e2bdev/base`,
keeping the image's user and entrypoint.

```bash
npm run e2b:build     # builds e2b/Dockerfile, prints the template id
npm run e2b:check     # creates a sandbox and runs hello-world in all three languages
```

`npm run e2b:build` reads `E2B_API_KEY` through `src/lib/env.ts` and never prints
it. The build is deliberate and repeatable: the template name is fixed
(`code-feast`), so rebuilding produces a new id and you update `E2B_TEMPLATE_ID`
to match.

The built template as of this ticket:

```
E2B_TEMPLATE_ID="cbhhpuy8mlv96jgoy8ho"
```

It is 2 vCPU / 2 GiB. The 512 MiB default cannot start a JVM. With
`POOL_TARGET = 20` the event holds 20 of these warm, so plan for ~40 GiB of
concurrent sandbox memory on the E2B account; lower `memoryMB` in
`scripts/build-e2b-template.ts` only if `npm run e2b:check` still passes.

`npm run e2b:check` is the live check, not a unit test: it has nothing to assert
without the network, so it prints timings and exits non-zero on failure. Run it
after any template rebuild and after the deploy, to confirm production is on the
JDK template.

---

## 3. Neon production branch

Production gets its own branch, so a rehearsal or a bad migration cannot touch
it. Neon Auth is per branch too: the Organizer account you create in production
exists only in production.

```bash
neon link --project-id <project-id> --branch production
neon branches create --name production          # skip if it already exists
neon env pull --branch production --file .env.production.local \
  --env DATABASE_URL,DATABASE_URL_UNPOOLED,NEON_AUTH_BASE_URL,NEON_AUTH_JWKS_URL
```

`.env.production.local` is gitignored (`.env*`), like every other env file.

---

## 4. Migrations are applied deliberately

`drizzle/` is the schema history; `drizzle.__drizzle_migrations` records what has
run. Applying it is a **separate, deliberate command**, never a side effect of a
request, a build, or a page load:

```bash
# with the production direct URL in scope for this one command
set -a; . ./.env.production.local; set +a
npm run db:migrate
```

- `scripts/migrate.ts` prefers `DATABASE_URL_UNPOOLED`, so this uses the direct
  connection, not the pooled one.
- It is safe to run repeatedly: already-applied migrations are skipped.
- **Migrate before deploying** the code that needs the new schema. Migrations in
  this repo are additive, so the running (older) deploy keeps working while the
  new one rolls out.
- Check what is applied with
  `select id, hash, created_at from drizzle.__drizzle_migrations order by id;`.
- Migrations are forward-only. A wrong migration is fixed by a new migration,
  not by editing history.

Do not run this against a database whose name you have not read twice. It
targets whatever `DATABASE_URL_UNPOOLED` holds, and `.env.local` in this worktree
points at development.

---

## 5. Vercel project

One-time setup, by the account owner:

```bash
vercel login
vercel link          # create or pick the project; framework is auto-detected
```

**Build and install settings** — leave them at the detected defaults:
framework *Next.js*, install `npm ci`, build `npm run build` (from
`package.json`), output `.next`, Node 22+. There is no custom build step: the
migrations above are *not* part of the build, because a build runs on every
preview deploy and must not touch the production schema.

**Environment variables** — add every row from §1 marked *required* (plus
`DATABASE_URL_UNPOOLED` if you ever want to migrate from CI) for the
*Production* environment. Preview environments need the same set if you want to
smoke-test there, but they will share the production database and the production
E2B account, so prefer rehearsing against production itself.

```bash
vercel env add DATABASE_URL production
vercel env add NEON_AUTH_BASE_URL production
vercel env add NEON_AUTH_COOKIE_SECRET production
vercel env add ADMIN_EMAILS production
vercel env add E2B_API_KEY production
vercel env add E2B_TEMPLATE_ID production
```

**`vercel.json`** — there is none, on purpose. Nothing this app needs is
expressible there:

- *Build/install commands* are already in `package.json`; the preset finds them.
- *Function duration*: the only long-lived work after a response is the pool
  top-up in `after(scheduleReplenish())` (`src/app/admin/events/[id]/actions.ts`).
  It creates at most 20 sandboxes at E2B's one-per-second pace, so ~25 s.
  Vercel's default maximum duration with Fluid compute is 300 s on Hobby
  (300 s default, 300 s maximum), which covers it. If the plan or a future
  change shrinks that, the fix is a route-segment `maxDuration` export on the
  admin event route — not a `vercel.json` glob.
- *Regions*: pick the one nearest the contestants in project settings; sandboxes
  are remote either way, so latency to E2B is roughly constant.
- *Headers, rewrites, redirects*: none are needed. The auth proxy is a real
  route (`src/app/api/auth/[...path]/route.ts`), and the role gate is
  `src/proxy.ts`.

**Deployment protection** — production should be public. Preview deployments
inherit Vercel Authentication by default; a protected URL redirects to a Vercel
login before the app ever runs, so sign-in smoke tests must use the production
domain (or a protection bypass token).

---

## 6. First deploy

1. Apply migrations (§4) — the database must exist and be current first.
2. Deploy: push to the branch connected to production, or `vercel deploy --prod`.
3. Open the production URL. It is HTTPS by definition, which is what the
   fullscreen requirement rests on: `document.documentElement.requestFullscreen()`
   only works in a secure context, so a local `http://` origin cannot prove it
   and `https://…vercel.app` can.
4. Sign up the Organizer account **on the production URL**, using an email that
   is in `ADMIN_EMAILS`. Accounts created against the development branch do not
   exist here.
5. Sign out and back in. Both return to the deployed host because the browser
   client only ever talks to the same-origin `/api/auth` proxy — there is no
   absolute callback URL to get wrong.

---

## 7. Post-deploy smoke path

The path the ticket asks for, with what "working" looks like:

1. **Sign in as Organizer** at `https://<host>/sign-in`. You land on `/` and see
   the organizer navigation, not the participant landing page.
2. **Create an Event**: `/admin/events` → title + duration. It appears in the
   list with a 6-character join code and status `draft`.
3. **Author one Problem** at `/admin/events/<id>`: statement, starter code and
   harness for at least one language, two sample cases.
4. **Test the Problem** with the panel (this is the first real sandbox use).
   Expect a compiled, executed result for Python, C++ **and Java**. A Java
   failure here means `E2B_TEMPLATE_ID` is wrong or missing.
5. **Start the Event**. The confirmation names the participant count; the status
   flips to `live` and the health strip shows warm sandboxes. The pool starts at
   0 on a fresh deploy and fills in the background, so give it a few seconds and
   refresh.
6. **Join as a Participant**: sign in as a second account (not in
   `ADMIN_EMAILS`), open `/join`, enter the code. You land in the lobby.
7. When the Event is live, open a Problem, Run a solution, Submit.
8. **Review**: back as the Organizer, open the live view and confirm the
   submission is listed with the submitted code.
9. Enter fullscreen from the participant contest view. It is granted, because
   the origin is HTTPS.

Anything failing at step 4 is a sandbox problem (§2); anything failing at step 1
is auth (`NEON_AUTH_*` and `ADMIN_EMAILS`); anything failing at step 2 is the
database (`DATABASE_URL` and whether §4 ran).

---

## 8. Repeatable deploys

A second deploy needs no manual data repair:

- **Schema** — migrations are additive and recorded, so `npm run db:migrate` is
  a no-op when nothing is pending.
- **Runner pool** — `runner_pool` rows are ordinary database state. A deploy
  that replaces the function instances does not kill sandboxes (they live in
  E2B for an hour); `claimSandbox` health-checks each one on claim and replaces
  a dead row, and `replenishPool` refills to `POOL_TARGET` after the next Run.
- **Sessions** — kept valid as long as `NEON_AUTH_COOKIE_SECRET` does not change.
- **Sandbox template** — a rebuild changes the template id, which is an env var,
  so a redeploy is required to pick it up. Sandboxes already running keep the
  old image until their hour expires.
