# 15: Reinstate and deadline reopen

**What to build:** The Organizer can undo a Lockout caused by elimination: strikes cleared, Participant back to solving, original Deadline kept, no time refunded, and their work still there. Reinstatement is unavailable once the Event has ended. Separately, when an Event ended by reaching its Deadline, extending it reopens exactly the Participants locked by that Deadline, leaving anyone who submitted or was eliminated locked.

**Blocked by:** 08: Start, the shared clock, and status gates; 13: Counted strikes, heartbeat, and elimination

**Status:** ready-for-agent

- [ ] Reinstating a Participant clears their strikes and returns them to solving.
- [ ] A reinstated Participant keeps the original Deadline; no time is refunded.
- [ ] A reinstated Participant's existing drafts and frozen Submission remain, and they resume where they left off.
- [ ] Reinstatement is disabled once the Event has ended, and the control says so rather than failing silently.
- [ ] Reinstating an eliminated Participant preserves the Submission they produced, visible to the Organizer.
- [ ] Extending an Event that ended by reaching its Deadline adds ten minutes and reopens exactly the Participants locked by `deadline`.
- [ ] Extending an ended Event leaves Participants locked by `submitted` or `eliminated` locked.
- [ ] Extending an Event that the Organizer ended manually is refused.
- [ ] A reopened Participant returns to solving with the new Deadline and their autosaved code intact.
