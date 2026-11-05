# 15: Reinstate and deadline reopen

**What to build:** The Organizer can undo a Lockout caused by elimination: strikes cleared, Participant back to solving, original Deadline kept, no time refunded, and their work still there. Reinstatement is unavailable once the Event has ended. Separately, when an Event ended by reaching its Deadline, extending it reopens exactly the Participants locked by that Deadline, leaving anyone who submitted or was eliminated locked.

**Blocked by:** 08: Start, the shared clock, and status gates; 13: Counted strikes, heartbeat, and elimination

**Status:** resolved

- [x] Reinstating a Participant clears their strikes and returns them to solving.
- [x] A reinstated Participant keeps the original Deadline; no time is refunded.
- [x] A reinstated Participant's existing drafts and frozen Submission remain, and they resume where they left off.
- [x] Reinstatement is disabled once the Event has ended, and the control says so rather than failing silently.
- [x] Reinstating an eliminated Participant preserves the Submission they produced, visible to the Organizer.
- [x] Extending an Event that ended by reaching its Deadline adds ten minutes and reopens exactly the Participants locked by `deadline`.
- [x] Extending an ended Event leaves Participants locked by `submitted` or `eliminated` locked.
- [x] Extending an Event that the Organizer ended manually is refused.
- [x] A reopened Participant returns to solving with the new Deadline and their autosaved code intact.

## Notes

Feature commit `ec39653`, merge commit `e47f62f`.

- Implemented `reinstateParticipant` in `src/lib/participants/lockout.ts`: resets strikes to 0, resets status to `solving`, clears `lockoutReason` and `lockedAt`, resets `activeSessionId` to null, and retains existing drafts and frozen submissions. Reinstatement requires the organizer role and is rejected with `DomainError("event_ended", ..., 409)` if the event ended (by status `ended` or deadline passed).
- Implemented `reopenDeadlineLockouts` in `src/lib/participants/lockout.ts`: atomically resets status to `solving` and clears `lockoutReason` and `lockedAt` for participants whose lockout reason is `deadline`. Participants locked by `submitted` or `eliminated` are unchanged.
- Updated `extendDeadline` in `src/lib/events/clock.ts`: if the event was ended manually (`endedAt !== null`), extending is rejected (`event_not_live`, 409). Otherwise, extends deadline by 10 minutes, sets event status to `live`, and invokes `reopenDeadlineLockouts`.
- Fixed contest gate cookie path in `src/lib/participants/gate.ts` so `clearContestGate` cleanly invalidates the cookie for re-entering the fullscreen gate upon reinstatement.
- Added `EliminatedParticipantsCard` in `src/components/eliminated-participants.tsx` and integrated into `/admin/events/[id]/live/page.tsx` with `reinstateParticipantAction`. If the event has ended, the Reinstate button is disabled with explanatory copy.
- Updated `EventClockControls` to accept `endedAt` and `deadlineReached`, providing "Extend +10 (Reopen deadline lockouts)" when deadline was reached and disabling extension when ended manually.
