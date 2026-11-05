<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Code Feast — agent guide

A platform for one live DSA contest. Read `SPEC.md` for behaviour, `GLOSSARY.md`
for vocabulary, `docs/adr/` for the decisions behind the shape, and
`docs/tickets/` for the work.

## Stack

- Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4
- Neon Postgres + Drizzle ORM (`src/lib/db/schema.ts`, migrations in `drizzle/`)
- Neon Auth (Managed Better Auth) via `@neondatabase/auth`
- E2B sandboxes for code execution
- Vitest for tests, run against a real Postgres test database

## Commands

```
npm run dev              # next dev
npm run build            # production build
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm test                 # vitest run (needs db:test:setup once per worktree)
npm run db:generate      # generate a migration after editing the schema
npm run db:migrate       # apply migrations to DATABASE_URL_UNPOOLED
npm run db:test:setup    # create this worktree's test database + migrate
npm run db:test:reset    # drop and recreate this worktree's test database
```

Each worktree gets its own database named after its branch, so parallel work
does not collide. Never point `TEST_DATABASE_URL` at a database whose name does
not contain `_test`.

## Architecture rules

1. **Domain modules own behaviour.** `src/lib/<domain>/` exports async functions
   that take an explicit actor and plain inputs, and return plain data. They do
   not read cookies, headers, or `redirect()`.
2. **The route layer owns identity.** Pages, Server Actions, and route handlers
   call `getViewer()` / `getSessionUser()` from `src/lib/auth/session.ts`,
   enforce the role, and pass the actor into the domain module. A proxy redirect
   is an optimistic gate, never authorization.
3. **Every participant read reconciles the deadline.** Load a participant only
   through the participants module's loader, which locks them at
   `deadline_at` when it has passed. Never read the `participants` table
   directly from a page or action.
4. **The Harness never leaves the server.** Select columns explicitly; never
   return a whole `problem_starters` row to participant-facing code or write
   harness text into a submission.
5. **The server owns time.** Use `src/lib/time.ts`; domain functions accept an
   optional `now: Date` so tests can move the clock.
6. **Refusals are `DomainError`.** Throw `new DomainError(code, message)` from
   domain code; the route layer renders the message. Server Actions return
   `{ error }` via `actionError()`.
7. **Secrets stay server-side.** Only `NEXT_PUBLIC_*` values reach the browser.
   `src/lib/env.ts` is the single place variables are read.

## UI

The UI uses **ui.chaicode.com** (ChaiUI, Radix-based). Before writing or
reviewing any frontend code, load the `chaiui` skill (`.agents/skills/chaiui`)
and read its `references/components.md`. After a slice, apply `chaiui-review`.

- Primitives live in `src/components/ui/`. Do not hand-roll buttons, inputs,
  cards, dialogs, alerts, selects, tabs or badges. Add missing ones with
  `npx shadcn@latest add @chaiui/<name>`.
- Use `asChild` for links, not `render`. Button variants are
  `soft | solid | outline | muted | ghost | danger`, sizes `sm | md | lg | icon`.
  `Alert` takes `tone`, `Badge` uses ChaiUI variants, `Dialog` takes
  `open / onClose / title`.
- Light and dark are both supported via the ChaiUI theme provider. Use semantic
  tokens only (`bg-card`, `text-muted-foreground`, `border-border`,
  `text-brand`); never raw hex or palette colors.
- Fonts: Manrope (sans) and Geist Mono (`.mono`, `.label`). No `next/font`.
- Marketing and shell pages may use the ChaiUI look: asymmetric buttons,
  `card-chai`, `Backdrop`, subtle motion. The **contest workspace, review and
  problem editor stay sober**: no glass, no decorative motion, no gradients.
- Motion: specific transition properties, `ease-out` under 300ms, respect
  `prefers-reduced-motion`.
- `src/components/legacy-ui/` is temporary. Never add imports to it. Migrating
  a file means replacing its `legacy-ui` imports with `ui` ones.
- Do not change anything under `src/lib/`, `src/app/api/`, server actions or
  `use-contest-*` hooks during UI work. Change classNames, wrappers and
  primitives only.
- Transient feedback uses `toast()` from `sonner`; inline failures use `Alert tone="danger"`.


## Testing

Tests live at domain seams, against the real test database. Follow the `tdd`
skill: one failing test, one minimal implementation, repeat. Use
`tests/helpers/factories.ts` for fixtures and `useCleanDatabase()` from
`tests/helpers/db.ts` at the top of each test file. Assertions must come from
the spec, not from recomputing the implementation.

Do not mock Postgres. Mock only the E2B transport and browser APIs.

## Issue tracker

Local markdown in `docs/tickets/`. A ticket is done when every
checkbox is ticked and its `Status:` line reads `resolved`. Append a short
`## Notes` entry with the commit and anything the next reader needs.
