# 19: Rehearsal

**What to build:** A full fake contest on the deployed app proves the four failure modes that only a live run reveals: an elimination and its reversal, a synchronized Run burst, a laptop closed past the Deadline, and every Harness actually calling its signed function. The outcome is a written record of what broke and a confirmed decision on whether the sandbox pool is trustworthy enough for the real Event.

**Blocked by:** 15: Reinstate and deadline reopen; 17: Re-run a submission; 18: Production deploy

**Status:** ready-for-agent

- [ ] Three accounts run a complete fake contest: one Organizer, two Participants.
- [ ] Every Problem is tested in every language through the Organizer's test panel before Start, and each Harness successfully calls its signed function.
- [ ] One Participant is deliberately eliminated by three strikes, then reinstated, and resumes on the original Deadline.
- [ ] A burst of at least 30 simultaneous Runs is attempted, and the proportion of busy responses, the longest wait, and the recovery time are written down.
- [ ] One Participant closes the laptop past the Deadline and reopens it, and is locked with reason `deadline` at the Deadline with their last autosaved code intact.
- [ ] One Participant opens a second session mid-contest, sees the older one go read-only, and is charged one strike.
- [ ] Autosave failure is simulated once, and the "Not saved" banner, local mirror, and resync are confirmed.
- [ ] Every breakage found is recorded, fixed or explicitly accepted, and the pool decision (E2B with 20 warm sandboxes, or the self-hosted Piston fallback) is confirmed in writing.
