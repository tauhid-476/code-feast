# 16: Review dashboard and shortlist

**What to build:** The Organizer opens one Event's roster and sees every Participant with what happened to them: name, email, status, when they joined, when and why they were locked out, how long they worked, and how many strikes they took. Clicking a row opens their Submission as read-only code, one tab per Problem, with the full strike log beneath — including the pastes that were blocked and never counted. A Shortlist mark lets the Organizer keep track of the submissions worth revisiting.

**Blocked by:** 11: Submit and the locked screen; 13: Counted strikes, heartbeat, and elimination

**Status:** ready-for-agent

- [x] The roster lists every Participant in the Event with display name, email, status, joined time, locked-out time, lockout reason, elapsed time, and strike count.
- [x] Submitted, deadline-locked, and eliminated Participants all appear, distinguished by reason.
- [x] Opening a Participant shows one tab per Problem containing the language they used and their submitted code, read-only.
- [x] The strike log sits below the code and includes blocked attempts marked uncounted, each with kind and timestamp.
- [x] The Organizer can mark and unmark a Participant as shortlisted, and the mark persists.
- [x] Shortlist marks are visible only to Organizers.
- [x] There is no live view of in-progress code and no winner field anywhere on the surface.
- [x] The surface is unreachable to Participants.
- [x] A Participant eliminated with only two visible strikes still shows every strike that was recorded against them.

## Notes

Feature commit `1eff7f8`, merge commit `d1d686a`.

- Domain module `src/lib/review/queries.ts` exports `getReviewDashboard` and `getParticipantSubmission`.
  - Reconciles deadline lockouts via `lockAtDeadline` before loading participant data.
  - Queries participant roster with display name, email, status, joined time, locked-out time, lockout reason, elapsed time, strike count, and shortlist status.
  - `getParticipantSubmission` returns problem snippets with submitted language and code for locked participants, and full chronological violation logs (both uncounted blocked attempts like `paste_blocked` and counted strikes).
  - Strictly prevents leaking in-progress drafts/code for participants who have not locked out yet.
  - Refuses non-organizer callers with 403 / 404 domain errors.
- Domain module `src/lib/review/manage.ts` exports `setParticipantShortlist` and `toggleParticipantShortlist`, persisting the boolean on `participants.shortlisted`.
- Route `/admin/events/[id]/review` is guarded by `requireOrganizer()`, rendering `ReviewDashboard`.
- `/admin/events/[id]/submissions` redirects cleanly to `/admin/events/[id]/review`.
- Navigation links between Problems, Live controls, and Review dashboard are available in organizer event headers.
- UI built with shadcn primitives adhering to Emil Kowalski design engineering principles:
  - Read-only Monaco code viewer (`ReviewCodeEditor`) with dark theme.
  - Problem tabs for inspecting code per problem.
  - Strike and violation log table showing timestamps, descriptions, and classified badges (`Blocked (uncounted)` vs `Strike (counted)`).
  - Shortlist toggle buttons with optimistic updates and Sonner toast notifications.
  - Zero winner fields or ranks anywhere on the surface.
- Verified with 10 unit and component tests in `tests/ticket-16-review-dashboard-and-shortlist.test.ts`.
