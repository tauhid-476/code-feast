# 02: Create and list a draft event

**What to build:** An Organizer creates an Event from a title and a duration in minutes, receives a Join Code to share, and sees the Event listed among their events. The Event begins in `draft` and stays editable. The Join Code is short enough to read aloud and can be regenerated while the Event is still `draft`.

**Blocked by:** 01: Organizer sign-in and role gate

**Status:** resolved

- [x] An Organizer can create an Event with a title and a duration in minutes; it is created in `draft` and attributed to that Organizer.
- [x] Every Event gets a 6-character uppercase alphanumeric Join Code that is unique among non-ended Events.
- [x] A Join Code collision is retried automatically; two Events are never issued the same live code.
- [x] An Organizer can regenerate the Join Code while the Event is `draft`, and the previous code stops working immediately.
- [x] Regeneration is refused once the Event is no longer `draft`.
- [x] The events list shows title, status, duration, and Join Code, and is scoped to organizer surfaces only.
- [x] Two draft Events can exist at once; creating a second one does not disturb the first.
- [x] A Participant cannot create an Event.

## Notes

Built on `ticket/02-create-event`, merged `feat/live-contest` at `da36f69`.
Implementation commit `d64e8a9`; ticket close follows it.

**Domain** (`src/lib/events/manage.ts`)

- `createEvent(actor, { title, durationMinutes }, { generateCode? })` validates a
  non-blank title and a positive whole-minute duration, then inserts a `draft`
  event owned by `actor.id`. Returns the `EventSummary`.
- `regenerateJoinCode(actor, eventId, { generateCode? })` only touches an event
  the actor owns and only while `status = 'draft'`; the `UPDATE` repeats the
  ownership and status predicates so a concurrent Start cannot be overwritten.
  The old code stops resolving as soon as the row is updated.
- Both functions re-check `isOrganizerEmail(actor.email)` and throw
  `DomainError("not_organizer", …, 403)` — defense in depth behind
  `requireOrganizer()` in the action layer.
- `generateJoinCode()` draws 6 characters from `A–Z0–9` via `node:crypto`.
  Insert/update retries up to 20 times on Postgres `23505`, walking Drizzle's
  error `cause` chain. `generateCode` is injectable so tests can force a
  collision. Regeneration also skips a draw equal to the current code.
- Ended-event codes are free: the partial unique index already allows them and
  no pre-flight existence check gets in the way.

**Queries** (`src/lib/events/queries.ts`)

- Added `findEventByJoinCode(code)`, which normalizes case/whitespace and
  returns the draft/live event or `null`. Ended events do not resolve. Ticket 07
  can build the join flow on this; it deliberately returns `null` for ended
  codes rather than guessing which reused event was meant.

**Route layer**

- `src/app/admin/events/actions.ts`: `createEventAction` and
  `regenerateCodeAction`, both call `requireOrganizer()`, return `{ error }`
  via `actionError()`, and `revalidatePath("/admin/events")` after a mutation.
- `src/components/create-event-form.tsx`: inline shadcn `Card` form with title
  and minutes, destructive `Alert` for failures, toast on success, form reset.
- `src/components/regenerate-code-button.tsx`: draft rows only; toast reports
  the new code or the refusal.
- `src/components/event-list.tsx`: added an Actions column; title/status/
  duration/code rendering unchanged. `/admin/events/[id]` is still linked and
  was not created (ticket 03 owns it).

**Tests:** `tests/ticket-02-create-event.test.ts` (15 tests). Covers attribution,
code shape/uniqueness, forced collisions on create and regenerate, old-code
non-resolution, draft-only regeneration, participant refusal, cross-organizer
refusal, two coexisting drafts, validation, and ended-code reuse.

**Verification:** `npm test` (27 passed), `npm run typecheck`, `npm run build`
all pass after merging `feat/live-contest`.

**For the merger / later tickets**

- No schema change, no migration.
- A fresh worktree needs `npx next typegen` before `npm run typecheck` (the
  `LayoutProps` route types are generated); `npm run build` also generates them.
- `npm run lint` still reports the pre-existing `react-hooks/rules-of-hooks`
  false positive on `useCleanDatabase()` in every test file, including the new
  one; this pattern is mandated by `AGENTS.md`.
