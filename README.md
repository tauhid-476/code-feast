<div align="center">

# ⚡ CodeFeast

**A real-time competitive programming & DSA contest platform with sandboxed execution and anti-cheat supervision.**

[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?logo=postgresql)](https://neon.tech/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle)](https://orm.drizzle.team/)
[![E2B Sandboxes](https://img.shields.io/badge/E2B-Sandboxes-orange)](https://e2b.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS_v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[**Live Demo**](https://code-feast-chi.vercel.app/) • [**Architecture Specs**](SPEC.md) • [**Deployment Guide**](docs/deploy.md) • [**Decisions (ADRs)**](docs/adr/)

</div>

---

## 📖 Overview

**CodeFeast** is a full-featured competitive programming platform designed for university hackathons, coding contests, and technical interviews. An organizer authors problems, shares a 6-character join code, and starts a shared countdown. Participants solve algorithmic challenges in an in-browser Monaco editor across Python 3, Java, and C++ under active anti-cheat supervision.

### Why CodeFeast?
- **Zero Cold-Start Bursts**: Eliminates per-request container creation overhead through an atomic PostgreSQL-backed worker pool.
- **Cheating-Resistant**: Intercepts clipboard events, enforces fullscreen, flags window blurring, and verifies integrity via server-side heartbeats.
- **Server-Owned Authority**: Eliminates client clock drift and tampering with lazy deadline reconciliation.
- **Human-in-the-Loop Review**: Organizers review code, inspect strike timelines, and re-run submissions directly against test cases.

---

## ✨ Key Features

### 💻 Contestant Workspace
- **Monaco Code Editor**: Professional-grade editing environment with syntax highlighting, indentation, and keybindings for **Python 3**, **Java**, and **C++**.
- **Per-Language Starters & Hidden Harnesses**: Clean function signatures presented to participants, while hidden server-side harnesses handle `stdin` parsing and stdout formatting.
- **Continuous Auto-Save**: Real-time draft persistence so participants can switch between problems or recover from browser crashes seamlessly.
- **Sample Test Case Evaluation**: Instant run feedback with per-case diff comparison (Input, Expected vs. Actual, `stderr`, execution time, and exit codes).

### 🛡️ Anti-Cheat Supervision Engine
- **Clipboard & Interaction Guarding**: Blocks paste actions via keyboard (`Ctrl/Cmd+V`), right-click context menu, middle-click, and drag-and-drop. Copying out is permitted.
- **Strike System with Deduplication**: Tracks fullscreen exits and window focus loss (`blur` / `visibilitychange`). Violations within a 2-second window are deduplicated to avoid multi-penalizing single actions (like Alt-Tab).
- **3-Strike Elimination**: A third strike permanently freezes the participant's workspace and locks them out.
- **Tamper-Proof Heartbeat**: Browser sends a 5-second heartbeat reporting `fullscreenElement` and `visibilityState`. Client listener suppression is detected and counted on the server.
- **Single Active Session**: Opening a second live session automatically demotes the older session to read-only.

### ⏱️ Server-Owned Synchronized Clock
- **Zero-Trust Timing**: Event countdown is computed server-side with round-trip latency compensation (`/api/clock`). Local machine clock tampering has zero effect.
- **Lazy Deadline Reconciliation**: Status reconciliation runs on every server query. If the deadline passes, contestants are locked out with reason `deadline` and an exact timestamp, even if their browser was closed.
- **Live Organizer Controls**: Instantaneous event start with atomic problem freeze, live +10 minute deadline extensions, and emergency "End Now" actions.

### 🚀 High-Throughput E2B Sandbox Pool
- **Isolated Linux Sandboxes**: Execution runs inside secure microVM containers powered by E2B (`python3`, `g++`, and `openjdk-17-headless`).
- **Postgres Warm Worker Pool**: Pre-warms sandbox instances in the database. Claims are acquired atomically using `SELECT ... FOR UPDATE SKIP LOCKED` and released in `finally` blocks.
- **Asynchronous Replenishment**: Short pools are replenished in the background using Next.js `waitUntil` without blocking user requests.

### 📊 Organizer Authoring & Review Suite
- **Problem Authoring**: Full Markdown problem statements, constraints, difficulty tagging, and sample cases.
- **Statement Figures**: S3-compatible object storage integration for uploading problem diagrams, graphs, and tree structures.
- **Pre-Flight Test Panel**: Organizers can test solutions against custom harnesses before taking an event live.
- **Review Dashboard**: Filterable contestant roster showing join times, lockout reasons, strike logs, code tabs per problem, and a one-click **Shortlist** star.

---

## 🏗️ System Architecture

```
[ Organizer ]                             [ Contestant ]
      │                                         │
      ├─► Create Event & Problems               ├─► Enter Join Code
      ├─► Pre-Flight Test Harnesses             ├─► Waiting in Lobby
      ├─► Start Event (Freezes Problems) ─────► ├─► Fullscreen Gate
      │                                         │
      │                                         ▼
      │                               ┌──────────────────────┐
      │                               │   Contest Workspace  │
      │                               │  (Monaco + AutoSave) │
      │                               └──────────┬───────────┘
      │                                          │
      │   Heartbeat & Violations (5s)            │ Run Code (Sample Cases)
      │ ◄────────────────────────────────────────┤
      │                                          ▼
      │                               ┌──────────────────────┐
      │                               │   Postgres Pool      │
      │                               │ FOR UPDATE SKIP LOCK │
      │                               └──────────┬───────────┘
      │                                          │
      │                                          ▼
      │                               ┌──────────────────────┐
      │                               │  E2B Linux Sandbox   │
      │                               │ (Python / Java / C++)│
      │                               └──────────┬───────────┘
      │                                          │
      │   Submissions & Strike Timelines         ▼
      │ ◄────────────────────────────── Result Diff & Metrics
      ▼
[ Review Dashboard ]
  - Inspect contestant code
  - Re-run submissions
  - Shortlist candidates
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Server Actions, Route Handlers), [React 19](https://react.dev/) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) (strict mode) |
| **Database & ORM** | [Neon Serverless PostgreSQL](https://neon.tech/), [Drizzle ORM](https://orm.drizzle.team/), `drizzle-kit` |
| **Authentication** | [Neon Auth](https://neon.tech/docs/guides/neon-auth) (Managed Better-Auth) |
| **Code Execution** | [E2B Sandboxes](https://e2b.dev/) (Custom Ubuntu template with OpenJDK 17, GCC, Python 3) |
| **Code Editor** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) (`@monaco-editor/react`) |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com/), [Motion](https://motion.dev/), [Radix UI](https://www.radix-ui.com/), [Base UI](https://base-ui.com/), [Sonner](https://sonner.emilkowal.ski/) |
| **File Storage** | AWS S3-compatible Object Storage (Neon storage / S3) |
| **Testing** | [Vitest](https://vitest.dev/) with real PostgreSQL test database isolation |

---

## 📁 Repository Structure

```
code-feast/
├── docs/
│   ├── adr/               # Architecture Decision Records (0001-0005)
│   ├── deploy.md          # Production deployment runbook & environment manifest
│   ├── tickets/           # 20 feature delivery specs and validation records
│   └── verify-deploy.md   # Deployment verification checklist
├── drizzle/               # Database migrations and schema snapshots
├── e2b/                   # Custom E2B Sandbox Dockerfile (OpenJDK 17 + GCC + Python3)
├── public/                # Static assets, logos, and diagram figures
├── scripts/               # Migration, test DB, and E2B template build scripts
├── src/
│   ├── app/               # Next.js App Router (auth, admin, contest, API routes)
│   ├── components/        # UI components, Monaco editor, gates, and dashboards
│   └── lib/
│       ├── auth/          # Authentication guards and session management
│       ├── contest/       # Anti-cheat, heartbeat, and contest submission logic
│       ├── db/            # Drizzle client, pool configuration, and schema
│       ├── figures/       # S3 object storage integration for figures
│       ├── problems/      # Problem management and code coverage checks
│       ├── review/        # Submission queries and re-run pipelines
│       ├── runner/        # E2B sandbox manager and Postgres worker pool
│       └── violations/    # Strike tracking, deduplication, and logging
├── tests/                 # Vitest integration test suite
├── SPEC.md                # Comprehensive system specification
└── GLOSSARY.md            # Domain language definitions
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** `>= 20.x`
- **PostgreSQL** instance (or free serverless database on [Neon](https://neon.tech))
- **E2B Account** & API Key ([e2b.dev](https://e2b.dev))

### 1. Clone the repository
```bash
git clone https://github.com/tauhid-476/code-feast.git
cd code-feast
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in the required variables:
```ini
# Database
DATABASE_URL="postgresql://user:pass@ep-pooler.neon.tech/neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://user:pass@ep-direct.neon.tech/neondb?sslmode=require"

# Neon Auth
NEON_AUTH_BASE_URL="https://...neonauth...neon.tech/neondb/auth"
NEON_AUTH_COOKIE_SECRET="generate-with-openssl-rand-base64-32"

# Organizers Allowlist
ADMIN_EMAILS="organizer@example.com"

# E2B Sandbox Runner
E2B_API_KEY="e2b_..."
E2B_TEMPLATE_ID=""  # Generated in step 4
```

### 3. Run Database Migrations
```bash
npm run db:migrate
```

### 4. Build the E2B Custom Sandbox Template
To enable Java execution alongside Python and C++, build the custom JDK template:
```bash
npm run e2b:build
```
Copy the printed template ID into `E2B_TEMPLATE_ID` in your `.env.local`.

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing

The test suite runs against a real PostgreSQL test database using Vitest:

```bash
# Setup the dedicated test database
npm run db:test:setup

# Run all tests
npm test

# Run type checking
npm run typecheck

# Run linter
npm run lint
```

---

## 📜 Documentation

- [`SPEC.md`](SPEC.md) — Authoritative system specification and edge case rules.
- [`GLOSSARY.md`](GLOSSARY.md) — Domain terminology and concepts.
- [`docs/adr/`](docs/adr/) — Architecture Decision Records:
  - `0001`: E2B Sandbox Pool with atomic Postgres reservation
  - `0002`: Server-owned clock & lazy reconciliation
  - `0003`: Human judging model
  - `0004`: Strike model & deduplication
  - `0005`: Statement figures storage
- [`docs/deploy.md`](docs/deploy.md) — Production deployment runbook.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
