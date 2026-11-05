# 04: Per-language starter code and harness

**What to build:** Each Problem carries, for Python 3, Java, and C++, a Starter Code file the Participant sees and a Harness the Participant never sees. The Starter Code is a complete file containing the signed function the Participant is asked to complete; the Harness is the hidden snippet appended server-side at Run time. The Organizer edits both freely — the Harness is not read-only and not treated as generated code.

**Blocked by:** 03: Author a problem

**Status:** resolved

- [x] Every Problem can hold a Starter Code and a Harness for Python 3, Java, and C++.
- [x] The data model allows exactly one Starter Code/Harness pair per Problem per language and rejects duplicates.
- [x] Starter Code is a full file including the signed function, and is what a Participant is shown for that language.
- [x] Harness text is absent from every Participant-facing response, including anything served to the contest view.
- [x] Harness text is never written into a Submission.
- [x] The Organizer can edit the Harness with the same freedom as Starter Code, with no read-only affordance.
- [x] Starter Code and Harness are editable only while the Event is `draft`.
- [x] A Problem with a missing Starter Code for a language is visibly incomplete to the Organizer before Start.

## Notes

**Files**

- `src/lib/languages.ts` — `LANGUAGES`, `Language`, `LANGUAGE_LABELS`, `isLanguage`,
  `languageRank`. Neutral (no `process.env`) so client components can use the
  same vocabulary; `src/lib/env.ts` re-exports them unchanged for server code.
- `src/lib/problems/manage.ts` — `saveProblemStarter(actor, problemId, language,
  { starterCode, harnessCode })`. `assertOrganizer` → `requireDraftProblem` →
  `lockDraftEvent` in the write transaction, then an upsert on
  `(problem_id, language)`. Blank Starter Code/Harness and unknown languages are
  `DomainError`s (`starter_required`, `harness_required`, `language_invalid`)
  naming the language. Text is stored exactly as typed.
- `src/lib/problems/queries.ts` — `ProblemSummary.starters: ProblemStarterPair[]`
  (language + starterCode + harnessCode), loaded by an explicit column
  projection. This is the authoring shape only.
- `src/lib/problems/participant.ts` — `listParticipantProblems(eventId)` returns
  statement, sample cases, and `ParticipantStarter { language, starterCode }`.
  The select names only those columns and never selects a `problem_starters`
  row, so there is no harness field to forget to remove.
- `src/lib/problems/program.ts` — `assembleRunProgram(problemId, language, code)`
  reads the Harness and returns `{ language, source, sampleCases }`, with
  `source = code + "\n" + harnessCode` (one newline; no blank line when the code
  already ends in one). This is the ticket 06 seam. The Harness is appended
  server-side; the returned source is execution input and is not a
  participant-facing payload.
- `src/lib/problems/coverage.ts` — `languageCoverage(starters)` reports missing
  Starter Code and missing Harness per language, with a sentence for the UI.
  Blank text counts as missing.
- `src/app/admin/events/[id]/actions.ts` — `saveProblemStarterAction`, organizer
  gate, `revalidatePath`, `{ error }` via `actionError`.
- `src/components/problem-languages.tsx` — per-language tabs for an existing
  problem, with two ordinary textareas and a Save button per language. Unsaved
  changes survive tab switches; the button is disabled until dirty.
- `src/components/language-pair-fields.tsx` — the Starter Code and Harness
  fields. The Harness textarea has no `readOnly`/`disabled` path at all.
- `src/components/problem-completeness.tsx` — the row-level readiness line, and
  `src/components/problem-set.tsx` renders it under each problem so a missing
  Starter Code is visible on `/admin/events/[id]` before Start.
- No schema change and no migration: `problem_starters` already had the
  `(problem_id, language)` unique index and the language check constraint.

**How each guarantee is met**

- One pair per language: the database unique index rejects a duplicate (tested
  directly through the factory as well as through the upsert); the domain save
  updates the existing row.
- Starter Code is the full visible file: the write stores the text verbatim, and
  `listParticipantProblems` returns it per language with the statement.
- Harness is absent from participant reads: the projection cannot select it.
  Tests assert the returned starter objects have exactly `language` and
  `starterCode`, and that a sentinel harness string never appears anywhere in
  the serialised result.
- Harness never reaches a Submission: the schema has no harness column on
  `drafts` or `submission_snippets`; only `assembleRunProgram` reads the
  Harness, and it is documented execution-only for the run pipeline.
- Harness is freely editable: same textarea treatment as Starter Code, no
  read-only affordance (asserted in the rendered markup).
- Draft-only: every save runs `requireDraftProblem` + `lockDraftEvent`; live and
  ended events refuse with `event_not_draft`.
- Visible incompleteness: `languageCoverage` + `ProblemCompleteness` render
  "Missing starter code for …" / "Missing harness for …" in `text-destructive`
  per problem row, and "All three languages ready" otherwise.

**Tests:** `tests/ticket-04-per-language-starter-and-harness.test.ts` (12) covers
saving all three languages and exact round-trip of a full Python file, the
one-row-per-language rule at both the domain and database level, blank/missing
text and invalid languages, participant/organizer/ownership/live refusals,
participant projection shape and harness absence, run-program assembly with and
without a trailing newline, missing-harness and invalid-language run refusals,
the submission schema's lack of a harness field, coverage summaries including
blank rows, rendered incompleteness markup, and the editable Harness textarea.

**Verification:** `npx next typegen`, `npm test` (88 passed, 8 files),
`npm run typecheck`, `npm run lint`, `npm run build` all pass after merging
`feat/live-contest` (already at its tip `92d9730`, merge reported up to date).

**For the merger / later tickets**

- Ticket 06: call `assembleRunProgram(problemId, language, code)` at the route
  layer after validating the language; it returns the exact file for the
  sandbox plus the two sample cases. It throws `harness_missing` (409) when a
  language has no Harness, so the test panel can say so instead of crashing.
- Ticket 09: use `listParticipantProblems(eventId)` for the contest pane. It
  already excludes the Harness; do not add a new starter query.
- The authoring page now sends harness text to the Organizer's browser as part
  of `ProblemSummary`; that is intentional and must not be reused for
  participant settings.
