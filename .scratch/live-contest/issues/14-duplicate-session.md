# 14: Duplicate session

**What to build:** A Participant who opens the contest in a second place gets the new session and loses the old one: the newest session wins, the older becomes read-only, and the Participant is charged one strike for holding the Event open twice. The old tab is told what happened instead of failing mysteriously, and the Participant's draft survives the handover.

**Blocked by:** 13: Counted strikes, heartbeat, and elimination

**Status:** resolved

- [x] Starting a second live session for the same Participant makes the newest session the active one.
- [x] The older session becomes read-only: it cannot Run, edit, or Submit, and its autosave is refused.
- [x] The older session shows an explanation that a newer session took over, rather than a silent failure.
- [x] The takeover records one counted strike of kind `duplicate_session` against that Participant.
- [x] Where two sessions begin near-simultaneously, exactly one wins and exactly one strike is recorded.
- [x] The handover preserves the Participant's drafts, so the winning session opens on their latest code.
- [x] A duplicate session can be the third strike, and elimination then applies to every session.
- [x] The active session is what the Organizer's health strip counts as solving.

## Notes

Feature commit `4d05144`, notes `dcea41a`, per-tab revision `ticket 14: give
every tab its own session` — the third commit on `ticket/14-duplicate-session`.
Tests are in `tests/ticket-14-duplicate-session.test.ts` (14 cases; the full
suite is 256 tests in 18 files). No migration: `participants.active_session_id`
and `last_seen_at` already existed.

### A session is a tab

A session belongs to one browser tab. Its id lives in that tab's
`sessionStorage` under `cf_session_<CODE>`, so a refresh is the same session and
a new tab arrives without one. No cookie carries the session: cookies are shared
by every tab of a browser, which is exactly what this must not do. The
fullscreen gate cookie is unchanged.

The server still mints the id. The contest page cannot decide this in a server
render — `sessionStorage` is invisible to React Server Components — so it
renders `ContestSessionGate`, a client component that calls
`contestSessionAction(code, id)` with the id the tab has, or `null`. Null mints a
`randomUUID()` in `openContestSession` (`src/lib/contest/session.ts`), writes it
to `participants.active_session_id`, and, when another session held it, charges
the `duplicate_session` strike. A provided id is only **verified**: a displaced
tab that reloads goes read-only instead of claiming the contest back, so two
idle tabs cannot ping-pong strikes, and a refresh of the active tab costs
nothing.

The claim is one transaction over the participant row locked `FOR UPDATE`:
read the row, compare the session, write the new one, and count the strike with
the same machinery as every other counted signal (`countStrike` was extracted
from `recordStrike` for exactly this). So two tabs opening together produce one
winner and one strike, and a takeover inside the two-second window costs nothing
— switching windows to the second tab is the same gesture as the blur it caused
in the first.

The id rides on every contest write: `x-contest-session` (`CONTEST_SESSION_HEADER`
in `src/lib/participants/session.ts`) on `/api/draft`, `/api/run`,
`/api/heartbeat`, and `/api/violation`, and as an argument to
`submitContestAction`. A request with no id is refused once a tab holds the
contest, so dropping the header is not a way to look like the first tab; only
`contestSessionAction` mints.

### Read-only is server-enforced at every seam

`src/lib/participants/session.ts` owns the comparison (`isActiveSession`,
`requireActiveSession` → `DomainError("session_superseded", …, 409)`). A row
with no session yet has nothing to compare against and is allowed; the first
session to claim it becomes active, so this is not a hole for a displaced one.

The tab's id is read from the request header (or the action argument) by the
route layer and passed in: `runFromContest`, `saveDraft`, `submitContest`,
`recordStrike`, `logViolation`, and `recordHeartbeat` all refuse a mismatch. Two
of them check inside their own transaction — autosave takes the participant row
lock before the upsert, and Submit locks before `finalizeLockout` — so a request
already in flight when the new session commits cannot write the winner's draft
or freeze their work on its way out. The others read the freshly loaded row,
which is enough for a Run (it writes nothing) and for a beat (the next beat
catches anything that slips).

`/api/violation` still accepts only `REPORTABLE_VIOLATION_KINDS`;
`duplicate_session` remains a server-only kind, recorded by the claim. Every
refusal carries `code` in the JSON body so a client can tell a takeover
(`session_superseded`, explained in place) from a lockout (`contest_locked`,
refreshed into the terminal screen).

### What each side sees

- The gate is the authority on the read-only state: it asks the server before
  mounting the workspace and renders `SessionTakeover` when the tab is not
  active. It never re-claims, so reloading cannot steal the contest back, and a
  refresh of the active tab is silent.
- A tab that is already open learns from its next refused write: the heartbeat
  answers `409` within five seconds, and autosave, Run, and Submit all call
  `onSessionRefused` and swap the workspace for the explanation. The editor is
  replaced, not merely disabled.
- Drafts are per Participant, so the winner's `listDrafts` already has the
  latest code. Nothing is copied, merged, or deleted at the handover.
- The takeover strike goes through `countStrike`, so a duplicate that is the
  third strike writes the Submission from the drafts and locks with reason
  `eliminated` in the same transaction. Every tab then hits `contest_locked`
  (checked before the session check) and the terminal screen.
- The health strip counts participant rows, and there is still one row, so the
  displaced tab adds nothing to "solving". A test pins the counts after a
  takeover.

`docs/verify-deploy.md` walks the human through two tabs of one browser, the
takeover explanation in the first, the refresh of the second, the
`violations` / `active_session_id` SQL check, and the failure rows for the
symptoms this ticket can produce (both tabs editable, "Not saved" instead of the
screen, a reclaim on reload, a duplicate costing two).

Merge commit: (recorded by the merge step)
