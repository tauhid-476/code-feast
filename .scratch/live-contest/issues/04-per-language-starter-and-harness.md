# 04: Per-language starter code and harness

**What to build:** Each Problem carries, for Python 3, Java, and C++, a Starter Code file the Participant sees and a Harness the Participant never sees. The Starter Code is a complete file containing the signed function the Participant is asked to complete; the Harness is the hidden snippet appended server-side at Run time. The Organizer edits both freely — the Harness is not read-only and not treated as generated code.

**Blocked by:** 03: Author a problem

**Status:** ready-for-agent

- [ ] Every Problem can hold a Starter Code and a Harness for Python 3, Java, and C++.
- [ ] The data model allows exactly one Starter Code/Harness pair per Problem per language and rejects duplicates.
- [ ] Starter Code is a full file including the signed function, and is what a Participant is shown for that language.
- [ ] Harness text is absent from every Participant-facing response, including anything served to the contest view.
- [ ] Harness text is never written into a Submission.
- [ ] The Organizer can edit the Harness with the same freedom as Starter Code, with no read-only affordance.
- [ ] Starter Code and Harness are editable only while the Event is `draft`.
- [ ] A Problem with a missing Starter Code for a language is visibly incomplete to the Organizer before Start.
