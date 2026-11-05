# 07: Join by code and the lobby

**What to build:** A Participant enters the Join Code and lands in the Lobby for that Event, identified by name, waiting for the Organizer. Re-entering the code returns them to the same place rather than creating a second entry. The Lobby shows the Event title, its duration, and their own name — no Problem content, no Problem list. An Organizer cannot join any Event, including their own.

**Blocked by:** 02: Create and list a draft event

**Status:** resolved

- [x] A Participant enters a Join Code and receives exactly one participant entry per Event, regardless of how many times they enter the code.
- [x] Re-entering the code while the Event is `draft` returns the existing entry and the Lobby, not an error and not a duplicate.
- [x] The Lobby shows the Event title, its duration, the Participant's display name, and a waiting message, with no Problem content and no Problem list.
- [x] An Organizer is refused entry to any Event by Join Code, including one they created, with an explanation rather than a silent failure.
- [x] An unknown, expired, or ended Join Code produces a clear refusal.
- [x] A Participant who joins while the Event is `live` is accepted and inherits the existing shared Deadline with nothing prorated.
- [x] Re-entering the code while `live` takes the Participant straight to the contest, not back to the Lobby.
- [x] The editor bundle is preloaded in the Lobby so entering the contest does not stall on a download.

## Notes

Implemented on `ticket/07-join-and-lobby`.

**Files**
- `src/lib/participants/join.ts` — `joinEventByCode` replaces the stub. Normalises the code, refuses organizers before touching the database (`organizer_cannot_join`), then resolves the code through `findEventByJoinCode`. An ended code is looked up separately (`findEndedEventByJoinCode`) so the refusal says `join_code_ended` instead of `join_code_unknown`. The row is written with `insert … on conflict do nothing` on the `(event_id, user_id)` unique index, then selected, so re-entry returns the existing row and a race cannot duplicate it. Returns `{ eventCode, eventStatus, participantId }`; the action routes `live` straight to `/e/[code]/contest`.
- `src/lib/participants/queries.ts` — **the loader ticket 08 must extend**:
  - `loadParticipantContext(code: string, userId: string, options?: { now?: Date }): Promise<ParticipantContext | null>`
  - `ParticipantContext = { event: EventSummary; participant: Participant | null }`
  - `Participant = { id, eventId, userId, displayName, email, status, joinedAt, lockedAt, lockoutReason, strikes, shortlisted }`
  - Returns `null` when no event carries the code, and `{ participant: null }` when the viewer has not joined. Because ended codes can be reused, a row already belonging to this user wins over the newest match.
  - `reconcileDeadline` is private and runs on every load: at or past `deadline_at`, an unlocked participant is set to `locked_out` with `lockout_reason = 'deadline'` and `locked_at = deadline_at` (never "when noticed"), guarded by `status <> 'locked_out'` so a `submitted`/`eliminated` lockout is never overwritten. Ticket 08 extends this function/file for start/extend/end; keep the same entry point so pages cannot bypass reconciliation.
- `src/lib/participants/routes.ts` — `lobbyDestination(context)` and `contestDestination(context)` return a URL or `null` ("stay"). Both pages use them so the gates cannot drift. Lobby: no entry → `/join`; locked → `/e/code/locked`; live → `/e/code/contest`; ended → `/e/code/locked`; draft → stay. Contest: no entry → `/join`; locked → `/locked`; ended → `/locked`; not live → lobby; live → stay.
- `src/lib/events/queries.ts` — added `findEndedEventByJoinCode` for the ended refusal; `findEventByJoinCode` is unchanged.
- `src/app/e/[code]/page.tsx` — Lobby: `requireParticipant`, load through the participants loader, redirect via `lobbyDestination`, then show title, duration, join code, display name, and the waiting message. No problem reads anywhere.
- `src/app/e/[code]/contest/page.tsx` — **placeholder for ticket 09**: guard + `contestDestination`, then a card saying the contest view is coming. No split pane, fullscreen gate, or autosave.
- `src/app/e/[code]/locked/page.tsx` — **placeholder for ticket 11**: guard + reason text; redirects back to the lobby when the event is neither ended nor locked. Ticket 11 replaces the body with the terminal screen and submission.
- `src/components/editor-preload.tsx` — invisible client component; after mount it dynamically imports `@monaco-editor/react` and calls `loader.init()` so the editor and Monaco are warm before the contest opens.
- `src/app/join/actions.ts` — redirects live joins to the contest route, draft joins to the lobby; `redirect()` stays outside the try/catch.
- `src/app/forbidden.tsx` — copy is now role-neutral and explains that organizers cannot join an event.

**Tests** — `tests/ticket-07-join-and-lobby.test.ts`, 20 cases against the real test database: first join writes one row with the session name/email; re-entry returns the same `participantId` and no duplicate; a renamed second join does not overwrite the first; unknown and ended codes refuse with distinct codes; an organizer is refused on their own event; a live join records the participant and reports `live`; re-entry while live routes to the contest; a late joiner keeps the original `deadline_at`; loading at/after the deadline locks with reason `deadline` and `locked_at === deadline_at`; an existing `submitted` lockout is untouched; no-entry and unknown-code viewers go to `/join`; contest gate routing for live, draft, ended, locked, and no-entry.

**Not covered here:** the lobby does not poll for the event going live; ticket 08/09 own the start gate and the transition into the contest.
