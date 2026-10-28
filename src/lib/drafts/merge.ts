import type { Language } from "@/lib/languages";

/**
 * The draft merge rule, kept pure so the client and the tests agree on it.
 *
 * One buffer exists per Participant, Problem and language. Two copies may exist:
 * the server's last acknowledged save, and the copy mirrored in localStorage.
 * The newer `updatedAt` wins; an exact tie means the server already has it.
 * Times are the client's projection of server time (see `lib/contest/clock`),
 * so a copy written in an earlier page session compares honestly with the
 * server's timestamp and a tampered wall clock cannot move it.
 */

export type DraftSnapshot = {
  code: string;
  /** Milliseconds since the epoch, in server time. */
  updatedAt: number;
};

export type DraftSource = "server" | "local" | "starter";

export type DraftChoice = {
  code: string;
  updatedAt: number;
  source: DraftSource;
  /** True when the chosen copy is not on the server and must be pushed. */
  pendingSave: boolean;
};

export function draftKey(problemId: string, language: Language): string {
  return `${problemId}:${language}`;
}

/**
 * First load of a Problem + language: server beats an older local mirror, a
 * newer local mirror beats the server, and with neither the Starter Code seeds
 * the editor. A seed is not saved on its own — it is deterministic, and
 * writing it would turn opening a problem into an edit.
 */
export function chooseDraft(
  server: DraftSnapshot | null,
  local: DraftSnapshot | null,
  starterCode?: string,
): DraftChoice {
  if (server && local) {
    if (local.updatedAt > server.updatedAt) {
      return {
        code: local.code,
        updatedAt: local.updatedAt,
        source: "local",
        pendingSave: true,
      };
    }
    return {
      code: server.code,
      updatedAt: server.updatedAt,
      source: "server",
      pendingSave: false,
    };
  }

  if (server) {
    return {
      code: server.code,
      updatedAt: server.updatedAt,
      source: "server",
      pendingSave: false,
    };
  }

  if (local) {
    return {
      code: local.code,
      updatedAt: local.updatedAt,
      source: "local",
      pendingSave: true,
    };
  }

  return {
    code: starterCode ?? "",
    updatedAt: 0,
    source: "starter",
    pendingSave: false,
  };
}
