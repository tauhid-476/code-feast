# Code Feast

A platform for one live DSA contest: an Organizer authors an Event and its
Problems, shares a join code, starts a shared clock, and Participants solve
Python, Java, and C++ in a sandboxed editor.

- `SPEC.md` — behaviour, authoritative
- `GLOSSARY.md` — vocabulary
- `AGENTS.md` — architecture, UI, and testing rules
- `docs/adr/` — the decisions behind the shape
- `docs/deploy.md` — environment manifest, migrations, and the Vercel runbook

## Getting started

```bash
cp .env.example .env.local    # then fill it in
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Java needs the sandbox template in `e2b/`; build it once with `npm run e2b:build`
and set `E2B_TEMPLATE_ID`. See `docs/deploy.md` §2.

## Deploying

See `docs/deploy.md`. The short version: apply migrations with
`npm run db:migrate` (deliberately, never from the build), set the environment
variables listed there, and deploy to Vercel.
