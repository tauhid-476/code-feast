# 18: Production deploy

**What to build:** The app runs on its real host against its real database and its real sandbox account, so the rehearsal happens on the same footing as the Event. Sign-in returns to the right place, sandboxes can be created from the deployed app, and the full organizer-to-participant path works over HTTPS.

**Blocked by:** 08: Start, the shared clock, and status gates

**Status:** ready-for-agent

- [ ] The app is deployed and served over HTTPS, with authentication working against the production database.
- [ ] Sign-in and sign-out return to the deployed host rather than a local address.
- [ ] Sandboxes can be created and claimed from the deployed app, and the pool reaches its target size.
- [ ] A smoke path passes on the deployed URL: sign in as Organizer, author an Event with one Problem, start it, and join as a Participant.
- [x] Environment configuration is documented, and no secret value reaches the browser bundle.
- [ ] Fullscreen is granted on the deployed host, confirming the secure-context requirement is met.
- [ ] A deploy can be repeated without manual data repair, and the schema is applied by a repeatable migration path.

## Notes

### Split

The infrastructure half is done and on `ticket/18-production-deploy`. Every
checkbox above still unticked needs a deploy, and this machine is logged out of
Vercel (`npx vercel whoami` → "Logged out") with no project linked, so they wait
on the human's `vercel login` / `vercel link` / first deploy. Nothing here was
run against production, and no migration was applied to the production database.

### The JDK template (the blocker)

`e2b/Dockerfile` starts from `e2bdev/base` and installs
`openjdk-17-jdk-headless` (Debian 12 bookworm). It only installs packages: the
base image's envd entrypoint, `user` (uid 1000) and `/home/user` working
directory are left alone, which is what the SDK and sandbox start-up expect. A
final `RUN python3 --version && g++ --version && javac --version && java
--version` fails the build rather than the contest if the base image ever drops
a tool.

Built with `npm run e2b:build` (`scripts/build-e2b-template.ts`, tsx, key read
through `src/lib/env.ts`, never printed):

```
Template name: code-feast
Template id:   cbhhpuy8mlv96jgoy8ho
Build id:      6545187a-b208-44da-bb26-dd3ad5d45195
build time:    1m3s
```

Set `E2B_TEMPLATE_ID="cbhhpuy8mlv96jgoy8ho"` in `.env.local` and in Vercel. The
template is 2 vCPU / 2 GiB on purpose: the stock 512 MiB sandbox cannot start a
JVM. `POOL_TARGET` is 20, so the event holds ~40 GiB of sandbox memory.

### Live verification (not TDD — a live check, no test can assert it offline)

`npm run e2b:check` (`scripts/check-e2b-template.ts`) creates a sandbox through
`createE2BSandboxProvider()` in `src/lib/runner/sandbox.ts` and mirrors the
compile/run commands in `src/lib/runner/run.ts`.

```
Template: cbhhpuy8mlv96jgoy8ho
Python 3.11.6 / g++ (Debian 12.2.0-14) 12.2.0 / javac 17.0.21 / openjdk 17.0.21
ok   python no compile       run  526ms  "hello from python"
ok   cpp    compile 1863ms   run  604ms  "hello from cpp"
ok   java   compile  940ms   run  631ms  "hello from java"
```

First run of a fresh sandbox is colder (cpp compile 5093ms, java compile
1190ms); the numbers above are the second, warm run. Also checked directly
through the provider: `free -m` reports 1982 MiB and `nproc` 2; a Java program
reading stdin (`Scanner`, `-Xmx512m`, the runner's command) compiled in 3145ms
and answered `1 2 3 4` with `10` in 1365ms. Java is no longer a blocker for 19.

### Deploy configuration

- `docs/deploy.md` — environment manifest (every variable, required or not,
  server-only, secret), the Neon production branch, the deliberate migration
  path, the Vercel project settings, the first deploy, the ticket's smoke path,
  and why a repeat deploy needs no data repair.
- `.env.example` — extended to the same manifest, comments only, no values.
- `README.md` — pointed at `docs/deploy.md`; the create-next-app boilerplate was
  wrong about this project.
- **No `vercel.json`.** Nothing needs one: build/install come from
  `package.json`, and the only long-running work after a response is the pool
  top-up in `after(scheduleReplenish())` (~25s for 20 sandboxes at E2B's
  one-per-second pace) against Vercel's 300s default maximum duration with Fluid
  compute. `docs/deploy.md` §5 records that reasoning so the next reader does not
  re-litigate it.
- Migrations are applied by `npm run db:migrate` against
  `DATABASE_URL_UNPOOLED`, deliberately, before the deploy — never in the build
  (a build runs on every preview deploy) and never on a request.

### No secret reaches the browser bundle

There are no `NEXT_PUBLIC_*` variables. The browser auth client is
`createAuthClient()` with no base URL, talking to the same-origin `/api/auth`
proxy, so `NEON_AUTH_BASE_URL` never ships. `tests/ticket-18-server-only-boundary.test.ts`
walks the import graph from every `"use client"` entry and fails if a reachable
module reads `process.env` or imports `server-only`; it stops at `"use server"`
modules, which the browser only receives as RPC references. Checked against the
real build too: none of `DATABASE_URL`, `NEON_AUTH_COOKIE_SECRET`,
`NEON_AUTH_BASE_URL`, `E2B_API_KEY`, `ADMIN_EMAILS`, `E2B_TEMPLATE_ID` appears
under `.next/static`.

### Waiting on the human

1. `vercel login`, `vercel link`, add the env vars from `docs/deploy.md` §1.
2. `neon branches create --name production` (or pick the branch), then
   `neon env pull --branch production --file .env.production.local …`.
3. `npm run db:migrate` against that branch's `DATABASE_URL_UNPOOLED`.
4. First deploy, then the smoke path in `docs/deploy.md` §7.
5. Tick the remaining checkboxes. The last one is half-met: the migration path is
   in place and repeatable, but "a deploy can be repeated" needs a second deploy
   to prove.

Gates on this branch: `npx next typegen`, `npm test` (12 files, 148 tests),
`npm run typecheck`, `npm run lint`, `npm run build` — all green.

