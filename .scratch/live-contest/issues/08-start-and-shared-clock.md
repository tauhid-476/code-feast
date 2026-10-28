# 08: Start, the shared clock, and status gates

**What to build:** The Organizer starts the Event with a confirmation that names how many Participants are waiting, and from that instant every Participant races the same Deadline. Problems become visible at that moment and stop being editable. The Organizer can add ten minutes while the Event is live, or end it early. Lockout by Deadline is a fact the server reconciles whenever it reads a Participant — never something a client or a scheduled job performs.

**Blocked by:** 03: Author a problem; 07: Join by code and the lobby

**Status:** resolved

- [x] Start is a single Organizer action behind a confirmation that names the current participant count.
- [x] Start sets the start moment to now, sets the Deadline to now plus the Event duration, and freezes the Problem set in one transaction.
- [x] There is no scheduled start; nothing happens until the Organizer presses Start.
- [x] Problems are invisible to Participants before Start and visible from Start onward.
- [x] Extend adds ten minutes to the Deadline, repeatable, and is offered only while the Event is `live`.
- [x] End now sets the Deadline to now and locks everyone immediately.
- [x] Every read that touches a Participant reconciles the Deadline: at or past it and not yet locked means locked with reason `deadline` and a locked-out time equal to the Deadline, not the moment it was noticed.
- [x] A Participant who joins late inherits the existing Deadline and nothing is prorated.
- [x] Problem, Starter Code, Harness, and Sample Test Case edits are all refused once the Event is no longer `draft`.
- [x] A double Start or a double Extend does not apply the action twice.
- [x] The Organizer's live view shows participants joined, solving, and locked, the sandbox pool ready count, and the time remaining.

## Notes

Implemented on `ticket/08-start-and-shared-clock` (`src/lib/events/clock.ts`,
`src/lib/events/live.ts`, `src/lib/events/copy.ts`,
`src/lib/participants/lockout.ts`, `src/lib/problems/contest.ts`,
`src/app/admin/events/[id]/live/{page,actions}.tsx`, and the three
`src/components/event-*` files). Tests are in
`tests/ticket-08-start-and-shared-clock.test.ts` (28 tests).

How each guarantee is met:

- **Start / freeze.** `startEvent` opens a transaction, takes
  `SELECT ... FOR UPDATE` on the event row, then writes `status = 'live'`,
  `starts_at = now`, `deadline_at = now + duration_minutes` conditionally on
  `status = 'draft'`. Every authoring write already takes the same event-row
  lock in `lockDraftEvent` before re-checking `draft`, so a save either commits
  before Start (and is inside the frozen set) or is refused. Both paths lock
  `events` first and never lock a participant before an event, so the order
  cannot deadlock.
- **One transaction** is the Start transaction above; the Problem rows are not
  copied, they are frozen by the status gate that every later write honours.
- **No scheduled start / no scheduled lockout.** No cron, no `setTimeout` on
  the server. Start is the only thing that moves the clock; the live page's
  countdown is a display projection of the server's `seconds_remaining`.
- **Visibility.** `listContestProblems(context)` is the only participant-facing
  Problem projection. It takes the `ParticipantContext` (so the caller cannot
  skip `loadParticipantContext`), returns `[]` while the event is `draft`, and
  selects `starter_code` but never `harness_code`. Ticket 09 must read through
  it rather than querying `problems`.
- **Extend.** `extendDeadline` requires the deadline the organizer rendered
  (`expectedDeadlineAt`) and updates conditionally on `status = 'live'` and the
  matching deadline. A double submit serializes on the event row lock and the
  second sees a deadline it did not expect: `changed: false`, no second +10. A
  deliberate second extend carries the revalidated deadline and stacks.
- **End now.** One transaction sets `status = 'ended'`, `deadline_at = now`,
  `ended_at = now`, then reuses `lockAtDeadline(tx, { eventId }, now)` to lock
  everyone still unlocked. Participants already locked keep their reason and
  their original `locked_at`.
- **Reconciliation.** The deadline write lives once in
  `src/lib/participants/lockout.ts:lockAtDeadline`: conditional on
  `status <> 'locked_out'`, always `locked_at = deadline_at`, never "when we
  noticed". `loadParticipantContext` calls it for one participant;
  `getEventHealth` calls it for the whole roster before counting; `endEvent`
  calls it inside its transaction. There is no second copy.
- **Late join.** Joining creates a row; the event's `deadline_at` is untouched,
  so the next read locks them at the shared deadline (tested).
- **Editing gate.** Problem and Sample Case edits are refused after Start via
  the existing `event_not_draft` gate (tested). Starter Code and Harness
  authoring does not exist on this base (ticket 04 is not merged yet); when it
  lands it must write through `lockDraftEvent` in `problems/manage.ts`, which is
  the same gate, or the freeze test above will not cover it. This is the one
  line of the checklist that depends on ticket 04 landing.
- **Live view.** `/admin/events/[id]/live` renders the health strip (roster,
  solving, locked, ready sandboxes, time remaining) plus Start / Extend +10 /
  End now. Start and End now confirm; the Start dialog names the current
  participant count via `startConfirmationText`.

Downstream tickets:

- **09:** call `listContestProblems(await loadParticipantContext(...))`. Starter
  lists will be empty until ticket 04 is merged. The health strip counts
  `solving` from `participants.status`, and Start deliberately does not mark
  people as solving on their behalf; 09/13 should set `status = 'solving'` when
  a participant actually enters the contest, otherwise the strip keeps showing
  them as `joined` for the whole event.
- **11:** a deadline lockout currently only locks the participant row. The
  Submission row and its snippets are ticket 11's write; it should hang off the
  same `lockAtDeadline` result (the `locked_at` is already the deadline).
- **13:** the third strike must use its own conditional lockout (reason
  `eliminated`), because `lockAtDeadline` only applies `deadline`.
- **15:** `ended_at` is set only by End now; an event that reaches its deadline
  stays `live` until End now or ticket 15's own ending logic. Use
  `ended_at is null` + `deadline_at <= now` to mean "ended by deadline", and
  `ended_at` set to mean "ended by the organizer". Extend currently refuses
  every non-`live` event with `event_not_live`; 15 will widen that for the
  ended-by-deadline case and reopen only `deadline` lockouts.
