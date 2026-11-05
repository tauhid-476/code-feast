# Verifying the production deploy

The app is live. This is the walk-through that ticks the remaining boxes on
[`18: Production deploy`](./tickets/18-production-deploy.md).
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
| Organizer account | `organizer@example.com` — password in `/Users/khantauhid/coding/code-feast-notes/prod-organizer-credentials.md` (outside the repo) |
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
| Migrations | `npm run db:migrate` against the production branch: 2 migrations recorded in `drizzle.__drizzle_migrations`, 10 tables in `public`. The second adds `participants.run_in_flight_at` and `participants.last_run_at` (ticket 10). |
| Current deployment | Tickets 13–17 deployed to <https://code-feast-chi.vercel.app> (`dpl_7N4CDtxvFE41nXiuKnQ7qQfTXj4N`); anonymous `POST /api/violation` and `POST /api/heartbeat` answer `401 {"error":"Sign in first."}`, and all features are live. |
| No secret in the browser bundle | Covered by `tests/ticket-18-server-only-boundary.test.ts`, plus the `grep` in `docs/deploy.md` §1. |
| Review dashboard & shortlist | Covered by `tests/ticket-16-review-dashboard-and-shortlist.test.ts` (10 tests) and `/admin/events/[id]/review`. |
| Reinstate & deadline reopen | Covered by `tests/ticket-15-reinstate-and-deadline-reopen.test.ts` (12 tests) and `tests/ticket-08-start-and-shared-clock.test.ts`. |
| Re-run a submission | Covered by `tests/ticket-17-re-run-a-submission.test.ts` (16 tests) and `/admin/events/[id]/review`. |

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

Delete any you do not want with `npx neonctl neon-auth user delete <user-id> \
--project-id misty-sound-19889374 --branch production`.

---

## Your turn

Work down the list. Each step says what "working" looks like.

### 1. Sign in and sign out

1. Open <https://code-feast-chi.vercel.app/sign-in> and sign in as
   `organizer@example.com`.
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

**A working strike counter looks like:** the contest header always shows
`Strikes 0 of 3`. Press `Esc` to leave fullscreen (or switch to another window).
The counter moves to `1 of 3`, and a toast names the strike. Switching away and
back within two seconds is still one strike: the two events of one alt-tab are
deduplicated. The header now also offers **Return fullscreen** — press it to
continue without another strike. Check the rows:

```sql
select kind, counted, created_at from violations order by created_at desc;
```

They read `fullscreen_exit` or `focus_lost` with `counted = true`, and
`participants.strikes` matches the badge after a refresh.

**A working heartbeat looks like:** leave fullscreen and stay out. Every five
seconds the page reports its state, and the counter keeps moving (about one
strike per beat) until **Return fullscreen** is pressed or three beats have
eliminated you. A single alt-tab that is reversed immediately must cost one, not
two — the heartbeat that was in flight reports the same event inside the
two-second window.

**A working duplicate session looks like:** keep the first Participant tab
open, then open the contest as the **same** Participant in a **second tab of the
same browser** and go through the Lobby gate again. Every tab is its own
session, so this is a duplicate: the second tab gets the editor, and within five
seconds the first tab is replaced by a **Read-only** screen headed **Newer tab**
that says a newer tab took over and why it cost a strike. It offers only
**Sign out** — no editor, Run, or Submit — and reloading it shows the same
screen. It cannot take the contest back: a reload only verifies the tab's id, it
does not re-claim. In the second tab, the editor holds the code the first tab had
autosaved.

Now reload the **second** (active) tab. It keeps editing, shows no takeover
screen, and the strike count does not move: the same tab is the same session.

```sql
select kind, counted, created_at from violations order by created_at desc limit 3;
select active_session_id, strikes from participants;
```

There is exactly one `duplicate_session` row with `counted = true`, `strikes` is
one higher than before, and `active_session_id` changed (it is an opaque id, not
a name). Opening the contest twice within two seconds is still one strike: the
window is the same guard alt-tabbing uses.

**A working elimination looks like:** take three strikes (leave fullscreen three
times, spacing them more than two seconds apart). The screen becomes the
terminal one with reason **Eliminated**, `participants.status` is `locked_out`,
`lockout_reason` is `eliminated`, and there is one submission holding the code
you had autosaved at the third strike. Opening `/e/<CODE>/contest` again, in the
same tab, another tab, or another browser, returns to the locked screen. The organizer can reinstate from the live view (ticket 15).

**A working reinstatement looks like:** In the live view (`/admin/events/<ID>/live`), an eliminated participant appears in the **Eliminated Participants** table with their strikes count and elimination timestamp. Clicking **Reinstate** clears their strikes to 0, resets status back to `solving`, clears the lockout, and retains their original deadline without refunding time. Existing drafts and the frozen submission remain intact. The participant can pass the fullscreen gate again and resume solving with their autosaved code intact. When the event ends, the button is disabled and explains that reinstatement is unavailable once the event has ended.

**A working deadline reopen looks like:** When an event ends naturally by reaching its deadline, the live clock controls offer **Extend +10 (Reopen deadline lockouts)**. Extending adds ten minutes, sets status back to `live`, and reopens exactly the participants locked by reason `deadline`. Participants locked by `submitted` or `eliminated` stay locked. An event ended manually by the organizer clicking **End now** cannot be extended.

**A working Deadline lockout looks like:** close the tab before the Deadline and
return after it. The first page load locks you at the Deadline itself — the
locked screen says **Deadline**, and the recorded submission is the last
autosaved code, not an empty one or the code from before your last edits.

### 7. Review the submission and Re-run

Back as the Organizer, open the review view (`/admin/events/<ID>/review`). The submissions are listed with their participant details, strikes, elapsed time, and shortlist toggle.

**A working Re-run looks like:** In the participant detail panel, selecting any problem with submitted code renders a **Run submitted code** action under a **Reading aid** banner stating plainly: *Reading aid — runs code against sample test cases and produces no verdict or score.* Clicking it executes the submitted snippet against the real problem harness and sample cases. The results render inline showing per-case pass/fail, expected vs actual outputs, execution time, and any compile or runtime stderr. A re-run never modifies participant status, drafts, submissions, or strikes. If the runner pool is busy, an inline error banner informs the organizer without crashing or dismissing the review screen. Problems with no submitted code state *No code submitted for this problem.* and do not offer a run button.

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
