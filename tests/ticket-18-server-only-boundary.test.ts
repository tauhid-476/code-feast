import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Ticket 18: "no secret value reaches the browser bundle".
 *
 * `src/lib/env.ts` and `src/lib/db/client.ts` read `process.env`; the browser
 * may only ever reach modules that do not. Next.js builds a client bundle from
 * the modules a `"use client"` file imports, transitively, so the rule is a
 * property of the import graph: nothing reachable from a client entry may read
 * `process.env` or import `server-only`.
 *
 * This is a source-level check on purpose: it needs no build and no network,
 * and it fails on the commit that introduces the leak rather than at deploy
 * time. The build-time half is `grep` over `.next/static` (see docs/deploy.md).
 */

const SRC = resolve(process.cwd(), "src");
const EXTENSIONS = [".ts", ".tsx"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return EXTENSIONS.some((extension) => path.endsWith(extension))
      ? [path]
      : [];
  });
}

const FILES = walk(SRC);

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function isClientEntry(source: string): boolean {
  return /^\s*["']use client["'];?/m.test(source.slice(0, 200));
}

/**
 * A `"use server"` module imported by a client component is a Server Action:
 * Next replaces it with an RPC reference, so its code (and everything it
 * imports) stays on the server. The edge stops here.
 */
function isServerActionModule(source: string): boolean {
  return /^\s*["']use server["'];?/m.test(source.slice(0, 200));
}

/** Every `import ... from "x"` and bare `import "x"` in a file. */
function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  // `import type ...` is erased before the bundle exists, so it is not an edge
  // in the runtime graph: a client component may name a server type freely.
  const pattern =
    /(?:^|\n)\s*import\s+(?!type\s)(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) specifiers.push(match[1]);
  return specifiers;
}

/** Resolves an import to a file in `src`, or null when it leaves `src`. */
function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  else return null;

  const candidates = [
    base,
    ...EXTENSIONS.map((extension) => base + extension),
    ...EXTENSIONS.map((extension) => join(base, `index${extension}`)),
  ];
  return candidates.find((path) => FILES.includes(path)) ?? null;
}

/** Every `src` file a client entry pulls into the browser bundle. */
function clientReachable(): Set<string> {
  const reachable = new Set<string>();
  const queue = FILES.filter((path) => isClientEntry(read(path)));

  while (queue.length > 0) {
    const path = queue.pop()!;
    if (reachable.has(path)) continue;
    reachable.add(path);

    const source = read(path);
    if (isServerActionModule(source)) continue;

    for (const specifier of importSpecifiers(source)) {
      const target = resolveImport(path, specifier);
      if (target && !reachable.has(target)) queue.push(target);
    }
  }

  return reachable;
}

const REACHABLE = clientReachable();

describe("the browser bundle boundary", () => {
  it("finds the client entries it is meant to walk", () => {
    // A vacuous pass would hide a regression, so the walk must be non-empty.
    expect(REACHABLE.size).toBeGreaterThan(1);
    expect([...REACHABLE].some((path) => path.endsWith("problem-editor.tsx"))).toBe(
      true,
    );
  });

  it("stops at a Server Action instead of following it to the database", () => {
    // create-event-form.tsx imports createEventAction, which is a `"use server"`
    // module: the browser gets an RPC reference, not `getDb()` and not the env.
    expect(REACHABLE.has(join(SRC, "app/admin/events/actions.ts"))).toBe(true);
    expect(REACHABLE.has(join(SRC, "lib/events/manage.ts"))).toBe(false);
    expect(REACHABLE.has(join(SRC, "lib/db/client.ts"))).toBe(false);
  });

  it("keeps every module that reads process.env out of client code", () => {
    const leaking = [...REACHABLE].filter((path) =>
      read(path).includes("process.env"),
    );
    expect(leaking).toEqual([]);
  });

  it("keeps server-only modules out of client code", () => {
    const leaking = [...REACHABLE].filter((path) =>
      importSpecifiers(read(path)).includes("server-only"),
    );
    expect(leaking).toEqual([]);
  });

  it("lets client code read the neutral language vocabulary", () => {
    // The one module shared across the boundary: values, no environment.
    expect(REACHABLE.has(join(SRC, "lib/languages.ts"))).toBe(true);
  });
});
