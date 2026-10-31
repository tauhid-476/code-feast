# Figures are statement content, referenced by id and served through the app

A Figure is inline Markdown inside a Problem's statement, not a field on a Sample Test Case. The bytes live in a private, branch-scoped Neon Object Storage bucket, the statement carries only an id (`![Figure 1](/api/figures/<id>)`), and every read goes through an app route that authorizes the viewer before streaming the object.

The per-sample field is the obvious shape — it is what LeetCode's examples look like, and it needs no Markdown skills — but it only covers a diagram that belongs to an example. A graph or tree is usually introduced in the prose before the samples exist, and the organizer already authors that prose in Markdown. Two surfaces would mean two authoring controls, two render paths, and a diagram that cannot sit where the sentence points at it. Inline covers every placement with the renderer we already ship.

The reference is an id rather than a URL so that the statement is not coupled to a bucket endpoint or a branch, so a Figure can be revoked, and so the same authorization rule that guards the contest page also guards the pixels. That rule is stricter than public objects and looser than presigning: public URLs make a statement readable by anyone holding the link before the event starts, and presigned URLs expire under a tab that has been open for ninety minutes.

## Considered Options

- **A field on each Sample Test Case** — structured and always adjacent to its example, but leaves no home for a diagram that belongs to the statement, and expected output stays imageless by rule anyway.
- **Public-read bucket with stable URLs** — the simplest thing that works, and cacheable, but the URL becomes a bearer token and the statement bakes in the branch endpoint.
- **Private bucket with presigned GETs minted at render** — cheaper egress, but every render path has to sign, including the organizer's client-side preview, and long-lived tabs hit an expiry.
- **Vercel Blob** — one less Neon concept, but a second vendor whose stores do not branch with the database, so a rehearsal branch would point at production files.
- **External image URLs only** — zero build, but a live contest then depends on a third-party host being reachable from the venue network, and an image can vanish mid-contest with nothing editable to fix it.

## Consequences

Image bytes cross a Function instead of being served by a CDN. At sixty participants and a handful of Figures per Problem this is noise, and it is the price of checking identity on every read. Because an id never changes its bytes, the response is `immutable` and the browser caches it for the session.

Figures are optional and never gate Start: the completeness line still reports only the three language pairs. Because the statement text is the record of what is referenced, saving it reconciles — anything the saved text no longer mentions is deleted, object included, with no undo beyond re-uploading.

The bucket is branch-scoped, so dev and production each need their own, and a missing bucket is a supported state: statements render, and only the upload control is disabled.
