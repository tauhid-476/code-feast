# Verifying the production deploy

The app is live. This is the walk-through that ticks the remaining boxes on
[`18: Production deploy`](../.scratch/live-contest/issues/18-production-deploy.md).
Everything under **Already verified** was checked against the live deployment;
everything under **Your turn** needs a real browser session, a live sandbox, or
your judgement.

---

## Where things live

| | |
|---|---|
| Production URL | <https://code-feast-chi.vercel.app> |
| Vercel project | `khan-tauheeds-projects/code-feast` (`prj_rbB3xuxdmJGmIaUTgDUquOS1tuoL`) |
| Neon project | `misty-sound-19889374` (`code-feast`) |
| Neon branch | `production` (`br-hidden-violet-b8o7atng`), endpoint `ep-spring-hall-b8rgovsv` |
| Neon Auth base | `https://ep-spring-hall-b8rgovsv.neonauth.c-14.us-east-1.aws.neon.tech/neondb/auth` |
| Organizer account | `tauheedxd90@gmail.com` — password in `/Users/khantauhid/coding/code-feast-notes/prod-organizer-credentials.md` (outside the repo) |
| Env vars | 7 set for **Production** only: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_AUTH_COOKIE_SECRET`, `ADMIN_EMAILS`, `E2B_API_KEY`, `E2B_TEMPLATE_ID` |

`E2B_TEMPLATE_ID` is `cbhhpuy8mlv96jgoy8ho`, the JDK template. If a Java run
fails, that variable is the first thing to check.

---

## Already verified

Checked against <https://code-feast-chi.vercel.app> with real HTTP requests.

| Check | Result |
|---|---|
| Served over HTTPS | Yes. The deployment is public — no Vercel Authentication gate; `/` answers with the app's own `307` to `/sign-in`. |
| Auth against the production database | Organizer account created and signed in on the production branch. |
| `/` as Organizer | `307` → `/admin/events`, which renders **200** and shows **"No events"** — so the app is reading the production database, and it is empty. |
| `/join` as Organizer | `403` — the role gate refuses Organizer → Participant. |
| Sign-out | `POST /api/auth/sign-out` → `200`; `/` then `307` → `/sign-in`. |
| Sign-in | `POST /api/auth/sign-in/email` → `200`; `/` then `307` → `/admin/events`. Both stay on the deployed host — there is no absolute callback URL to get wrong. |
| Auth proxy | `/api/auth/ok` → `200`. |
| Migrations | `npm run db:migrate` against the production branch: 1 migration recorded in `drizzle.__drizzle_migrations`, 10 tables in `public`. |
| No secret in the browser bundle | Covered by `tests/ticket-18-server-only-boundary.test.ts`, plus the `grep` in `docs/deploy.md` §1. |

### One thing that had to be fixed

The production Neon Auth branch had **no trusted domains**, so every sign-in on
the deployed host failed with `403 {"code":"INVALID_ORIGIN"}`. Fixed with:

```bash
npx neonctl neon-auth domain add https://code-feast-chi.vercel.app \
  --project-id misty-sound-19889374 --branch production
```

`docs/deploy.md` §5 now includes this step, because a fresh branch reproduces the
failure every time.

### Known carry-over

The `production` branch was created from `main`, so it inherited **4 auth users**
that already existed on the development branch. They are your own dev accounts
and are harmless, but they can sign in to production. To see them:

```sql
select id, email, created_at from neon_auth.user order by created_at;
```

Delete any you do not want with `npx neonctl neon-auth user delete <user-id>
--project-id misty-sound-19889374 --branch production`.

---

## Your turn

Work down the list. Each step says what "working" looks like.

### 1. Sign in and sign out

1. Open <https://code-feast-chi.vercel.app/sign-in> and sign in as
   `tauheedxd90@gmail.com`.
2. You should land on `/admin/events` with the organizer navigation.
3. Sign out. You should land back on `/sign-in`, on the same host.

**Ticks:** sign-in and sign-out return to the deployed host.

### 2. Create an Event

At `/admin/events` → **New event**. Give it a title and a duration.

**Working looks like:** the Event appears in the list with a 6-character join
code and status `draft`.

### 3. Author one Problem

Open the Event → add a Problem. It needs a statement, starter code and a harness
for at least one language, and two sample cases.

**Working looks like:** the Problem is saved and listed under the Event. Harness
text must never appear in anything a Participant can see — check the Participant
side later at step 6.

### 4. Test the Problem (first live sandbox)

Use the Problem's Test panel. Run it for **Python, C++ and Java**.

**Working looks like:** all three compile and execute and show the sample
results. Java compiling at all proves `E2B_TEMPLATE_ID` is the JDK template; a
Java failure here means the variable is wrong or missing.

This creates one sandbox. It does **not** start the pool.

### 5. Start the Event

Start it from the admin Event page. The confirmation names the participant count
(currently 1 — just you).

**Working looks like:** status flips to `live` and the health strip shows warm
sandboxes. The pool starts at 0 and fills in the background, so give it a few
seconds and refresh.

**Cost warning:** `POOL_TARGET` is 20 and each sandbox is 2 vCPU / 2 GiB, so a
started Event holds roughly **40 GiB** of concurrent sandbox memory on the E2B
account until it is released.

**Ticks:** sandboxes can be created and claimed from the deployed app, and the
pool reaches its target size.

### 6. Join as a Participant

Sign up a **second** account with an email that is **not** in `ADMIN_EMAILS`.
Open `/join`, enter the Event's join code.

**Working looks like:** you land in the lobby, not on the admin pages. As an
Organizer, `/join` correctly returns `403`.

When the Event is live, open a Problem, press **Run** with a solution, then
press **Submit**.

**A working Run looks like:** a panel opens under the editor reading
`2 of 2 sample test cases pass`, with each sample's input, expected, actual,
stderr, exit code and duration. Your code is unchanged and nothing was submitted
— a Run is feedback only. Pressing Run again within two seconds says
`Runs are limited to one every two seconds.` That is the rate limit working, not
a failure. If the warm pool is empty the Run waits up to 20 seconds and then says
`The runner is busy, try again in a moment.`; the countdown keeps running and
Run works again afterwards.

**A working Submit looks like:** the confirmation says submitting ends your
contest and cannot be undone. **Keep working** closes it and leaves you in the
editor with nothing recorded. **Submit and lock** sends you to
`/e/<CODE>/locked`, which shows the reason (**Submitted**) and your elapsed time;
there is no code on that screen and no way back to the editor. Opening
`/e/<CODE>/contest` afterwards returns to the locked screen. Pressing Submit a
second time writes nothing: there is still exactly one submission, with the code
of every problem you had autosaved and the language you last used for it.

**A working blocked paste looks like:** inside the editor, `Ctrl/Cmd+V`,
right-click → Paste, middle click, and dragging text in all do nothing to the
code. A blocked paste shows **Pasting is disabled.**; right-click shows no menu
and no toast. Copying out with `Ctrl/Cmd+C` still works. Each attempt reaches the
server without costing a strike:

```sql
select kind, counted, created_at from violations order by created_at desc;
```

The rows read `paste_blocked` or `context_menu_blocked` with `counted = false`,
and `participants.strikes` is still `0` after a refresh.

**A working Deadline lockout looks like:** close the tab before the Deadline and
return after it. The first page load locks you at the Deadline itself — the
locked screen says **Deadline**, and the recorded submission is the last
autosaved code, not an empty one or the code from before your last edits.

### 7. Review the submission

Back as the Organizer, open the live view. The submission should be listed with
the submitted code.

### 8. Fullscreen

From the Participant contest view, enter fullscreen.

**Working looks like:** the browser grants it. `requestFullscreen()` only works
in a secure context, so this is the real proof that HTTPS is doing its job — it
cannot pass on a local `http://` origin.

**Ticks:** fullscreen is granted on the deployed host.

### 9. Prove the deploy repeats

Run a second deploy and confirm nothing needs manual repair:

```bash
npx vercel deploy --prod --scope team_vaHTjxvzZVwUGJi8Fkct8bFm
```

Then re-run the migration — it should apply nothing:

```bash
set -a; . ./.env.production.local; set +a
npm run db:migrate
```

**Working looks like:** the new deployment serves the same Event and Problem, the
sandbox pool refills after the next Run, and sessions survive (they stay valid as
long as `NEON_AUTH_COOKIE_SECRET` is unchanged).

**Ticks:** a deploy can be repeated without manual data repair, and the schema is
applied by a repeatable migration path.

### 10. Tick the ticket

Tick each box in
[`18-production-deploy.md`](../.scratch/live-contest/issues/18-production-deploy.md)
as you go, and set `**Status:** resolved` once all seven are ticked. Append a
`## Notes` line with anything the next reader needs.

---

## If something fails

| Symptom | Cause |
|---|---|
| Sign-in shows `INVALID_ORIGIN` | The host is not a trusted domain on the production auth branch. `npx neonctl neon-auth domain add https://<host> --project-id misty-sound-19889374 --branch production`. |
| Java fails to compile, Python works | `E2B_TEMPLATE_ID` missing or not the JDK template. |
| `/admin/events` 500s | `DATABASE_URL` or the migration. Check the production branch is the one in Vercel, then `npm run db:migrate`. |
| Everything redirects to a Vercel login | Deployment Protection is on for that deployment. Production should be public; previews are protected by default. |
| Sign-in succeeds but you land on the participant page | The email is not in `ADMIN_EMAILS`. |
| **Run** says `Run did not start` | The message is the server's. `The runner is busy…` means the pool could not serve it in 20s — check the health strip and `vercel logs`. `Runs are limited to one every two seconds.` is the rate limit. `Your contest is locked.` means the deadline passed. |
| **Submit** says `Your latest changes are not saved yet` | The last keystrokes never reached `/api/draft` (the Not saved banner is the same signal). Nothing was submitted; restore the connection and press Submit again. |
| **Submit** does nothing, or the locked screen never appears | Check `vercel logs` for `submitContestAction`. A locked screen with no elapsed time means `participants.locked_at` is null — look at the row, not the page. |
| Pasting works in the editor | The guards did not mount — check the browser console for a Monaco error. The deployment must include both the editor changes and `/api/violation`. |
| A paste is blocked but no `violations` row appears | The `POST /api/violation` request failed. Check `vercel logs`; a closed tab before the request landed is the usual cause, and the attempt is still blocked. |
| `/api/run` 500s | The participants table is missing `run_in_flight_at` / `last_run_at`: apply migrations (§4 of `docs/deploy.md`) before deploying the code. |

Useful commands:

```bash
npx vercel logs https://code-feast-chi.vercel.app --scope team_vaHTjxvzZVwUGJi8Fkct8bFm
npx vercel env ls production --scope team_vaHTjxvzZVwUGJi8Fkct8bFm
npx neonctl neon-auth status --project-id misty-sound-19889374 --branch production
```
