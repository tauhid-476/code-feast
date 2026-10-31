# 20: Figures in a problem statement

**What to build:** An Organizer can put a **Figure** — a picture — inside a
Problem's Markdown statement, because graph, tree and linked-list Problems need
a diagram to be answerable. The Figure is uploaded to object storage, referenced
from the statement as `/api/figures/<id>`, and rendered by the one `Statement`
component everywhere a statement is shown: the authoring preview, the contest
view, and the review screen. A Figure is display-only: it never enters a Sample
Test Case's input, never reaches the Harness or the runner, and never appears in
a Submission.

**Blocked by:** nothing (schema + storage only; no dependency on the runner).

**Status:** resolved

- [x] An Organizer can add a Figure to a `draft` Problem by picking a file or
      pasting one from the clipboard; the reference is inserted into the
      statement at the cursor as `![Figure N](/api/figures/<id>)`.
- [x] Only PNG, JPEG and WebP are accepted, at most 2MB each and at most six
      Figures per Problem; the seventh is refused with a clear message.
- [x] A Figure becomes referenceable only after its object is confirmed in the
      bucket. A failed upload inserts nothing and reports the failure.
- [x] The authoring preview renders the Figure immediately after upload.
- [x] The contest view renders the same `Statement` component, so a Figure
      appears exactly where the Organizer put it — inline in the statement,
      above the Sample Test Case cards.
- [x] The review screen shows the statement, collapsed, above the submitted
      code in each problem tab, with identical Figure rendering.
- [x] A remote image URL in a statement never renders as an image; it renders as
      a link.
- [x] A Participant who has joined can read a Figure only while the Event is
      `live` or `ended`. Before Start, and for anyone who has not joined, the
      read route answers 404.
- [x] Minting an upload is refused once the Event is no longer `draft`.
- [x] Saving the statement deletes every Figure it no longer references, object
      included. Pending rows older than 24 hours are swept on the next mint.
- [x] With no bucket configured the app builds, the suite passes, statements
      render, and only the "Add figure" control is disabled with an explanation.
- [x] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass.

## Plan

**Decisions:** `docs/adr/0005-figures-are-statement-content.md` — inline
statement content, private branch-scoped bucket, id reference, app-route reads.

### Language

**Figure** (see `GLOSSARY.md`): a display-only picture inside a Problem's
statement, uploaded by the Organizer and never part of any test input.
`_Avoid_: image, diagram, picture, illustration, asset`.

### Data model

```
problem_figures(
  id uuid pk,
  problem_id uuid not null references problems(id) on delete cascade,
  storage_key text not null unique,
  content_type text not null,
  bytes integer not null,
  width integer, height integer,          -- null when the browser did not report
  state text not null default 'pending',  -- pending | ready
  created_at timestamptz not null default now()
)

index (problem_id, state)
index (state, created_at)                 -- the stale-pending sweep
check state in ('pending', 'ready')
check content_type in ('image/png', 'image/jpeg', 'image/webp')
check bytes between 1 and 2097152
```

There is deliberately **no `alt` column**: the alt text lives in the Markdown,
where the Organizer can edit it. There is no `problem delete` action in the
codebase today, so the `on delete cascade` is a constraint we get for free, not
a code path; the live cleanup is reconciliation on statement save.

### Storage

- `neon.ts` at the repo root declares `buckets: { figures: {} }` — **private**.
  Applied with `neon deploy` on the dev branch and on the production project.
- Credentials arrive as the AWS-standard variables Neon injects
  (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`,
  `AWS_REGION`). `FIGURES_BUCKET` defaults to `figures`.
- `src/lib/env.ts` gains one accessor, `figuresStorageConfig()`, returning the
  four credentials plus the bucket name **or null** when they are absent. Every
  caller treats null as "storage not configured", exactly as `e2bApiKey()`
  already does.
- Key shape `problems/<problem_id>/<figure_id>.<ext>`. Keys are immutable: the
  presigned POST pins the exact key, so an upload can never overwrite another
  Figure. Replacing a Figure means a new id and a new key.
- One CORS rule on the bucket: `POST` from the app origin and
  `http://localhost:3000`, headers `*`, expose `ETag`.

### Routes

| Route | Method | Who | Does |
|---|---|---|---|
| `/api/figures` | POST | Organizer, `draft` Event | Mint: sweep stale pendings, enforce the six-cap, insert a `pending` row, return `{ id, url, fields }` for a presigned POST. |
| `/api/figures/[id]/confirm` | POST | Organizer, `draft` Event | HEAD the object, verify content type and size, flip the row to `ready`, store `bytes`/`width`/`height`. |
| `/api/figures/[id]` | GET | Permitted viewer | Stream object bytes. 404 (never 403) when not permitted. Cache `private, max-age=31536000, immutable`. |

Read authorization:

- **Organizer** (owner of the Event): always.
- **Participant** who has joined the Event: while the Event is `live` or
  `ended`.
- **Everyone else** (unauthenticated, wrong account, participant before Start):
  `404 Not Found`.

### Statement rendering

The Markdown rule:

- `![alt](/api/figures/<id>)` renders the Figure.
- `![alt](https://...)` (or any non-`/api/figures/` src) renders as a link:
  `[alt](https://...)` with a small "(external image not shown)" label. A
  contestant's browser never makes an outbound request to an unknown host, and
  a statement never depends on a third party staying up.
- `[alt](/api/figures/<id>)` renders as a link to the Figure.
- `<img src="...">` is dropped: raw HTML is already forbidden, and no `img` tag
  depends on a third-party host.

`src/components/figure-image.tsx` ("use client") is the only new visual piece:

- rendered on a **light paper surface** (`bg-white`, border, radius, padding) so
  a white-background diagram does not glare against the dark UI;
- `max-w-full`, `loading="lazy"`, and `width`/`height` from the Problem's Figure
  metadata when the caller supplies it, so the statement does not jump as the
  picture arrives;
- click opens the Figure full-size in the existing `Dialog`.

`Statement` stays a Server Component; only `FigureImage` is a Client Component.
`Statement` takes an optional `figures` map (`id → { width, height }`) that the
three call sites fill from what they already load.

### UI changes

- `src/components/problem-editor.tsx`: an **Add figure** button beside the
  Statement label, disabled with an inline reason when storage is unconfigured;
  a paste handler on the Textarea that intercepts `image/*` from the clipboard,
  uploads it, and inserts `\n\n![Figure N](/api/figures/<id>)\n\n` at the cursor.
  Upload failures surface as a `toast()`; nothing is inserted.
- `src/components/contest-workspace.tsx`: no change beyond what `Statement` now
  does.
- `src/components/review-dashboard.tsx`: a **Show statement** disclosure above
  the code in each problem tab, rendering the same `Statement`. The organizer is
  there to read code, so it starts collapsed. `ParticipantSubmissionDetail`'s
  snippets gain `statementMd` and the figure metadata.

### Failure handling

| Failure | Behaviour |
|---|---|
| Bucket unconfigured | Statements render; **Add figure** is disabled with the reason; mint answers `storage_unavailable`. |
| Upload fails or CORS rejects it | Toast, nothing inserted, the pending row is swept later. |
| Confirm finds no object | Toast, the row is deleted immediately. |
| Reference to an unknown or pending id on save | Save is refused with `figure_not_ready`; a broken Figure never reaches a participant. |
| Figure removed from the statement and saved | Object and row deleted. Removal is permanent; the editor's explicit Save is the confirmation. |
| Pending row abandoned | Swept on the next mint once it is older than 24 hours. |
| Seventh Figure | Refused with `figure_limit_reached`. |
| Remote URL in a statement | Renders as a link, never as an image. |

### Tests

`tests/ticket-20-statement-figures.test.ts` — domain, against the real test
database, with `tests/helpers/fake-figure-storage.ts` injected (same shape as
`fake-sandbox-provider.ts`):

- mint refuses a non-organizer, a `live` Event, a seventh Figure, a 3MB file and
  `image/svg+xml`;
- confirm flips `pending` → `ready` and refuses when the object is missing;
- reconcile deletes exactly the unreferenced rows and objects, and refuses a
  reference to an unknown id;
- the sweep removes pending rows older than 24 hours and leaves younger ones;
- `canReadFigure` matrix: owner before Start, owner after, joined participant
  before Start, joined participant while `live`, joined participant after
  `ended`, stranger.

`tests/ticket-20-statement-render.test.tsx` — `/api/figures/<id>` renders an
`<img>`; `https://…` renders a link; alt text survives both.

Assertions come from this ticket, not from re-deriving the implementation.

### Build order

1. `problem_figures` in `src/lib/db/schema.ts`, then `npm run db:generate`.
2. `neon.ts`, `figuresStorageConfig()` in `src/lib/env.ts`, `storage.ts`, and
   the test fake.
3. Domain: `manage.ts` (mint, confirm, reconcile, sweep) and `queries.ts`
   (`canReadFigure`).
4. The three routes.
5. `Statement` rule and `figure-image.tsx`.
6. Authoring UI: button, paste, insertion.
7. Review-screen disclosure.
8. Tests.
9. `SPEC.md` §4.2, §8, §9, §10.

### Setup checklist

1. `neon.ts`: `buckets: { figures: {} }`.
2. Dev branch: `neon deploy`, then `neon env pull` so `AWS_*` lands in
   `.env.local`.
3. Production project: the same, then add `AWS_*` to the Vercel production
   environment.
4. Bucket CORS: `POST` from `http://localhost:3000` and the production origin.
5. Nothing else. With no `AWS_*` present the app runs, statements render, and
   only the upload control is disabled.

### Risks

- **CORS is the likely first failure.** Verify a real browser upload in
  rehearsal, not just the presign response.
- **Bytes cross a Function.** At 60 participants × a handful of Figures this is
  noise, but it is a deliberate trade for per-request authorization.
- **Light diagram on a dark UI.** Mitigated by the paper surface; a Figure with
  a transparent background will still look odd and that is accepted.
- **Statement text now carries ids.** Deleting and re-adding a Figure yields a
  new id; there is no aliasing and no redirect.

### Process

- Work on `feat/statement-figures`. Never commit to or push `main`.
- Commit per build step.
- When the work is done and `code-review` has passed, open a pull request with
  `gh pr create` using the `pr` body shape, then stop. Do not merge.

## Notes

- Implemented `problem_figures` table in `src/lib/db/schema.ts` with check constraints on content type (`png`, `jpeg`, `webp`), size limits (1B to 2MB), state (`pending`, `ready`), and index on `(problem_id, state)` and `(state, created_at)`.
- Generated Drizzle migration `drizzle/0003_plain_leech.sql` and declared private figures bucket in `neon.ts`.
- Implemented S3 storage client with presigned POST generation and HEAD / GET / DELETE in `src/lib/figures/storage.ts` using `@aws-sdk/client-s3` and `@aws-sdk/s3-presigned-post`.
- Implemented figure lifecycle in `src/lib/figures/manage.ts`: `mintFigure`, `confirmFigure`, `reconcileFiguresInTransaction`, `removeFigureObjects`, `sweepStalePending`.
- Implemented query helpers in `src/lib/figures/queries.ts`: `canReadFigure` (enforcing authorization matrix: organizer owner, or joined participant when live/ended; 404 for all others), `listReadyFigureViews`.
- Implemented routes `/api/figures`, `/api/figures/[id]`, and `/api/figures/[id]/confirm`.
- Updated `Statement` component in `src/components/statement.tsx` to render `/api/figures/<id>` as `<FigureImage>` (on a light paper surface `bg-white`, lazy-loaded, click-to-dialog zoom) and remote URLs strictly as links.
- Added "Add figure" button and clipboard paste interceptor to `src/components/problem-editor.tsx`.
- Added collapsible "Show statement" disclosure to each problem tab in `src/components/review-dashboard.tsx`.
- Wrote full unit & integration tests in `tests/ticket-20-statement-figures.test.ts` (21 tests) and `tests/ticket-20-statement-render.test.tsx` (3 tests).
- Verified with `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
