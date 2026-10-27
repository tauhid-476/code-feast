# 11: Submit and the locked screen

**What to build:** Submitting is the Participant's one irreversible action: a confirmation warns that it ends their contest, and confirming freezes a Submission containing the code of every Problem at that moment. The same Submission is produced without their involvement when the Deadline passes, using the last autosaved code. Either way they land on a terminal screen showing why they are locked and how long they worked, and the code is no longer viewable or editable.

**Blocked by:** 09: Contest view: fullscreen gate, editor, autosave

**Status:** ready-for-agent

- [ ] Submit asks for confirmation with wording that makes clear it ends the contest and cannot be undone.
- [ ] Confirming locks the Participant out with reason `submitted`.
- [ ] Lockout records exactly one Submission per Participant, holding the code of every Problem at that moment, the language used per Problem, the reason, and the time.
- [ ] The locked screen is terminal: it shows the reason and the elapsed time, and the code is neither viewable nor editable.
- [ ] A Deadline lockout produces the same recorded Submission from the last autosaved code, with reason `deadline` and a locked-out time equal to the Deadline.
- [ ] A Participant who closes the tab before the Deadline and returns afterwards is locked with the code that was autosaved, not an empty Submission.
- [ ] Submitting twice is impossible; a second Submit is refused and does not create a second Submission.
- [ ] Returning to the contest route after lockout shows the locked screen instead of the editor.
- [ ] Cancelling the confirmation leaves the Participant in the contest with nothing recorded.
