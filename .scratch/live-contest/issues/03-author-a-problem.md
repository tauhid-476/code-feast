# 03: Author a problem

**What to build:** Inside a `draft` Event, the Organizer builds the Problem set: each Problem has a title, an optional difficulty label, a Markdown statement, and exactly two Sample Test Cases. Problems have an order the Organizer controls. Nothing here is visible to Participants, who cannot reach the authoring surface at all.

**Blocked by:** 02: Create and list a draft event

**Status:** resolved

- [x] An Organizer can add a Problem to a `draft` Event with a title, an optional difficulty label, and a Markdown statement.
- [x] The statement renders as Markdown in the authoring preview and (later) to Participants.
- [x] The difficulty label is display-only: no behaviour anywhere reads it.
- [x] Each Problem holds exactly two Sample Test Cases with input text and expected output text, and saving with fewer than two is refused with a clear message.
- [x] Sample Test Cases have an order and are presented in that order.
- [x] Problems can be reordered, and the new order persists across reloads.
- [x] Authoring is refused once the Event is no longer `draft`.
- [x] A Participant cannot read or reach the authoring surface.

## Notes

**Commit:** `cbf85b2` (merged `feat/live-contest` after: already up to date).

**Domain (`src/lib/problems/`)**

- `manage.ts`: `createProblem`, `updateProblem`, `moveProblem` (up/down), all
  taking `{ id, email }` and throwing `DomainError`. Organizer check is
  domain-level (`not_organizer`, 403), and event ownership plus `draft` status
  are checked before and again inside the write transaction. Errors:
  `event_not_found`, `event_not_draft`, `problem_not_found`, `title_required`,
  `statement_required`, `sample_cases_missing`, `sample_cases_too_many`,
  `sample_case_invalid`, `direction_invalid`.
- Sample cases are rewritten on every save, so their order always follows the
  submitted array; positions are 1 and 2, matching the schema's check constraint.
- `moveProblem` renumbers in two phases (`+1000`, then 1..n) so it stays correct
  if `problems.position` ever gains a unique constraint.
- `queries.ts`: `listProblems(eventId)` returns `ProblemSummary[]` ordered by
  position, each with `sampleCases` ordered by position; `getProblem(id)` is the
  single-problem read.
- The event row is locked `FOR UPDATE` inside every write transaction. **Ticket
  08: Start must lock the same `events` row** so a save cannot land after the
  freeze.

**UI**

- `/admin/events/[id]` (`src/app/admin/events/[id]/page.tsx`): `requireOrganizer`
  then `getOrganizerEvent` (owner-scoped; 404 otherwise), event header (title,
  status, join code, duration), problem list, add/edit editor, reorder controls.
  Non-draft events render a read-only alert and hide add/edit/move.
- `src/app/admin/events/[id]/actions.ts`: `createProblemAction`,
  `updateProblemAction`, `moveProblemAction`, each `requireOrganizer` +
  `revalidatePath`, returning `{ error }` via `actionError`.
- `src/components/problem-editor.tsx`: title, optional difficulty, Markdown
  textarea with a side-by-side live preview, and two fixed sample case blocks
  (input + expected output). It contains the ticket 04 seam: a dashed
  "Starter code and harness" section where the per-language editors mount.
- `src/components/problem-set.tsx`: position-ordered list, up/down buttons,
  edit state. `src/components/statement.tsx`: the single Markdown renderer
  (`react-markdown` + `remark-gfm`, `skipHtml`, script/style/iframe
  disallowed), also intended for the participant statement in ticket 09.
- `src/components/event-status-badge.tsx`: extracted from `event-list.tsx` so
  the authoring header uses the same status vocabulary.

**Tests:** `tests/ticket-03-author-problem.test.ts` (12) covers create,
empty title, fewer/more than two samples, update replacing fields and cases,
order persistence through `listProblems`, reorder up/down, difficulty
round-trip with no behavioural effect, live/ended refusal for create/update/
move, participant refusal for all three, and cross-organizer refusal.
`tests/ticket-03-statement.test.tsx` (3) covers GFM rendering, raw HTML being
inert, and `javascript:` links being neutralised. `vitest.config.ts` now
includes `.tsx` test files.

**Verification:** `npm test` (42 passed), `npm run typecheck`, `npm run lint`,
`npm run build` all pass after merging `feat/live-contest`.

**For the merger / later tickets**

- No schema change, no migration.
- New dependencies: `react-markdown@10.1.0`, `remark-gfm@4.0.1`.
- The live preview is a Client Component, so the unified/remark graph ships in
  the admin bundle. That is deliberate (live preview); participant statements
  should use the same `Statement` component from a Server Component so no
  Markdown code reaches their bundle.
- A fresh worktree needs `npx next typegen` (or `npm run build`) before
  `npm run typecheck`; `LayoutProps`/`PageProps` route types are generated.
- Ticket 04: mount per-language Starter Code/Harness editors in the marked
  section of `problem-editor.tsx`. `ProblemSummary` has no starter fields yet;
  add them to the query projection explicitly, never as a whole
  `problem_starters` row.
