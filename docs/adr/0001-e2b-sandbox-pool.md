# Execute untrusted code in a pre-warmed E2B sandbox pool

Participants submit Python, Java, and C++ that must actually run. The Next.js app is deployed on Vercel, which cannot execute arbitrary code, so execution must be offloaded. We chose E2B: a Debian-based sandbox with a configurable image, stdin support, a per-run timeout, and 20 concurrent sandboxes on the free Hobby tier with $100 of credit — enough for a 90-minute event at roughly $1.

The pool, not per-request creation, is the load-bearing part of this decision. E2B permits one sandbox creation per second per account, so creating one per Run request turns a 60-person burst into a minute-long queue. Twenty warm sandboxes claimed through Postgres (`FOR UPDATE SKIP LOCKED`) and reused for the whole contest convert that burst into a few seconds of waiting.

## Considered Options

- **Vercel Sandbox** — same platform and no extra credential, but the managed image has neither `javac` nor `g++`, so it needs a custom OCI image anyway; and Hobby's 5 Active-CPU-hour ceiling *pauses sandbox creation for 30 days* when exceeded rather than billing, which is an unrecoverable mid-contest failure.
- **Public Piston API** — became whitelist-only in February 2026, and the policy excludes college and temporary projects. Not available.
- **Self-hosted Piston** — works, and its response schema is nicer, but it means owning a VPS, a firewall, TLS, and uptime for one event. Kept as the fallback if the pool misbehaves in rehearsal.
- **Judge0, hosted or self-hosted** — heavier and more expensive than the problem requires.
- **Browser execution (Pyodide, CheerpJ, wasm-clang)** — Python-only in practice, and licensing rules out CheerpJ for an academic event.

## Consequences

The pool is the only component with no fast local fallback, so the rehearsal must include a burst test. Sandboxes must be created with internet egress disabled and a one-hour timeout, and health-checked on claim, because a dead sandbox otherwise surfaces as a confusing participant-facing error.
