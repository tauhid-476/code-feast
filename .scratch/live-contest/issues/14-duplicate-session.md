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

Feature commit `4d05144` on `ticket/14-duplicate-session`. Tests are in
`tests/ticket-14-duplicate-session.test.ts` (11 cases; the full suite is 253
tests in 18 files). No migration: `participants.active_session_id` and
`last_seen_at` already existed.

### The session is the browser that crossed the gate

The smallest thing consistent with what was already there: the fullscreen gate
is already the server's proof that *this browser* entered this event, and the
enter action is already the one place that mints it. Ticket 14 adds a second
http-only cookie scoped to `/e/<CODE>`, `cf_session_<CODE>`, holding a random
UUID (`ensureContestSession`). It is server-minted, so a displaced tab cannot
name itself back in, and it survives a refresh because the enter action keeps
one it finds. A second browser has no such cookie, gets a new id, and the claim
in `startContestSession` (`src/lib/contest/session.ts`) writes it to
`participants.active_session_id` and charges the strike.

The claim is one transaction over the participant row locked `FOR UPDATE`:
read the row, compare the session, write the new one, and count the strike
with the same machinery as every other counted signal (`countStrike` was
extracted from `recordStrike` for exactly this). So two entries arriving
together produce one winner and one strike, a refresh of the winner produces
neither, and a takeover inside the two-second window costs nothing — switching
windows to the second browser is the same gesture as the blur it caused in the
first.

A session **is a browser**, not a tab: cookies are shared by tabs, so a second
tab is the same session by construction. A second browser or a private window
is a second session. `docs/verify-deploy.md` says so, because the first manual
test anyone tries is a second tab.

### Read-only is server-enforced at every seam

`src/lib/participants/session.ts` owns the comparison (`isActiveSession`,
`requireActiveSession` → `DomainError("session_superseded", …, 409)`). A row
with no session yet has nothing to compare against and is allowed; the first
session to claim it becomes active, so this is not a hole for a displaced one.

The browser session is read from the cookie by the route layer and passed in:
`runFromContest`, `saveDraft`, `submitContest`, `recordStrike`, `logViolation`,
and `recordHeartbeat` all refuse a mismatch. Two of them check inside their own
transaction — autosave takes the participant row lock before the upsert, and
Submit locks before `finalizeLockout` — so a request already in flight when the
new session commits cannot write the winner's draft or freeze their work on its
way out. The others read the freshly loaded row, which is enough for a Run (it
writes nothing) and for a beat (the next beat catches anything that slips).

`/api/violation` still accepts only `REPORTABLE_VIOLATION_KINDS`;
`duplicate_session` remains a server-only kind, recorded by the claim.

### What each side sees

- The contest page is the authority on the read-only state: it compares the
  cookie with the loaded participant and renders `SessionTakeover` instead of
  the workspace. No heartbeat is needed for a reload to land in the right place,
  and the page never re-claims, so reloading cannot steal the contest back.
- An already-open older tab learns from its next refused write: the heartbeat
  answers 409 within five seconds, autosave refreshes on 409, and Run already
  refreshed on 409. The workspace is replaced by the explanation; the editor is
  not merely disabled.
- Drafts are per Participant, so the winner's `listDrafts` already has the
  latest code. Nothing is copied, merged, or deleted at the handover.
- The takeover strike goes through `countStrike`, so a duplicate that is the
  third strike writes the Submission from the drafts and locks with reason
  `eliminated` in the same transaction. Both sessions then hit
  `contest_locked` (checked before the session check) and the terminal screen.
- The health strip counts participant rows, and there is still one row, so the
  displaced tab adds nothing to "solving". A test pins the counts after a
  takeover.

`docs/verify-deploy.md` gained the second-browser walkthrough, the
`violations` / `active_session_id` SQL check, and five failure rows for the
symptoms this ticket can produce (two editable windows, "Not saved" instead of
the screen, a reclaim on reload, a second tab charging a strike, and a duplicate
costing two).

Merge commit: (recorded by the merge step)
