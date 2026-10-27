# Issue tracker: local markdown

Issues and the spec for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md` (this repo keeps the authored
  spec at `SPEC.md` at the root and links it from the feature directory).
- Tickets are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`.
- Triage state is a `Status:` line near the top. Values: `needs-triage`,
  `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, `resolved`.
- A ticket is closed by ticking every checkbox, setting `Status: resolved`, and
  appending a `## Notes` entry with the commit hash and anything the next reader
  needs.
- `Blocked by:` lists ticket numbers. A ticket is unblocked when every listed
  ticket is `resolved`.

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/issues/`.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path.
