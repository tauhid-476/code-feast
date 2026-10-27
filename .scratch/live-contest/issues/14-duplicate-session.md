# 14: Duplicate session

**What to build:** A Participant who opens the contest in a second place gets the new session and loses the old one: the newest session wins, the older becomes read-only, and the Participant is charged one strike for holding the Event open twice. The old tab is told what happened instead of failing mysteriously, and the Participant's draft survives the handover.

**Blocked by:** 13: Counted strikes, heartbeat, and elimination

**Status:** ready-for-agent

- [ ] Starting a second live session for the same Participant makes the newest session the active one.
- [ ] The older session becomes read-only: it cannot Run, edit, or Submit, and its autosave is refused.
- [ ] The older session shows an explanation that a newer session took over, rather than a silent failure.
- [ ] The takeover records one counted strike of kind `duplicate_session` against that Participant.
- [ ] Where two sessions begin near-simultaneously, exactly one wins and exactly one strike is recorded.
- [ ] The handover preserves the Participant's drafts, so the winning session opens on their latest code.
- [ ] A duplicate session can be the third strike, and elimination then applies to every session.
- [ ] The active session is what the Organizer's health strip counts as solving.
