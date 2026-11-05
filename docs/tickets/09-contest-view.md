# 09: Contest view: fullscreen gate, editor, autosave

**What to build:** When the Event goes live the Lobby offers one primary action — Enter fullscreen — and the contest is unreachable without it, because browsers only grant fullscreen from a user gesture. Inside, the Participant works in a split pane: the Problem list and statement on the left, and on the right a language selector, the editor seeded with that language's Starter Code, Run, and a global Submit. Work is autosaved continuously, a refresh returns them to it with the clock still running, and failure to save is visible rather than silent.

**Blocked by:** 08: Start, the shared clock, and status gates

**Status:** resolved

- [x] When the Event is live, the Lobby shows Enter fullscreen as its single primary action.
- [x] The contest route is unreachable without entering fullscreen; navigating to it directly returns the Participant to the gate.
- [x] The split pane shows the Problem list and selected Problem's statement on the left, and language selector, editor, Run, and Submit on the right, with Submit in the top right.
- [x] Selecting a language seeds the editor with that Problem's Starter Code for that language, and switching language keeps each language's own work.
- [x] The Participant's code is autosaved per Problem per language and survives a refresh and a browser crash.
- [x] A refresh returns the Participant to the contest with their code and the still-running shared clock.
- [x] A failed autosave raises a persistent "Not saved" banner, mirrors the buffer locally, resyncs on reconnect, and prefers the newer local copy.
- [x] The countdown is a projection of server time corrected for clock skew, re-derived on each poll, and unaffected by a tampered local clock.
- [x] The signed function from Starter Code is present on first load, so a Participant can Run without writing boilerplate.

## Notes

Implemented on `ticket/09-contest-view` (`5d88e80`, merged with
`feat/live-contest` at `d2aa507`). Tests are in
`tests/ticket-09-contest-view.test.ts` (30 cases); two expectations in
`tests/ticket-07-join-and-lobby.test.ts` were updated because ticket 09 changes
what "live" means for the lobby.

**The gate mechanism, and why.** A browser only grants fullscreen from a user
gesture, so the server cannot observe it. The Lobby's one primary action calls
`requestFullscreen()` and only after it resolves calls the `enterContestAction`
Server Action. That action — not client state — mints an http-only,
event-scoped, HMAC-signed cookie (`cf_gate_<CODE>`, six-hour expiry, path
`/e/<CODE>`) via `src/lib/participants/gate.ts` / `gate-token.ts`. The contest
page reads that cookie and asks `contestDestination(context, { entered })`;
without it, a typed `/e/[code]/contest` URL redirects to `/e/[code]`, where the
gate is. The token names the event id as well as the participant, so a reused
join code does not open a later event. The signature reuses
`NEON_AUTH_COOKIE_SECRET` instead of adding a variable; it is a UX gate, not
authorization — the session and participant row are still resolved on every
read. The honest limitation: a participant who calls the action from a script
gets the cookie without fullscreen, because the gesture is only observable in
the browser. Exiting fullscreen is ticket 13's strike, not this gate.

`lobbyDestination` now leaves a live participant on the lobby (`null`) until the
gate is passed, then redirects to the contest. Both decisions stay in
`src/lib/participants/routes.ts`. The lobby polls the server every 5s while
draft (`lobby-live-watcher.tsx`) so the gate appears when Start commits.
Entering also calls `markSolving` (conditional on `joined`), which is what makes
the ticket 08 health strip's "solving" count move.

**Draft merge rule.** `src/lib/drafts/merge.ts:chooseDraft` is pure: one buffer
per Participant + Problem + language; when both copies exist the newer
`updatedAt` wins and an exact tie means the server already has it; a local copy
with no server row wins and is marked for resync; with neither, the language's
Starter Code seeds the editor and is not saved on its own. Local timestamps are
the client's *projection of server time* (the same monotonic anchor as the
countdown), never `Date.now()`, so a tampered wall clock cannot make a stale
copy look new; a keystroke is forced strictly newer than the last acknowledged
save. The mirror is written to `localStorage` on every keystroke, before the
900ms debounced POST to `/api/draft`, so a crash loses nothing. A failed save
keeps the buffer pending, shows the persistent "Not saved" alert, and is
resent by the next keystroke, the Retry button, the `online` event, or a
`pagehide` keepalive; failures never retry in a tight loop. The server owns
`updated_at` and refuses saves once the event is not live or the participant is
locked (the loader reconciles the deadline first).

**Editor.** `@monaco-editor/react` is uncontrolled (`defaultValue`, never
`value`) so autosave cannot reset the undo stack; one Monaco model per
Problem + language (`path`) keeps each language's own buffer, undo history and
scroll. The editor bundle is still warmed from the lobby.

**Countdown.** `src/lib/contest/clock.ts` pairs server `now` with
`performance.now()`; `ContestCountdown` ticks from that projection and re-anchors
from `GET /api/clock?code=…` every 10s. Nothing reads `Date.now()` for the
display. At zero it asks for one `router.refresh()`, which reconciles the lockout
server-side and lets `contestDestination` route to `/locked`.

**What 10, 11 and 13 hook into.** Run and Submit are rendered in their final
positions but disabled, with one-line pointer comments; a status-bar line says
so. Ticket 10 replaces the Run button with the `/api/run` call and a results
panel under the editor, using the current buffer (`/api/draft` already exposes
the same Problem/language key). Ticket 11 replaces Submit in the header with the
confirmation, calls the submission write, and can use `clearContestGate` (already
exported) on lockout. Ticket 13's 5s heartbeat should subsume the 10s
`/api/clock` poll: it can carry the same `serverNow`/`deadlineAt` plus the
fullscreen and visibility report, and it should count `fullscreen_exit` when the
gate cookie exists but `document.fullscreenElement` is null. The gate cookie is
the natural marker that a session "entered", which is what ticket 13 needs to
tell a real exit from a typed URL.

**Not covered here:** the lobby still does not push; it polls. `Run` is not
wired and no result area exists yet. The gate cookie lives six hours, which is
longer than an event but not permanent.
